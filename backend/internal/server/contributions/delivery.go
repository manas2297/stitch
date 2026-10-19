package contributions

import (
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"stitch/internal/config"
	"stitch/internal/models"
	"stitch/internal/server/helpers"
	"stitch/internal/shell"
)

const defaultActiveDaysPerWeek = 5

// ghJSON runs a gh command and decodes its JSON output, returning an empty list on failure.
func ghJSON(cmd string, dir string) []map[string]interface{} {
	out := []map[string]interface{}{}
	if res := shell.RunCmd(cmd, dir); res.Success && res.Stdout != "" {
		json.Unmarshal([]byte(res.Stdout), &out)
	}
	return out
}

// focusRepoTarget resolves the configured focus project to a GitHub repo and branch.
func focusRepoTarget(cfg models.Config) (repo string, branch string) {
	focus := cfg.FocusProject
	if focus == "" {
		return "", ""
	}
	if strings.Contains(focus, "/") && !strings.HasPrefix(focus, "/") && !strings.HasPrefix(focus, ".") {
		return focus, ""
	}
	absPath, _ := filepath.Abs(focus)
	owner, name := shell.GetRepoInfoFromGit(absPath)
	if owner == "" || name == "" {
		return "", ""
	}
	if res := shell.RunCmd("git branch --show-current", absPath); res.Success {
		branch = strings.TrimSpace(res.Stdout)
	}
	return owner + "/" + name, branch
}

// HandleGetDelivery gathers what's waiting on the user and how fast their PRs ship.
func HandleGetDelivery(w http.ResponseWriter, r *http.Request) {
	cfg := config.Read()
	since := time.Now().AddDate(-1, 0, 0).Format("2006-01-02")

	var (
		wg             sync.WaitGroup
		authoredOpen   []map[string]interface{}
		reviewRequests []map[string]interface{}
		merged         []map[string]interface{}
		assignedIssues []map[string]interface{}
		runs           []map[string]interface{}
	)
	focusRepo, focusBranch := focusRepoTarget(cfg)

	jobs := []func(){
		func() {
			authoredOpen = ghJSON(`gh search prs --author=@me --state=open --limit=50 --json number,title,repository,url,createdAt,updatedAt,isDraft`, "")
		},
		func() {
			reviewRequests = ghJSON(`gh search prs --review-requested=@me --state=open --limit=30 --json number,title,repository,url,createdAt,author`, "")
		},
		func() {
			merged = ghJSON(fmt.Sprintf(`gh search prs --author=@me --merged --merged-at=">=%s" --limit=200 --json number,title,repository,url,createdAt,closedAt`, since), "")
		},
		func() {
			assignedIssues = ghJSON(`gh search issues --assignee=@me --state=open --limit=50 --json number,title,repository,url,createdAt,updatedAt`, "")
		},
		func() {
			if focusRepo == "" {
				return
			}
			cmd := fmt.Sprintf(`gh run list -R "%s" --limit 10 --json status,conclusion,workflowName,displayTitle,url,headBranch,createdAt`, focusRepo)
			runs = ghJSON(cmd, "")
		},
	}
	for _, job := range jobs {
		wg.Add(1)
		go func(f func()) {
			defer wg.Done()
			f()
		}(job)
	}
	wg.Wait()

	helpers.WriteJSONResponse(w, map[string]interface{}{
		"authoredOpen":   authoredOpen,
		"reviewRequests": reviewRequests,
		"merged":         merged,
		"assignedIssues": assignedIssues,
		"focus": map[string]interface{}{
			"repo":   focusRepo,
			"branch": focusBranch,
			"runs":   runs,
		},
	})
}

func goalsOrDefault(cfg models.Config) models.Goals {
	if cfg.Goals == nil || cfg.Goals.ActiveDaysPerWeek < 1 || cfg.Goals.ActiveDaysPerWeek > 7 {
		return models.Goals{ActiveDaysPerWeek: defaultActiveDaysPerWeek}
	}
	return *cfg.Goals
}

func HandleGetGoals(w http.ResponseWriter, r *http.Request) {
	helpers.WriteJSONResponse(w, goalsOrDefault(config.Read()))
}

func HandlePostGoals(w http.ResponseWriter, r *http.Request) {
	var body models.Goals
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		helpers.WriteJSONError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if body.ActiveDaysPerWeek < 1 || body.ActiveDaysPerWeek > 7 {
		helpers.WriteJSONError(w, "activeDaysPerWeek must be between 1 and 7", http.StatusBadRequest)
		return
	}

	cfg := config.Read()
	cfg.Goals = &body
	if !config.Write(cfg) {
		helpers.WriteJSONError(w, "Failed to save goals.", http.StatusInternalServerError)
		return
	}
	helpers.WriteJSONResponse(w, body)
}
