package server

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"stitch/internal/config"
	"stitch/internal/models"
	"stitch/internal/plans"
	"stitch/internal/shell"
)

func HandleGetRepos(w http.ResponseWriter, r *http.Request) {
	cfg := config.Read()
	var currentGitHubUser string
	var githubRepoCount int

	userRes := shell.RunCmd("gh api user --jq '{login: .login, public_repos: .public_repos, total_private_repos: .total_private_repos}'", "")
	if userRes.Success && userRes.Stdout != "" {
		var u struct {
			Login            string `json:"login"`
			PublicRepos      int    `json:"public_repos"`
			TotalPrivateRepos int   `json:"total_private_repos"`
		}
		if err := json.Unmarshal([]byte(userRes.Stdout), &u); err == nil {
			currentGitHubUser = u.Login
			githubRepoCount = u.PublicRepos + u.TotalPrivateRepos
		}
	}

	updatedRepos := []models.Repo{}
	for _, repo := range cfg.Repos {
		isLocal := repo.Path != ""
		exists := true
		branch := "main"
		owner := repo.Owner
		name := repo.Name
		buildScripts := []string{}

		if isLocal {
			absPath, _ := filepath.Abs(repo.Path)
			if _, err := os.Stat(absPath); os.IsNotExist(err) {
				exists = false
			} else {
				branchRes := shell.RunCmd("git branch --show-current", absPath)
				if branchRes.Success {
					branch = branchRes.Stdout
				}
				if owner == "" {
					owner, name = shell.GetRepoInfoFromGit(absPath)
				}
				pkgPath := filepath.Join(absPath, "package.json")
				if _, err := os.Stat(pkgPath); err == nil {
					if data, err := os.ReadFile(pkgPath); err == nil {
						var pkg struct {
							Scripts map[string]string `json:"scripts"`
						}
						if err := json.Unmarshal(data, &pkg); err == nil {
							for s := range pkg.Scripts {
								buildScripts = append(buildScripts, s)
							}
						}
					}
				}
			}
		}

		repType := "web"
		if isLocal {
			repType = "local"
		}

		updatedRepos = append(updatedRepos, models.Repo{
			Name:           name,
			Owner:          owner,
			Path:           repo.Path,
			IsMajorProject: repo.IsMajorProject,
			Exists:         exists,
			Branch:         branch,
			Type:           repType,
			BuildScripts:   buildScripts,
		})
	}

	tabEnergies := cfg.TabEnergies
	if tabEnergies == nil {
		tabEnergies = map[string]string{
			"overview":     "all",
			"repositories": "all",
			"focus":        "high",
			"projects":     "medium",
			"releases":     "medium",
			"pr-reviews":   "low",
			"issues":       "low",
			"builds":       "high",
			"profile":      "all",
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"repos":            updatedRepos,
		"focusProject":     cfg.FocusProject,
		"currentUser":      currentGitHubUser,
		"tabEnergies":      tabEnergies,
		"githubRepoCount":  githubRepoCount,
	})
}

func HandlePostTabEnergies(w http.ResponseWriter, r *http.Request) {
	var body map[string]string
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	cfg := config.Read()
	cfg.TabEnergies = body
	config.Write(cfg)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":     true,
		"tabEnergies": cfg.TabEnergies,
	})
}


func HandlePostRepos(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path           string `json:"path"`
		Owner          string `json:"owner"`
		Name           string `json:"name"`
		IsMajorProject bool   `json:"isMajorProject"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Path == "" {
		http.Error(w, `{"error":"Repository path or owner/repo string is required."}`, http.StatusBadRequest)
		return
	}

	cfg := config.Read()
	var repoData models.Repo

	isWebFormat := strings.Contains(body.Path, "/") &&
		!strings.HasPrefix(body.Path, "/") &&
		!strings.Contains(body.Path, "\\") &&
		!strings.Contains(body.Path, ":")

	if isWebFormat {
		parts := strings.Split(body.Path, "/")
		if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
			http.Error(w, `{"error":"Invalid web repository format. Use owner/name"}`, http.StatusBadRequest)
			return
		}
		wOwner, wName := parts[0], parts[1]

		existingIndex := -1
		for idx, r := range cfg.Repos {
			if r.Path == "" && strings.EqualFold(r.Owner, wOwner) && strings.EqualFold(r.Name, wName) {
				existingIndex = idx
				break
			}
		}

		repoData = models.Repo{
			Name:           wName,
			Owner:          wOwner,
			Path:           "",
			IsMajorProject: body.IsMajorProject,
		}

		if existingIndex > -1 {
			cfg.Repos[existingIndex] = repoData
		} else {
			cfg.Repos = append(cfg.Repos, repoData)
		}
	} else {
		absPath, _ := filepath.Abs(body.Path)
		if _, err := os.Stat(absPath); os.IsNotExist(err) {
			http.Error(w, fmt.Sprintf(`{"error":"Path does not exist: %s"}`, absPath), http.StatusBadRequest)
			return
		}

		existingIndex := -1
		for idx, r := range cfg.Repos {
			if r.Path != "" {
				rAbs, _ := filepath.Abs(r.Path)
				if rAbs == absPath {
					existingIndex = idx
					break
				}
			}
		}

		dOwner, dName := body.Owner, body.Name
		if dOwner == "" || dName == "" {
			dOwner, dName = shell.GetRepoInfoFromGit(absPath)
		}

		repoData = models.Repo{
			Name:           dName,
			Owner:          dOwner,
			Path:           absPath,
			IsMajorProject: body.IsMajorProject,
		}

		if existingIndex > -1 {
			cfg.Repos[existingIndex] = repoData
		} else {
			cfg.Repos = append(cfg.Repos, repoData)
		}
	}

	if config.Write(cfg) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "repo": repoData})
	} else {
		http.Error(w, `{"error":"Failed to save config."}`, http.StatusInternalServerError)
	}
}

func HandleDeleteRepos(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path  string `json:"path"`
		Owner string `json:"owner"`
		Name  string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"Request parsing failed."}`, http.StatusBadRequest)
		return
	}

	cfg := config.Read()
	filtered := []models.Repo{}
	found := false

	if body.Path != "" {
		absBodyPath, _ := filepath.Abs(body.Path)
		for _, r := range cfg.Repos {
			if r.Path != "" {
				rAbs, _ := filepath.Abs(r.Path)
				if rAbs == absBodyPath {
					found = true
					continue
				}
			}
			filtered = append(filtered, r)
		}
		fAbs, _ := filepath.Abs(cfg.FocusProject)
		if cfg.FocusProject != "" && fAbs == absBodyPath {
			cfg.FocusProject = ""
		}
	} else if body.Owner != "" && body.Name != "" {
		for _, r := range cfg.Repos {
			if r.Path == "" && strings.EqualFold(r.Owner, body.Owner) && strings.EqualFold(r.Name, body.Name) {
				found = true
				continue
			}
			filtered = append(filtered, r)
		}
		if cfg.FocusProject == fmt.Sprintf("%s/%s", body.Owner, body.Name) {
			cfg.FocusProject = ""
		}
	}

	if !found {
		http.Error(w, `{"error":"Repository not found in config."}`, http.StatusNotFound)
		return
	}

	cfg.Repos = filtered
	if config.Write(cfg) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"success":true}`))
	} else {
		http.Error(w, `{"error":"Failed to update config."}`, http.StatusInternalServerError)
	}
}

func HandleToggleMajor(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path  string `json:"path"`
		Owner string `json:"owner"`
		Name  string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"Request parsing failed."}`, http.StatusBadRequest)
		return
	}

	cfg := config.Read()
	index := -1

	if body.Path != "" {
		absBodyPath, _ := filepath.Abs(body.Path)
		for idx, r := range cfg.Repos {
			if r.Path != "" {
				rAbs, _ := filepath.Abs(r.Path)
				if rAbs == absBodyPath {
					index = idx
					break
				}
			}
		}
	} else if body.Owner != "" && body.Name != "" {
		for idx, r := range cfg.Repos {
			if r.Path == "" && strings.EqualFold(r.Owner, body.Owner) && strings.EqualFold(r.Name, body.Name) {
				index = idx
				break
			}
		}
	}

	if index == -1 {
		http.Error(w, `{"error":"Repo not found"}`, http.StatusNotFound)
		return
	}

	cfg.Repos[index].IsMajorProject = !cfg.Repos[index].IsMajorProject
	config.Write(cfg)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "repo": cfg.Repos[index]})
}

