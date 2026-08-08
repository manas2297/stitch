package repos

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"stitch/internal/config"
	"stitch/internal/models"
	"stitch/internal/server/helpers"
	"stitch/internal/shell"
)

func HandleGetRepos(w http.ResponseWriter, r *http.Request) {
	cfg := config.Read()
	var currentGitHubUser string
	var githubRepoCount int

	userRes := shell.RunCmd("gh api user --jq '{login: .login, public_repos: .public_repos, total_private_repos: .total_private_repos}'", "")
	if userRes.Success && userRes.Stdout != "" {
		var u struct {
			Login             string `json:"login"`
			PublicRepos       int    `json:"public_repos"`
			TotalPrivateRepos int    `json:"total_private_repos"`
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

	helpers.WriteJSONResponse(w, map[string]interface{}{
		"repos":           updatedRepos,
		"focusProject":    cfg.FocusProject,
		"currentUser":     currentGitHubUser,
		"tabEnergies":     tabEnergies,
		"githubRepoCount": githubRepoCount,
	})
}

func HandlePostTabEnergies(w http.ResponseWriter, r *http.Request) {
	var body map[string]string
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		helpers.WriteJSONError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	cfg := config.Read()
	cfg.TabEnergies = body
	config.Write(cfg)

	helpers.WriteJSONResponse(w, map[string]interface{}{
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
		helpers.WriteJSONError(w, "Repository path or owner/repo string is required.", http.StatusBadRequest)
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
			helpers.WriteJSONError(w, "Invalid web repository format. Use owner/name", http.StatusBadRequest)
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
			helpers.WriteJSONError(w, fmt.Sprintf("Path does not exist: %s", absPath), http.StatusBadRequest)
			return
		}

		existingIndex := -1
		for idx, r := range cfg.Repos {
			if r.Path != "" {
				rAbs, _ := filepath.Abs(r.Path)
				if strings.EqualFold(rAbs, absPath) {
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
		helpers.WriteJSONResponse(w, map[string]interface{}{"success": true, "repo": repoData})
	} else {
		helpers.WriteJSONError(w, "Failed to save config.", http.StatusInternalServerError)
	}
}

func HandleDeleteRepos(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path  string `json:"path"`
		Owner string `json:"owner"`
		Name  string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		helpers.WriteJSONError(w, "Request parsing failed.", http.StatusBadRequest)
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
				if strings.EqualFold(rAbs, absBodyPath) {
					found = true
					continue
				}
			}
			filtered = append(filtered, r)
		}
		fAbs, _ := filepath.Abs(cfg.FocusProject)
		if cfg.FocusProject != "" && strings.EqualFold(fAbs, absBodyPath) {
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
		helpers.WriteJSONError(w, "Repository not found in config.", http.StatusNotFound)
		return
	}

	cfg.Repos = filtered
	if config.Write(cfg) {
		helpers.WriteJSONResponse(w, map[string]interface{}{"success": true})
	} else {
		helpers.WriteJSONError(w, "Failed to update config.", http.StatusInternalServerError)
	}
}

func HandleToggleMajor(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path  string `json:"path"`
		Owner string `json:"owner"`
		Name  string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		helpers.WriteJSONError(w, "Request parsing failed.", http.StatusBadRequest)
		return
	}

	cfg := config.Read()
	index := -1

	if body.Path != "" {
		absBodyPath, _ := filepath.Abs(body.Path)
		for idx, r := range cfg.Repos {
			if r.Path != "" {
				rAbs, _ := filepath.Abs(r.Path)
				if strings.EqualFold(rAbs, absBodyPath) {
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
		helpers.WriteJSONError(w, "Repo not found", http.StatusNotFound)
		return
	}

	cfg.Repos[index].IsMajorProject = !cfg.Repos[index].IsMajorProject
	config.Write(cfg)

	helpers.WriteJSONResponse(w, map[string]interface{}{"success": true, "repo": cfg.Repos[index]})
}

func HandleSetFocus(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path  string `json:"path"`
		Owner string `json:"owner"`
		Name  string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		helpers.WriteJSONError(w, "Request parsing failed.", http.StatusBadRequest)
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
	helpers.WriteJSONResponse(w, map[string]interface{}{"success": true, "focusProject": cfg.FocusProject})
}
