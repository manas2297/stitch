package contributions

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"stitch/internal/config"
	"stitch/internal/server/helpers"
	"stitch/internal/shell"
)

// contributionWindow is GitHub's per-type breakdown for one date range.
type contributionWindow struct {
	Commits      int `json:"commits"`
	PullRequests int `json:"pullRequests"`
	Reviews      int `json:"reviews"`
	Issues       int `json:"issues"`
	Repositories int `json:"repositories"`
	Private      int `json:"private"`
	ByRepository []struct {
		Repository struct {
			NameWithOwner string `json:"nameWithOwner"`
			Name          string `json:"name"`
			URL           string `json:"url"`
			IsPrivate     bool   `json:"isPrivate"`
		} `json:"repository"`
		Contributions struct {
			TotalCount int `json:"totalCount"`
		} `json:"contributions"`
	} `json:"byRepository"`
}

// GraphQL aliases map the collection fields onto contributionWindow's JSON names.
const windowFields = `
	commits: totalCommitContributions
	pullRequests: totalPullRequestContributions
	reviews: totalPullRequestReviewContributions
	issues: totalIssueContributions
	repositories: totalRepositoryContributions
	private: restrictedContributionsCount
	byRepository: commitContributionsByRepository(maxRepositories: 10) {
		repository { nameWithOwner name url isPrivate }
		contributions { totalCount }
	}`

func HandleGetGitHubContributions(w http.ResponseWriter, r *http.Request) {
	userRes := shell.RunCmd("gh api user --jq .login", "")
	if !userRes.Success || userRes.Stdout == "" {
		helpers.WriteJSONError(w, "Failed to retrieve authenticated GitHub user.", http.StatusInternalServerError)
		return
	}
	username := strings.TrimSpace(userRes.Stdout)

	// The default collection spans the past year; month and quarter are explicit windows.
	query := `query($login: String!, $month: DateTime!, $quarter: DateTime!) {
		user(login: $login) {
			year: contributionsCollection {
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
				` + windowFields + `
			}
			month: contributionsCollection(from: $month) {` + windowFields + `}
			quarter: contributionsCollection(from: $quarter) {` + windowFields + `}
		}
	}`

	now := time.Now().UTC()
	month := now.AddDate(0, 0, -30).Format(time.RFC3339)
	quarter := now.AddDate(0, 0, -90).Format(time.RFC3339)

	cleanGql := strings.Join(strings.Fields(query), " ")
	gqlRes := shell.RunCmd(fmt.Sprintf(`gh api graphql -f query='%s' -f login='%s' -f month='%s' -f quarter='%s'`,
		cleanGql, username, month, quarter), "")
	if !gqlRes.Success {
		helpers.WriteJSONError(w, "Failed to fetch contribution graph.", http.StatusInternalServerError)
		return
	}

	var response struct {
		Data struct {
			User struct {
				Year struct {
					contributionWindow
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
				} `json:"year"`
				Month   contributionWindow `json:"month"`
				Quarter contributionWindow `json:"quarter"`
			} `json:"user"`
		} `json:"data"`
	}

	if err := json.Unmarshal([]byte(gqlRes.Stdout), &response); err != nil {
		helpers.WriteJSONError(w, "Failed to parse contributions graph.", http.StatusInternalServerError)
		return
	}

	u := response.Data.User
	cal := u.Year.ContributionCalendar
	helpers.WriteJSONResponse(w, map[string]interface{}{
		"username": username,
		"total":    cal.TotalContributions,
		"weeks":    cal.Weeks,
		"windows": map[string]contributionWindow{
			"30":  u.Month,
			"90":  u.Quarter,
			"365": u.Year.contributionWindow,
		},
	})
}

// localCommit is one of the user's own commits; short keys keep a year of history compact.
type localCommit struct {
	Date      string `json:"d"`
	Hour      int    `json:"h"`
	Repo      int    `json:"r"`
	Additions int    `json:"a"`
	Deletions int    `json:"x"`
	// Lines changed per language key (file extension or well-known filename)
	Languages map[string]int `json:"l,omitempty"`
}

// localRepoPulse is the working-copy health of a tracked local repository.
type localRepoPulse struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	LastCommit  string `json:"lastCommit"`
	Uncommitted int    `json:"uncommitted"`
	Unpushed    int    `json:"unpushed"`
	HasUpstream bool   `json:"hasUpstream"`
}

// Lockfiles, vendored and built output inflate line counts without being real work.
var generatedNames = map[string]bool{
	"package-lock.json": true, "yarn.lock": true, "pnpm-lock.yaml": true, "bun.lockb": true,
	"go.sum": true, "cargo.lock": true, "poetry.lock": true, "composer.lock": true,
	"gemfile.lock": true, "podfile.lock": true, "pubspec.lock": true, "flake.lock": true,
}