func HandleSetFocus(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path  string `json:"path"`
		Owner string `json:"owner"`
		Name  string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"Request parsing failed."}`, http.StatusBadRequest)
		return
	}

	cfg := config.Read()
	if body.Path != "" {
		absPath, _ := filepath.Abs(body.Path)
		cfg.FocusProject = absPath
	} else if body.Owner != "" && body.Name != "" {
		cfg.FocusProject = fmt.Sprintf("%s/%s", body.Owner, body.Name)
	} else {
		cfg.FocusProject = ""
	}

	config.Write(cfg)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "focusProject": cfg.FocusProject})
}

func HandleProjectDetails(w http.ResponseWriter, r *http.Request) {
	owner := r.URL.Query().Get("owner")
	name := r.URL.Query().Get("name")
	if owner == "" || name == "" {
		http.Error(w, `{"error":"owner and name are required."}`, http.StatusBadRequest)
		return
	}

	issuesRes := shell.RunCmd(fmt.Sprintf(`gh issue list --repo "%s/%s" --json number,title,author,url,createdAt,labels --limit 50`, owner, name), "")
	prsRes := shell.RunCmd(fmt.Sprintf(`gh pr list --repo "%s/%s" --json number,title,author,url,createdAt,reviewRequests,reviewDecision --limit 30`, owner, name), "")
	tagRes := shell.RunCmd(fmt.Sprintf(`gh api repos/%s/%s/releases/latest --jq .tag_name`, owner, name), "")

	var rawIssues []map[string]interface{}
	if issuesRes.Success {
		json.Unmarshal([]byte(issuesRes.Stdout), &rawIssues)
	}

	var rawPrs []map[string]interface{}
	if prsRes.Success {
		json.Unmarshal([]byte(prsRes.Stdout), &rawPrs)
	}

	lastTag := "N/A"
	if tagRes.Success && tagRes.Stdout != "" {
		lastTag = tagRes.Stdout
	}

	features := []interface{}{}
	bugs := []interface{}{}
	roadmap := []interface{}{}
	general := []interface{}{}

	for _, issue := range rawIssues {
		labelsRaw, ok := issue["labels"].([]interface{})
		isFeature := false
		isBug := false
		isRoadmap := false

		if ok {
			for _, l := range labelsRaw {
				labelMap, ok := l.(map[string]interface{})
				if ok {
					lbl := strings.ToLower(labelMap["name"].(string))
					if strings.Contains(lbl, "feature") || strings.Contains(lbl, "enhancement") {
						isFeature = true
					}
					if strings.Contains(lbl, "bug") || strings.Contains(lbl, "error") || strings.Contains(lbl, "defect") {
						isBug = true
					}
					if strings.Contains(lbl, "roadmap") {
						isRoadmap = true
					}
				}
			}
		}

		if isFeature {
			features = append(features, issue)
		} else if isBug {
			bugs = append(bugs, issue)
		} else if isRoadmap {
			roadmap = append(roadmap, issue)
		} else {
			general = append(general, issue)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"features":      features,
		"bugs":          bugs,
		"general":       general,
		"prs":           rawPrs,
		"lastTag":       lastTag,
		"roadmapIssues": roadmap,
	})
}

func HandleGetRoadmap(w http.ResponseWriter, r *http.Request) {
	owner := r.URL.Query().Get("owner")
	name := r.URL.Query().Get("name")
	if owner == "" || name == "" {
		http.Error(w, `{"error":"owner and name are required."}`, http.StatusBadRequest)
		return
	}

	result := shell.RunCmd(fmt.Sprintf(`gh issue list --repo "%s/%s" --label "roadmap" --json number,title,body --limit 1`, owner, name), "")
	w.Header().Set("Content-Type", "application/json")

	if !result.Success || result.Stdout == "" || result.Stdout == "[]" {
		w.Write([]byte(`{"issue":null,"tasks":[]}`))
		return
	}

	var issues []struct {
		Number int    `json:"number"`
		Title  string `json:"title"`
		Body   string `json:"body"`
	}
	if err := json.Unmarshal([]byte(result.Stdout), &issues); err != nil || len(issues) == 0 {
		w.Write([]byte(`{"issue":null,"tasks":[]}`))
		return
	}

	issue := issues[0]
	tasks := []map[string]interface{}{}

	re := regexp.MustCompile(`(?m)^-\s*\[([ xX])\]\s*(.+)$`)
	matches := re.FindAllStringSubmatch(issue.Body, -1)
	for _, match := range matches {
		done := strings.ToLower(match[1]) == "x"
		tasks = append(tasks, map[string]interface{}{
			"done": done,
			"text": strings.TrimSpace(match[2]),
		})
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"issue": map[string]interface{}{
			"number": issue.Number,
			"title":  issue.Title,
			"url":    fmt.Sprintf("https://github.com/%s/%s/issues/%d", owner, name, issue.Number),
		},
		"tasks": tasks,
	})
}

func HandlePostRoadmapAdd(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Owner string `json:"owner"`
		Name  string `json:"name"`
		Task  string `json:"task"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Owner == "" || body.Name == "" || body.Task == "" {
		http.Error(w, `{"error":"owner, name, and task are required."}`, http.StatusBadRequest)
		return
	}

	listRes := shell.RunCmd(fmt.Sprintf(`gh issue list --repo "%s/%s" --label "roadmap" --json number,body --limit 1`, body.Owner, body.Name), "")
	issueNumber := 0
	currentBody := "## 🗺️ Project Roadmap\n\n"

	if listRes.Success && listRes.Stdout != "" && listRes.Stdout != "[]" {
		var existing []struct {
			Number int    `json:"number"`
			Body   string `json:"body"`
		}
		if err := json.Unmarshal([]byte(listRes.Stdout), &existing); err == nil && len(existing) > 0 {
			issueNumber = existing[0].Number;
			currentBody = existing[0].Body;
		}
	}

	newBody := strings.TrimRight(currentBody, "\r\n\t ") + fmt.Sprintf("\n- [ ] %s", body.Task)

	w.Header().Set("Content-Type", "application/json")
	if issueNumber > 0 {
		editRes := shell.RunCmd(fmt.Sprintf(`gh issue edit %d --repo "%s/%s" --body %s`, issueNumber, body.Owner, body.Name, strconv.Quote(newBody)), "")
		if !editRes.Success {
			http.Error(w, fmt.Sprintf(`{"error":"Failed to update roadmap issue.","details":"%s"}`, strings.ReplaceAll(editRes.Stderr, `"`, `\"`)), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "issueNumber": issueNumber, "message": "Task appended to roadmap issue."})
	} else {
		// Ensure roadmap label exists
		labelCheck := shell.RunCmd(fmt.Sprintf(`gh label list --repo "%s/%s" --json name`, body.Owner, body.Name), "")
		labelExists := false
		if labelCheck.Success && labelCheck.Stdout != "" {
			var labels []struct {
				Name string `json:"name"`
			}
			if err := json.Unmarshal([]byte(labelCheck.Stdout), &labels); err == nil {
				for _, l := range labels {
					if strings.EqualFold(l.Name, "roadmap") {
						labelExists = true
						break
					}
				}
			}
		}

		if !labelExists {
			shell.RunCmd(fmt.Sprintf(`gh label create "roadmap" --repo "%s/%s" --description "Project roadmap tracking" --color "0075ca"`, body.Owner, body.Name), "")
		}

		createRes := shell.RunCmd(fmt.Sprintf(`gh issue create --repo "%s/%s" --title "Project Roadmap" --body %s --label "roadmap"`, body.Owner, body.Name, strconv.Quote(newBody)), "")
		if !createRes.Success {
			http.Error(w, fmt.Sprintf(`{"error":"Failed to create roadmap issue.","details":"%s"}`, strings.ReplaceAll(createRes.Stderr, `"`, `\"`)), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "message": "Roadmap issue created with first task."})
	}
}

