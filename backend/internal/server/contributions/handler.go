package contributions

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"stitch/internal/config"
	"stitch/internal/server/helpers"
	"stitch/internal/shell"
)

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

	helpers.WriteJSONResponse(w, map[string]interface{}{"prs": prs, "issues": issues})
}

func HandleGetPrs(w http.ResponseWriter, r *http.Request) {
	owner := r.URL.Query().Get("owner")
	name := r.URL.Query().Get("name")
	if owner == "" || name == "" {
		helpers.WriteJSONError(w, "Repo owner and name are required.", http.StatusBadRequest)
		return
	}

	cmd := fmt.Sprintf(`gh pr list --repo "%s/%s" --json number,title,author,url,createdAt,reviewRequests,reviewDecision,mergeable --limit 30`, owner, name)
	result := shell.RunCmd(cmd, "")

	if result.Success {
		var prList []interface{}
		if err := json.Unmarshal([]byte(result.Stdout), &prList); err == nil {
			helpers.WriteJSONResponse(w, map[string]interface{}{"prs": prList})
		} else {
			helpers.WriteJSONError(w, "Failed to parse GitHub CLI output.", http.StatusInternalServerError)
		}
	} else {
		helpers.WriteJSONError(w, "Failed to list pull requests.", http.StatusInternalServerError)
	}
}

func HandleGetIssues(w http.ResponseWriter, r *http.Request) {
	owner := r.URL.Query().Get("owner")
	name := r.URL.Query().Get("name")
	if owner == "" || name == "" {
		helpers.WriteJSONError(w, "Repo owner and name are required.", http.StatusBadRequest)
		return
	}

	cmd := fmt.Sprintf(`gh issue list --repo "%s/%s" --json number,title,author,url,createdAt,labels,state --limit 30`, owner, name)
	result := shell.RunCmd(cmd, "")

	if result.Success {
		var list []interface{}
		if err := json.Unmarshal([]byte(result.Stdout), &list); err == nil {
			helpers.WriteJSONResponse(w, map[string]interface{}{"issues": list})
		} else {
			helpers.WriteJSONError(w, "Failed to parse GitHub CLI output.", http.StatusInternalServerError)
		}
	} else {
		helpers.WriteJSONError(w, "Failed to list issues.", http.StatusInternalServerError)
	}
}

func HandleGetGitHubContributions(w http.ResponseWriter, r *http.Request) {
	userRes := shell.RunCmd("gh api user --jq .login", "")
	if !userRes.Success || userRes.Stdout == "" {
		helpers.WriteJSONError(w, "Failed to retrieve authenticated GitHub user.", http.StatusInternalServerError)
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
		helpers.WriteJSONError(w, "Failed to fetch contribution graph.", http.StatusInternalServerError)
		return
	}

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
		helpers.WriteJSONError(w, "Failed to parse contributions graph.", http.StatusInternalServerError)
		return
	}

	cal := response.Data.User.ContributionsCollection.ContributionCalendar
	helpers.WriteJSONResponse(w, map[string]interface{}{
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

	helpers.WriteJSONResponse(w, map[string]interface{}{
		"total": totalCommits,
		"weeks": weeks,
	})
}