var generatedDirs = []string{"node_modules/", "vendor/", "dist/", "build/", ".next/", "coverage/", "__snapshots__/"}

func isGenerated(path string) bool {
	lower := strings.ToLower(path)
	base := lower[strings.LastIndex(lower, "/")+1:]
	if generatedNames[base] || strings.HasSuffix(base, ".min.js") || strings.HasSuffix(base, ".min.css") || strings.HasSuffix(base, ".map") || strings.HasSuffix(base, ".snap") {
		return true
	}
	for _, dir := range generatedDirs {
		if strings.HasPrefix(lower, dir) || strings.Contains(lower, "/"+dir) {
			return true
		}
	}
	return false
}

// languageKey maps a numstat path to an extension ("tsx") or a known extensionless name ("dockerfile").
func languageKey(path string) string {
	// Renames look like "src/{old => new}/a.ts" or "a.go => b.go"; the new name is last.
	if i := strings.LastIndex(path, " => "); i >= 0 {
		path = strings.TrimRight(path[i+4:], "}")
	}
	base := strings.ToLower(path[strings.LastIndex(path, "/")+1:])
	if i := strings.LastIndex(base, "."); i > 0 && i < len(base)-1 {
		return base[i+1:]
	}
	switch base {
	case "dockerfile", "makefile", "justfile", "procfile":
		return base
	}
	return "other"
}

// parseCommitLog reads `--pretty=format:@%ad --numstat` output, where each
// commit is an "@YYYY-MM-DD HH" header followed by "added<TAB>deleted<TAB>path" lines.
func parseCommitLog(out string, repoIdx int) []localCommit {
	var commits []localCommit
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "@") {
			parts := strings.Fields(strings.TrimPrefix(line, "@"))
			if len(parts) == 0 {
				continue
			}
			c := localCommit{Date: parts[0], Repo: repoIdx}
			if len(parts) > 1 {
				c.Hour, _ = strconv.Atoi(parts[1])
			}
			commits = append(commits, c)
			continue
		}
		fields := strings.SplitN(line, "\t", 3)
		if len(commits) == 0 || len(fields) != 3 || isGenerated(fields[2]) {
			continue
		}
		added, errA := strconv.Atoi(fields[0])
		deleted, errD := strconv.Atoi(fields[1])
		if errA != nil || errD != nil { // binary files report "-"
			continue
		}
		last := &commits[len(commits)-1]
		last.Additions += added
		last.Deletions += deleted
		if last.Languages == nil {
			last.Languages = map[string]int{}
		}
		last.Languages[languageKey(fields[2])] += added + deleted
	}
	return commits
}

func countLines(s string) int {
	if strings.TrimSpace(s) == "" {
		return 0
	}
	return len(strings.Split(strings.TrimSpace(s), "\n"))
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

	commitsByRepo := make([][]localCommit, len(jobs))
	pulses := make([]localRepoPulse, len(jobs))
	var wg sync.WaitGroup
	for i, job := range jobs {
		wg.Add(1)
		go func(idx int, j repoJob) {
			defer wg.Done()
			// format-local buckets hours on this machine's clock, matching "today" below.
			cmd := fmt.Sprintf(`git log --all --no-merges %s --since="1 year ago" --date=format-local:"%%Y-%%m-%%d %%H" --pretty=format:"@%%ad" --numstat`, j.authorFilters)
			if logRes := shell.RunCmd(cmd, j.absPath); logRes.Success && logRes.Stdout != "" {
				commitsByRepo[idx] = parseCommitLog(logRes.Stdout, idx)
			}

			p := localRepoPulse{Name: filepath.Base(j.absPath), Path: j.absPath}
			if res := shell.RunCmd(`git log -1 --format=%cI`, j.absPath); res.Success {
				p.LastCommit = strings.TrimSpace(res.Stdout)
			}
			if res := shell.RunCmd("git status --porcelain", j.absPath); res.Success {
				p.Uncommitted = countLines(res.Stdout)
			}
			if res := shell.RunCmd("git rev-list --count @{u}..HEAD", j.absPath); res.Success {
				p.HasUpstream = true
				p.Unpushed, _ = strconv.Atoi(strings.TrimSpace(res.Stdout))
			}
			pulses[idx] = p
		}(i, job)
	}
	wg.Wait()

	commits := []localCommit{}
	commitMap := map[string]int{}
	for _, list := range commitsByRepo {
		for _, c := range list {
			commits = append(commits, c)
			commitMap[c.Date]++
		}
	}

	weeks := []interface{}{}
	today := time.Now()
	startDate := today.AddDate(-1, 0, 0)
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
			contributionDays = append(contributionDays, map[string]interface{}{
				"contributionCount": count,
				"date":              dateStr,
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

	helpers.WriteJSONResponse(w, map[string]interface{}{
		"total":   totalCommits,
		"weeks":   weeks,
		"commits": commits,
		"repos":   pulses,
	})
}