func HandleGetReleases(w http.ResponseWriter, r *http.Request) {
	cfg := config.Read()
	releaseInfo := []map[string]interface{}{}

	for _, repo := range cfg.Repos {
		isLocal := repo.Path != ""
		lastTag := ""
		commitsSince := []string{}
		requiresRelease := false

		if isLocal {
			absPath, _ := filepath.Abs(repo.Path)
			if _, err := os.Stat(absPath); os.IsNotExist(err) {
				continue
			}

			tagResult := shell.RunCmd("git describe --tags --abbrev=0", absPath)
			if tagResult.Success {
				lastTag = tagResult.Stdout
				logResult := shell.RunCmd(fmt.Sprintf(`git log %s..HEAD --oneline`, lastTag), absPath)
				if logResult.Success && logResult.Stdout != "" {
					commitsSince = strings.Split(logResult.Stdout, "\n")
					requiresRelease = len(commitsSince) > 0
				}
			} else {
				logResult := shell.RunCmd("git log -n 20 --oneline", absPath)
				if logResult.Success && logResult.Stdout != "" {
					commitsSince = strings.Split(logResult.Stdout, "\n")
					requiresRelease = len(commitsSince) > 0
				}
			}
		} else {
			if repo.Owner != "" && repo.Name != "" {
				tagResult := shell.RunCmd(fmt.Sprintf(`gh api repos/%s/%s/releases/latest --jq .tag_name`, repo.Owner, repo.Name), "")
				if tagResult.Success && tagResult.Stdout != "" {
					lastTag = tagResult.Stdout
					commitsResult := shell.RunCmd(fmt.Sprintf(`gh api repos/%s/%s/commits --limit 10 --jq ".[].commit.message"`, repo.Owner, repo.Name), "")
					if commitsResult.Success && commitsResult.Stdout != "" {
						commitsSince = strings.Split(commitsResult.Stdout, "\n")
						requiresRelease = true
					}
				} else {
					lastTag = "No release tags"
					commitsResult := shell.RunCmd(fmt.Sprintf(`gh api repos/%s/%s/commits --limit 10 --jq ".[].commit.message"`, repo.Owner, repo.Name), "")
					if commitsResult.Success && commitsResult.Stdout != "" {
						commitsSince = strings.Split(commitsResult.Stdout, "\n")
						requiresRelease = len(commitsSince) > 0
					}
				}
			}
		}

		commitsFiltered := []string{}
		for _, c := range commitsSince {
			if strings.TrimSpace(c) != "" {
				commitsFiltered = append(commitsFiltered, c)
			}
		}

		repType := "web"
		if isLocal {
			repType = "local"
		}

		releaseInfo = append(releaseInfo, map[string]interface{}{
			"name":            repo.Name,
			"owner":           repo.Owner,
			"path":            repo.Path,
			"type":            repType,
			"lastTag":         lastTag,
			"commitsCount":    len(commitsFiltered),
			"commits":         commitsFiltered,
			"requiresRelease": requiresRelease,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"releases": releaseInfo})
}

func HandleFocusInfo(w http.ResponseWriter, r *http.Request) {
	cfg := config.Read()
	if cfg.FocusProject == "" {
		w.Write([]byte(`{"active":false}`))
		return
	}

	var activeRepo *models.Repo
	for _, repo := range cfg.Repos {
		if repo.Path != "" {
			rAbs, _ := filepath.Abs(repo.Path)
			fAbs, _ := filepath.Abs(cfg.FocusProject)
			if rAbs == fAbs {
				activeRepo = &repo
				break
			}
		} else {
			if fmt.Sprintf("%s/%s", repo.Owner, repo.Name) == cfg.FocusProject {
				activeRepo = &repo
				break
			}
		}
	}

	if activeRepo == nil {
		w.Write([]byte(`{"active":false}`))
		return
	}

	isLocal := activeRepo.Path != ""
	exists := true
	owner := activeRepo.Owner
	name := activeRepo.Name
	gitBranch := "main"
	statusSummary := []string{}

	if isLocal {
		absPath, _ := filepath.Abs(activeRepo.Path)
		if _, err := os.Stat(absPath); os.IsNotExist(err) {
			exists = false
		} else {
			branchRes := shell.RunCmd("git branch --show-current", absPath)
			if branchRes.Success {
				gitBranch = branchRes.Stdout
			}
			if owner == "" {
				owner, name = shell.GetRepoInfoFromGit(absPath)
			}
			statusRes := shell.RunCmd("git status --short", absPath)
			if statusRes.Success && statusRes.Stdout != "" {
				statusSummary = strings.Split(statusRes.Stdout, "\n")
			}
		}
	}

	var issues []interface{}
	var prs []interface{}

	if owner != "" && name != "" {
		issuesRes := shell.RunCmd(fmt.Sprintf(`gh issue list --repo "%s/%s" --json number,title,author,url,createdAt,labels --limit 30`, owner, name), "")
		if issuesRes.Success {
			json.Unmarshal([]byte(issuesRes.Stdout), &issues)
		}
		prsRes := shell.RunCmd(fmt.Sprintf(`gh pr list --repo "%s/%s" --json number,title,author,url,createdAt,reviewRequests --limit 30`, owner, name), "")
		if prsRes.Success {
			json.Unmarshal([]byte(prsRes.Stdout), &prs)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"active":      true,
		"exists":      exists,
		"type":        isLocal,
		"repo":        map[string]interface{}{"owner": owner, "name": name, "branch": gitBranch, "buildScripts": activeRepo.BuildScripts, "path": activeRepo.Path},
		"issues":      issues,
		"prs":         prs,
		"localStatus": statusSummary,
	})
}

func HandleFocusContents(w http.ResponseWriter, r *http.Request) {
	owner := r.URL.Query().Get("owner")
	name := r.URL.Query().Get("name")
	filePath := r.URL.Query().Get("path")
	if owner == "" || name == "" {
		http.Error(w, `{"error":"Owner and name are required."}`, http.StatusBadRequest)
		return
	}

	cmd := fmt.Sprintf(`gh api repos/%s/%s/contents/%s`, owner, name, urlPathEncode(filePath))
	result := shell.RunCmd(cmd, "")

	w.Header().Set("Content-Type", "application/json")
	if result.Success {
		var payload interface{}
		if err := json.Unmarshal([]byte(result.Stdout), &payload); err == nil {
			// If it's a file payload, try decoding base64 content inline
			if m, ok := payload.(map[string]interface{}); ok {
				if content, ok := m["content"].(string); ok && m["encoding"] == "base64" {
					// Clean spaces and newlines out of base64 return
					cleaned := strings.ReplaceAll(strings.ReplaceAll(content, "\n", ""), "\r", "")
					if decoded, err := base64.StdEncoding.DecodeString(cleaned); err == nil {
						m["decodedContent"] = string(decoded)
					}
				}
			}
			json.NewEncoder(w).Encode(payload)
		} else {
			http.Error(w, `{"error":"Failed to parse api response."}`, http.StatusInternalServerError)
		}
	} else {
		http.Error(w, fmt.Sprintf(`{"error":"Failed to fetch contents.","details":"%s"}`, strings.ReplaceAll(result.Stderr, `"`, `\"`)), http.StatusInternalServerError)
	}
}

func HandlePostReleaseCreate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path  string `json:"path"`
		Owner string `json:"owner"`
		Name  string `json:"name"`
		Tag   string `json:"tag"`
		Notes string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Tag == "" {
		http.Error(w, `{"error":"Release tag name is required."}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if body.Path != "" {
		absPath, _ := filepath.Abs(body.Path)
		hasGh := shell.RunCmd("which gh", absPath)
		if hasGh.Success {
			ghRelease := shell.RunCmd(fmt.Sprintf(`gh release create %s --title "%s" --notes "%s"`, body.Tag, body.Tag, body.Notes), absPath)
			if ghRelease.Success {
				json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "message": "Release created successfully via GitHub CLI."})
				return
			}
		}

		tagCmd := shell.RunCmd(fmt.Sprintf(`git tag -a %s -m "%s"`, body.Tag, body.Notes), absPath)
		if !tagCmd.Success {
			http.Error(w, `{"error":"Failed to create tag"}`, http.StatusInternalServerError)
			return
		}
		pushCmd := shell.RunCmd(fmt.Sprintf(`git push origin %s`, body.Tag), absPath)
		json.NewEncoder(w).Encode(map[string]interface{}{"success": pushCmd.Success, "message": "Tag created and pushed."})
	} else if body.Owner != "" && body.Name != "" {
		ghRelease := shell.RunCmd(fmt.Sprintf(`gh release create %s --repo "%s/%s" --title "%s" --notes "%s"`, body.Tag, body.Owner, body.Name, body.Tag, body.Notes), "")
		if ghRelease.Success {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "message": "Remote release created successfully via GitHub CLI."})
		} else {
			http.Error(w, `{"error":"Failed to create remote release"}`, http.StatusInternalServerError)
		}
	} else {
		http.Error(w, `{"error":"Repository information missing."}`, http.StatusBadRequest)
	}
}

func HandleGetRecents(w http.ResponseWriter, r *http.Request) {
	prsCmd := `gh search prs --review-requested=@me --state=open --limit=10 --json number,title,repository,url,createdAt,author`
	fallbackPrsCmd := `gh search prs --author=@me --state=open --limit=10 --json number,title,repository,url,createdAt,author`
	issuesCmd := `gh search issues --assignee=@me --state=open --limit=10 --json number,title,repository,url,createdAt,labels,state`
	fallbackIssuesCmd := `gh search issues --author=@me --state=open --limit=10 --json number,title,repository,url,createdAt,labels,state`

	var prs []interface{}
	var issues []interface{}

	prResult := shell.RunCmd(prsCmd, "")
	if !prResult.Success || prResult.Stdout == "" || prResult.Stdout == "[]" {
		prResult = shell.RunCmd(fallbackPrsCmd, "")
	}
	if prResult.Success && prResult.Stdout != "" {
		json.Unmarshal([]byte(prResult.Stdout), &prs)
	}

	issueResult := shell.RunCmd(issuesCmd, "")
	if !issueResult.Success || issueResult.Stdout == "" || issueResult.Stdout == "[]" {
		issueResult = shell.RunCmd(fallbackIssuesCmd, "")
	}
	if issueResult.Success && issueResult.Stdout != "" {
		json.Unmarshal([]byte(issueResult.Stdout), &issues)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"prs": prs, "issues": issues})
}

func HandleGetPrs(w http.ResponseWriter, r *http.Request) {
	owner := r.URL.Query().Get("owner")
	name := r.URL.Query().Get("name")
	if owner == "" || name == "" {
		http.Error(w, `{"error":"Repo owner and name are required."}`, http.StatusBadRequest)
		return
	}

	cmd := fmt.Sprintf(`gh pr list --repo "%s/%s" --json number,title,author,url,createdAt,reviewRequests,reviewDecision,mergeable --limit 30`, owner, name)
	result := shell.RunCmd(cmd, "")

	w.Header().Set("Content-Type", "application/json")
	if result.Success {
		var prList []interface{}
		if err := json.Unmarshal([]byte(result.Stdout), &prList); err == nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"prs": prList})
		} else {
			http.Error(w, `{"error":"Failed to parse GitHub CLI output."}`, http.StatusInternalServerError)
		}
	} else {
		http.Error(w, `{"error":"Failed to list pull requests."}`, http.StatusInternalServerError)
	}
}

func HandleGetIssues(w http.ResponseWriter, r *http.Request) {
	owner := r.URL.Query().Get("owner")
	name := r.URL.Query().Get("name")
	if owner == "" || name == "" {
		http.Error(w, `{"error":"Repo owner and name are required."}`, http.StatusBadRequest)
		return
	}

	cmd := fmt.Sprintf(`gh issue list --repo "%s/%s" --json number,title,author,url,createdAt,labels,state --limit 30`, owner, name)
	result := shell.RunCmd(cmd, "")

	w.Header().Set("Content-Type", "application/json")
	if result.Success {
		var list []interface{}
		if err := json.Unmarshal([]byte(result.Stdout), &list); err == nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"issues": list})
		} else {
			http.Error(w, `{"error":"Failed to parse GitHub CLI output."}`, http.StatusInternalServerError)
		}
	} else {
		http.Error(w, `{"error":"Failed to list issues."}`, http.StatusInternalServerError)
	}
}

func HandleGetGitHubContributions(w http.ResponseWriter, r *http.Request) {
	userRes := shell.RunCmd("gh api user --jq .login", "")
	if !userRes.Success || userRes.Stdout == "" {
		http.Error(w, `{"error":"Failed to retrieve authenticated GitHub user."}`, http.StatusInternalServerError)
		return
	}
	username := strings.TrimSpace(userRes.Stdout)

	query := `query($login: String!) {
		user(login: $login) {
			contributionsCollection {
				contributionCalendar {
					totalContributions
					weeks {
						contributionDays {
							contributionCount
							date
							color
						}
					}
				}
			}
		}
	}`

	cleanGql := strings.ReplaceAll(strings.ReplaceAll(query, "\n", " "), "\t", " ")
	gqlRes := shell.RunCmd(fmt.Sprintf(`gh api graphql -f query='%s' -f login='%s'`, cleanGql, username), "")
	if !gqlRes.Success {
		http.Error(w, `{"error":"Failed to fetch contribution graph."}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	var response struct {
		Data struct {
			User struct {
				ContributionsCollection struct {
					ContributionCalendar struct {
						TotalContributions int `json:"totalContributions"`
						Weeks              []struct {
							ContributionDays []struct {
								ContributionCount int    `json:"contributionCount"`
								Date              string `json:"date"`
								Color             string `json:"color"`
							} `json:"contributionDays"`
						} `json:"weeks"`
					} `json:"contributionCalendar"`
				} `json:"contributionsCollection"`
			} `json:"user"`
		} `json:"data"`
	}

	if err := json.Unmarshal([]byte(gqlRes.Stdout), &response); err != nil {
		http.Error(w, `{"error":"Failed to parse contributions graph."}`, http.StatusInternalServerError)
		return
	}

	cal := response.Data.User.ContributionsCollection.ContributionCalendar
	json.NewEncoder(w).Encode(map[string]interface{}{
		"username": username,
		"total":    cal.TotalContributions,
		"weeks":    cal.Weeks,
	})
}

func HandleGetLocalContributions(w http.ResponseWriter, r *http.Request) {
	cfg := config.Read()

	globalEmail := ""
	globalName := ""
	if emailRes := shell.RunCmd("git config --global user.email", ""); emailRes.Success {
		globalEmail = strings.TrimSpace(emailRes.Stdout)
	}
	if nameRes := shell.RunCmd("git config --global user.name", ""); nameRes.Success {
		globalName = strings.TrimSpace(nameRes.Stdout)
	}

	// Build author filter once using global identity
	identities := map[string]bool{}
	for _, val := range []string{globalEmail, globalName} {
		if val != "" {
			identities[val] = true
		}
	}
	if globalName != "" {
		parts := strings.Split(strings.ToLower(globalName), " ")
		if len(parts) > 0 && len(parts[0]) > 3 {
			identities[parts[0]] = true
		}
	}

	// Collect valid local repo paths
	type repoJob struct {
		absPath       string
		authorFilters string
	}
	var jobs []repoJob
	for _, repo := range cfg.Repos {
		if repo.Path == "" {
			continue
		}
		absPath, _ := filepath.Abs(repo.Path)
		if _, err := os.Stat(absPath); err != nil {
			continue
		}
		// Merge local git identity with global
		localIdentities := map[string]bool{}
		for k := range identities {
			localIdentities[k] = true
		}
		if eRes := shell.RunCmd("git config user.email", absPath); eRes.Success {
			v := strings.TrimSpace(eRes.Stdout)
			if v != "" {
				localIdentities[v] = true
			}
		}
		if nRes := shell.RunCmd("git config user.name", absPath); nRes.Success {
			v := strings.TrimSpace(nRes.Stdout)
			if v != "" {
				localIdentities[v] = true
			}
		}
		authorFilters := ""
		for k := range localIdentities {
			authorFilters += fmt.Sprintf(`--author="%s" `, k)
		}
		jobs = append(jobs, repoJob{absPath: absPath, authorFilters: authorFilters})
	}

	// Run git log concurrently across all repos
	type dateResult struct {
		dates []string
	}
	results := make([]dateResult, len(jobs))
	var wg sync.WaitGroup
	for i, job := range jobs {
		wg.Add(1)
		go func(idx int, j repoJob) {
			defer wg.Done()
			cmd := fmt.Sprintf(`git log --all %s --since="1 year ago" --date=short --pretty=format:"%%ad"`, j.authorFilters)
			logRes := shell.RunCmd(cmd, j.absPath)
			if logRes.Success && logRes.Stdout != "" {
				results[idx] = dateResult{dates: strings.Split(logRes.Stdout, "\n")}
			}
		}(i, job)
	}
	wg.Wait()

	// Aggregate commit counts by date
	commitMap := map[string]int{}
	for _, res := range results {
		for _, d := range res.dates {
			dTrim := strings.TrimSpace(d)
			if dTrim != "" {
				commitMap[dTrim]++
			}
		}
	}

	weeks := []interface{}{}
	today := time.Now()
	startDate := today.AddDate(-1, 0, 0)
	// Sunday alignment rollback
	startDay := int(startDate.Weekday())
	startDate = startDate.AddDate(0, 0, -startDay)

	currentDate := startDate
	totalCommits := 0

	for w := 0; w < 53; w++ {
		contributionDays := []map[string]interface{}{}
		for d := 0; d < 7; d++ {
			if currentDate.After(today) {
				break
			}
			dateStr := currentDate.Format("2006-01-02")
			count := commitMap[dateStr]
			totalCommits += count

			color := "rgba(255, 255, 255, 0.04)"
			if count > 0 {
				if count <= 2 {
					color = "#0e4429"
				} else if count <= 5 {
					color = "#006d32"
				} else if count <= 10 {
					color = "#26a641"
				} else {
					color = "#39d353"
				}
			}

			contributionDays = append(contributionDays, map[string]interface{}{
				"contributionCount": count,
				"date":              dateStr,
				"color":             color,
			})
			currentDate = currentDate.AddDate(0, 0, 1)
		}
		if len(contributionDays) > 0 {
			weeks = append(weeks, map[string]interface{}{
				"contributionDays": contributionDays,
			})
		}
		if currentDate.After(today) {
			break
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total": totalCommits,
		"weeks": weeks,
	})
}

// ── SSE Logs Broadcaster (Build Command Execution) ───────────────────────────

func HandleBuildRun(w http.ResponseWriter, r *http.Request) {
	repoPath := r.URL.Query().Get("path")
	script := r.URL.Query().Get("script")
	if repoPath == "" {
		http.Error(w, `{"error":"Repository path is required."}`, http.StatusBadRequest)
		return
	}

	absPath, _ := filepath.Abs(repoPath)
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		http.Error(w, `{"error":"Repository path does not exist."}`, http.StatusNotFound)
		return
	}

	command := "npm run build"
	if script != "" {
		command = fmt.Sprintf("npm run %s", script)
	}

	// Prepare SSE response headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Transfer-Encoding", "chunked")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	sendLog := func(log string) {
		payload, _ := json.Marshal(map[string]string{"log": log})
		fmt.Fprintf(w, "data: %s\n\n", payload)
		flusher.Flush()
	}

	sendLog(fmt.Sprintf("Starting build task: %s in %s\n", command, absPath))

	cmd := exec.Command("sh", "-c", command)
	cmd.Dir = absPath

	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		sendLog(fmt.Sprintf("[ERROR] Failed to obtain stdout: %v\n", err))
		return
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		sendLog(fmt.Sprintf("[ERROR] Failed to obtain stderr: %v\n", err))
		return
	}

	if err := cmd.Start(); err != nil {
		sendLog(fmt.Sprintf("[ERROR] Failed to run command: %v\n", err))
		return
	}

	// Stream stdout & stderr in the background
	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		reader := io.LimitReader(stdoutPipe, 1024*1024) // guard memory
		buf := make([]byte, 2048)
		for {
			n, err := reader.Read(buf)
			if n > 0 {
				sendLog(string(buf[:n]))
			}
			if err != nil {
				break
			}
		}
	}()

	go func() {
		defer wg.Done()
		reader := io.LimitReader(stderrPipe, 1024*1024)
		buf := make([]byte, 2048)
		for {
			n, err := reader.Read(buf)
			if n > 0 {
				sendLog(fmt.Sprintf("[STDERR] %s", string(buf[:n])))
			}
			if err != nil {
				break
			}
		}
	}()

	// Monitor client disconnects
	disconnectChan := r.Context().Done()
	doneChan := make(chan error, 1)

	go func() {
		wg.Wait()
		doneChan <- cmd.Wait()
	}()

	select {
	case <-disconnectChan:
		// Client closed connection
		cmd.Process.Kill()
	case err := <-doneChan:
		exitCode := 0
		if err != nil {
			if exitError, ok := err.(*exec.ExitError); ok {
				exitCode = exitError.ExitCode()
			} else {
				exitCode = 1
			}
		}
		// Send final complete message
		fmt.Fprintf(w, "data: {\"exitCode\":%d,\"done\":true}\n\n", exitCode)
		flusher.Flush()
	}
}

// ── Helpers ──────────────────────────────────────────────────────────────────

func urlPathEncode(str string) string {
	// Custom simple URL segment encoding preserving slashes
	parts := strings.Split(str, "/")
	for i, p := range parts {
		parts[i] = strings.ReplaceAll(p, "%", "%25")
		parts[i] = strings.ReplaceAll(parts[i], " ", "%20")
		parts[i] = strings.ReplaceAll(parts[i], "?", "%3F")
		parts[i] = strings.ReplaceAll(parts[i], "#", "%23")
	}
	return strings.Join(parts, "/")
}

func HandleGetProfile(w http.ResponseWriter, r *http.Request) {
	// 1. Fetch GitHub CLI User info (expanded fields)
	var githubUser, githubAvatar, githubEmail string
	var githubBio, githubLocation, githubCompany, githubCreatedAt, githubPlan string
	var githubFollowers, githubFollowing, sshKeyCount int

	userRes := shell.RunCmd(`gh api user --jq '{login: .login, avatar: .avatar_url, email: .email, bio: .bio, followers: .followers, following: .following, location: .location, company: .company, created_at: .created_at, plan: .plan.name}'`, "")
	if userRes.Success && userRes.Stdout != "" {
		var u struct {
			Login     string `json:"login"`
			Avatar    string `json:"avatar"`
			Email     string `json:"email"`
			Bio       string `json:"bio"`
			Followers int    `json:"followers"`
			Following int    `json:"following"`
			Location  string `json:"location"`
			Company   string `json:"company"`
			CreatedAt string `json:"created_at"`
			Plan      string `json:"plan"`
		}
		if err := json.Unmarshal([]byte(userRes.Stdout), &u); err == nil {
			githubUser = u.Login
			githubAvatar = u.Avatar
			githubEmail = u.Email
			githubBio = u.Bio
			githubFollowers = u.Followers
			githubFollowing = u.Following
			githubLocation = u.Location
			githubCompany = u.Company
			githubCreatedAt = u.CreatedAt
			githubPlan = u.Plan
		}
	}

	// 2. SSH Key count
	if sshRes := shell.RunCmd(`gh ssh-key list --json id`, ""); sshRes.Success && sshRes.Stdout != "" && sshRes.Stdout != "[]" {
		var keys []struct{ ID int `json:"id"` }
		if err := json.Unmarshal([]byte(sshRes.Stdout), &keys); err == nil {
			sshKeyCount = len(keys)
		}
	}

	// 3. Fetch Global Git Identity
	var gitName, gitEmail string
	if res := shell.RunCmd("git config --global user.name", ""); res.Success {
		gitName = strings.TrimSpace(res.Stdout)
	}
	if res := shell.RunCmd("git config --global user.email", ""); res.Success {
		gitEmail = strings.TrimSpace(res.Stdout)
	}

	// Email mismatch: GitHub CLI email vs. git global email
	emailMismatch := githubEmail != "" && gitEmail != "" &&
		strings.ToLower(strings.TrimSpace(githubEmail)) != strings.ToLower(strings.TrimSpace(gitEmail))

	// 4. Fetch CLI Diagnostic Data
	var gitVer, ghVer string
	if res := shell.RunCmd("git version", ""); res.Success {
		gitVer = strings.TrimSpace(res.Stdout)
	}
	if res := shell.RunCmd("gh --version | head -1", ""); res.Success {
		ghVer = strings.TrimSpace(res.Stdout)
	}

	// Dynamic OS and shell detection
	detectedOS := runtime.GOOS
	detectedShell := os.Getenv("SHELL")
	if detectedShell == "" {
		detectedShell = "unknown"
	} else {
		// Show only the basename (e.g. "zsh", "bash")
		parts := strings.Split(detectedShell, "/")
		detectedShell = parts[len(parts)-1]
	}

	// 5. Query runtime engine versions dynamically
	runtimes := map[string]string{
		"go":       "Not Installed",
		"node":     "Not Installed",
		"npm":      "Not Installed",
		"python":   "Not Installed",
		"postgres": "Not Installed",
		"mongo":    "Not Installed",
		"redis":    "Not Installed",
		"docker":   "Not Installed",
		"brew":     "Not Installed",
		"bun":      "Not Installed",
		"rust":     "Not Installed",
	}

	if res := shell.RunCmd("go version", ""); res.Success {
		runtimes["go"] = strings.TrimSpace(res.Stdout)
	}
	if res := shell.RunCmd("node --version", ""); res.Success {
		runtimes["node"] = strings.TrimSpace(res.Stdout)
	}
	if res := shell.RunCmd("npm --version", ""); res.Success {
		runtimes["npm"] = strings.TrimSpace(res.Stdout)
	}
	// Try python3 first, fallback to python
	if res := shell.RunCmd("python3 --version", ""); res.Success {
		runtimes["python"] = strings.TrimSpace(res.Stdout)
	} else if res := shell.RunCmd("python --version", ""); res.Success {
		runtimes["python"] = strings.TrimSpace(res.Stdout)
	}
	if res := shell.RunCmd("postgres --version", ""); res.Success {
		runtimes["postgres"] = strings.TrimSpace(res.Stdout)
	} else if res := shell.RunCmd("pg_config --version", ""); res.Success {
		runtimes["postgres"] = strings.TrimSpace(res.Stdout)
	}
	if res := shell.RunCmd("mongod --version | head -1", ""); res.Success {
		runtimes["mongo"] = strings.TrimSpace(res.Stdout)
	} else if res := shell.RunCmd("mongo --version | head -1", ""); res.Success {
		runtimes["mongo"] = strings.TrimSpace(res.Stdout)
	}
	if res := shell.RunCmd("redis-server --version", ""); res.Success {
		parts := strings.Split(res.Stdout, " ")
		if len(parts) >= 3 {
			runtimes["redis"] = parts[0] + " " + parts[1] + " " + parts[2]
		} else {
			runtimes["redis"] = strings.TrimSpace(res.Stdout)
		}
	}
	if res := shell.RunCmd("docker --version", ""); res.Success {
		runtimes["docker"] = strings.TrimSpace(res.Stdout)
	}
	if res := shell.RunCmd("brew --version", ""); res.Success {
		// Only take the first line
		lines := strings.Split(strings.TrimSpace(res.Stdout), "\n")
		runtimes["brew"] = lines[0]
	}
	if res := shell.RunCmd("bun --version", ""); res.Success {
		runtimes["bun"] = strings.TrimSpace(res.Stdout)
	}
	if res := shell.RunCmd("rustc --version", ""); res.Success {
		runtimes["rust"] = strings.TrimSpace(res.Stdout)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"github": map[string]interface{}{
			"username":    githubUser,
			"avatarUrl":   githubAvatar,
			"email":       githubEmail,
			"bio":         githubBio,
			"followers":   githubFollowers,
			"following":   githubFollowing,
			"location":    githubLocation,
			"company":     githubCompany,
			"createdAt":   githubCreatedAt,
			"plan":        githubPlan,
			"sshKeyCount": sshKeyCount,
		},
		"git": map[string]interface{}{
			"globalName":    gitName,
			"globalEmail":   gitEmail,
			"emailMismatch": emailMismatch,
		},
		"diagnostics": map[string]interface{}{
			"gitVersion": strings.TrimPrefix(gitVer, "git version "),
			"ghVersion":  ghVer,
			"os":         detectedOS,
			"shell":      detectedShell,
		},
		"runtimes": runtimes,
	})
}

func HandlePostProfileGit(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name  string `json:"name"`
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"Invalid request payload."}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if body.Name != "" {
		res := shell.RunCmd(fmt.Sprintf(`git config --global user.name "%s"`, body.Name), "")
		if !res.Success {
			http.Error(w, `{"error":"Failed to set global Git user.name."}`, http.StatusInternalServerError)
			return
		}
	}
	if body.Email != "" {
		res := shell.RunCmd(fmt.Sprintf(`git config --global user.email "%s"`, body.Email), "")
		if !res.Success {
			http.Error(w, `{"error":"Failed to set global Git user.email."}`, http.StatusInternalServerError)
			return
		}
	}

	w.Write([]byte(`{"success":true,"message":"Global Git identity configured successfully."}`))
}

func HandleGetPlans(w http.ResponseWriter, r *http.Request) {
	project := r.URL.Query().Get("project")
	db := plans.Read()
	filtered := []plans.Plan{}
	for _, p := range db.Plans {
		if project == "" || p.Project == project {
			filtered = append(filtered, p)
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(filtered)
}

func HandlePostPlan(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Project     string   `json:"project"`
		Title       string   `json:"title"`
		Description string   `json:"description"`
		Tags        []string `json:"tags"`
		Status      string   `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Project == "" || body.Title == "" {
		http.Error(w, `{"error":"Invalid payload. project and title are required."}`, http.StatusBadRequest)
		return
	}

	created := plans.Add(body.Project, body.Title, body.Description, body.Tags, body.Status)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
}

func HandlePutPlan(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ID          string   `json:"id"`
		Title       string   `json:"title"`
		Description string   `json:"description"`
		Tags        []string `json:"tags"`
		Status      string   `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.ID == "" {
		http.Error(w, `{"error":"Invalid payload. id is required."}`, http.StatusBadRequest)
		return
	}

	updated, found := plans.Update(body.ID, body.Title, body.Description, body.Tags, body.Status)
	if !found {
		http.Error(w, `{"error":"Plan not found."}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

func HandleDeletePlan(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, `{"error":"id query parameter is required."}`, http.StatusBadRequest)
		return
	}

	if removed := plans.Delete(id); !removed {
		http.Error(w, `{"error":"Plan not found."}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"success":true}`))
}

func HandlePromotePlan(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.ID == "" {
		http.Error(w, `{"error":"Invalid payload. id is required."}`, http.StatusBadRequest)
		return
	}

	db := plans.Read()
	var target plans.Plan
	found := false
	for _, p := range db.Plans {
		if p.ID == body.ID {
			target = p
			found = true
			break
		}
	}
	if !found {
		http.Error(w, `{"error":"Plan not found."}`, http.StatusNotFound)
		return
	}

	// Figure out local path or repo name from config to identify where to run `gh issue create`
	cfg := config.Read()
	var repoPath string
	var ownerName string

	for _, repo := range cfg.Repos {
		key := repo.Path
		if key == "" {
			key = fmt.Sprintf("%s/%s", repo.Owner, repo.Name)
		}
		if key == target.Project {
			repoPath = repo.Path
			ownerName = fmt.Sprintf("%s/%s", repo.Owner, repo.Name)
			break
		}
	}

	// Build the CLI execution string
	cmdStr := fmt.Sprintf(`gh issue create -t "%s" -b "%s"`, strings.ReplaceAll(target.Title, `"`, `\"`), strings.ReplaceAll(target.Description, `"`, `\"`))
	if repoPath == "" && ownerName != "" {
		// Remote/web project, target explicitly
		cmdStr += fmt.Sprintf(` -R "%s"`, ownerName)
	}

	res := shell.RunCmd(cmdStr, repoPath)
	if !res.Success {
		http.Error(w, fmt.Sprintf(`{"error":"GitHub CLI failed: %s"}`, strings.ReplaceAll(res.Stderr, `"`, `\"`)), http.StatusInternalServerError)
		return
	}

	// Stdout has the created issue URL
	issueURL := strings.TrimSpace(res.Stdout)
	if issueURL == "" {
		http.Error(w, `{"error":"GitHub CLI created the issue but did not return a URL."}`, http.StatusInternalServerError)
		return
	}

	plans.SetIssueURL(target.ID, issueURL)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"issueUrl": issueURL,
	})
}

// HandleGetProviderDisk scans ~/.<provider> directory and returns disk usage breakdown.
func HandleGetProviderDisk(w http.ResponseWriter, r *http.Request) {
	provider := r.PathValue("provider")
	if provider == "" {
		http.Error(w, "Provider is required", http.StatusBadRequest)
		return
	}
	homedir, err := os.UserHomeDir()
	if err != nil {
		http.Error(w, "Cannot resolve home dir", http.StatusInternalServerError)
		return
	}
	providerDir := filepath.Join(homedir, "."+provider)

	type SubDir struct {
		Name string `json:"name"`
		Size int64  `json:"size"`
	}
	type FileType struct {
		Extension string `json:"extension"`
		Count     int    `json:"count"`
		Size      int64  `json:"size"`
	}
	type Conversation struct {
		Name     string `json:"name"`
		Size     int64  `json:"size"`
		Modified string `json:"modified"`
	}

	// Total size
	totalSize := int64(0)
	filepath.Walk(providerDir, func(path string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			totalSize += info.Size()
		}
		return nil
	})

	// Subdirectories
	subdirs := []SubDir{}
	if entries, err := os.ReadDir(providerDir); err == nil {
		for _, e := range entries {
			if e.IsDir() {
				subPath := filepath.Join(providerDir, e.Name())
				dirSize := int64(0)
				filepath.Walk(subPath, func(p string, fi os.FileInfo, err error) error {
					if err == nil && !fi.IsDir() {
						dirSize += fi.Size()
					}
					return nil
				})
				subdirs = append(subdirs, SubDir{Name: e.Name(), Size: dirSize})
			}
		}
	}

	// File type breakdown
	mediaExts := []string{"webp", "png", "jpg", "jpeg", "webm", "mp4", "jsonl", "md", "json", "log"}
	fileTypes := []FileType{}
	for _, ext := range mediaExts {
		count := 0
		size := int64(0)
		filepath.Walk(providerDir, func(path string, info os.FileInfo, err error) error {
			if err == nil && !info.IsDir() && strings.ToLower(filepath.Ext(path)) == "."+ext {
				count++
				size += info.Size()
			}
			return nil
		})
		fileTypes = append(fileTypes, FileType{Extension: ext, Count: count, Size: size})
	}

	// Top conversations from brain dir
	conversations := []Conversation{}
	brainDir := filepath.Join(providerDir, "antigravity-ide", "brain")
	if entries, err := os.ReadDir(brainDir); err == nil {
		for _, e := range entries {
			if e.IsDir() {
				convPath := filepath.Join(brainDir, e.Name())
				convSize := int64(0)
				var lastMod time.Time
				filepath.Walk(convPath, func(p string, fi os.FileInfo, err error) error {
					if err == nil && !fi.IsDir() {
						convSize += fi.Size()
						if fi.ModTime().After(lastMod) {
							lastMod = fi.ModTime()
						}
					}
					return nil
				})
				modStr := ""
				if !lastMod.IsZero() {
					modStr = lastMod.Format("2006-01-02 15:04:05")
				}
				conversations = append(conversations, Conversation{Name: e.Name(), Size: convSize, Modified: modStr})
			}
		}
	}

	// Sort conversations by size desc, keep top 10
	for i := 0; i < len(conversations); i++ {
		for j := i + 1; j < len(conversations); j++ {
			if conversations[j].Size > conversations[i].Size {
				conversations[i], conversations[j] = conversations[j], conversations[i]
			}
		}
	}
	if len(conversations) > 10 {
		conversations = conversations[:10]
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"lastUpdated":      time.Now().Format("2006-01-02 15:04:05"),
		"totalSize":        totalSize,
		"subdirectories":   subdirs,
		"fileTypes":        fileTypes,
		"topConversations": conversations,
	})
}

// HandleDeleteProviderMedia deletes all browser recording/screenshot media files from ~/.<provider>.
func HandleDeleteProviderMedia(w http.ResponseWriter, r *http.Request) {
	provider := r.PathValue("provider")
	if provider == "" {
		http.Error(w, "Provider is required", http.StatusBadRequest)
		return
	}
	homedir, err := os.UserHomeDir()
	if err != nil {
		http.Error(w, "Cannot resolve home dir", http.StatusInternalServerError)
		return
	}
	providerDir := filepath.Join(homedir, "."+provider)
	mediaExts := map[string]bool{
		".webp": true, ".png": true, ".jpg": true,
		".jpeg": true, ".webm": true, ".mp4": true,
	}

	deleted := 0
	freedBytes := int64(0)
	filepath.Walk(providerDir, func(path string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			if mediaExts[strings.ToLower(filepath.Ext(path))] {
				freedBytes += info.Size()
				if removeErr := os.Remove(path); removeErr == nil {
					deleted++
				}
			}
		}
		return nil
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"deleted":    deleted,
		"freedBytes": freedBytes,
	})
}
