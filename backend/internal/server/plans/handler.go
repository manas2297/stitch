package plans

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"strings"

	"stitch/internal/config"
	internalPlans "stitch/internal/plans"
	"stitch/internal/server/helpers"
)

func HandleGetPlans(w http.ResponseWriter, r *http.Request) {
	project := r.URL.Query().Get("project")
	db := internalPlans.Read()
	filtered := []internalPlans.Plan{}
	for _, p := range db.Plans {
		if project == "" || p.Project == project {
			filtered = append(filtered, p)
		}
	}
	helpers.WriteJSONResponse(w, filtered)
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
		helpers.WriteJSONError(w, "Invalid payload. project and title are required.", http.StatusBadRequest)
		return
	}

	created := internalPlans.Add(body.Project, body.Title, body.Description, body.Tags, body.Status)
	w.WriteHeader(http.StatusCreated)
	helpers.WriteJSONResponse(w, created)
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
		helpers.WriteJSONError(w, "Invalid payload. id is required.", http.StatusBadRequest)
		return
	}

	updated, found := internalPlans.Update(body.ID, body.Title, body.Description, body.Tags, body.Status)
	if !found {
		helpers.WriteJSONError(w, "Plan not found.", http.StatusNotFound)
		return
	}

	helpers.WriteJSONResponse(w, updated)
}

func HandleDeletePlan(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		helpers.WriteJSONError(w, "id query parameter is required.", http.StatusBadRequest)
		return
	}

	if removed := internalPlans.Delete(id); !removed {
		helpers.WriteJSONError(w, "Plan not found.", http.StatusNotFound)
		return
	}

	helpers.WriteJSONResponse(w, map[string]interface{}{"success": true})
}

func HandlePromotePlan(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.ID == "" {
		helpers.WriteJSONError(w, "Invalid payload. id is required.", http.StatusBadRequest)
		return
	}

	db := internalPlans.Read()
	var target internalPlans.Plan
	found := false
	for _, p := range db.Plans {
		if p.ID == body.ID {
			target = p
			found = true
			break
		}
	}
	if !found {
		helpers.WriteJSONError(w, "Plan not found.", http.StatusNotFound)
		return
	}

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

	// Security: use exec.Command with explicit args — never interpolate plan title/description
	// into a shell string, which allows command injection via backticks or $() in the text.
	args := []string{"issue", "create", "-t", target.Title, "-b", target.Description}
	if repoPath == "" && ownerName != "" {
		args = append(args, "-R", ownerName)
	}
	cmd := exec.Command("gh", args...)
	if repoPath != "" {
		cmd.Dir = repoPath
	}
	out, err := cmd.Output()
	if err != nil {
		helpers.WriteJSONError(w, fmt.Sprintf("GitHub CLI failed: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	issueURL := strings.TrimSpace(string(out))
	if issueURL == "" {
		helpers.WriteJSONError(w, "GitHub CLI created the issue but did not return a URL.", http.StatusInternalServerError)
		return
	}

	internalPlans.SetIssueURL(target.ID, issueURL)

	helpers.WriteJSONResponse(w, map[string]interface{}{
		"success":  true,
		"issueUrl": issueURL,
	})
}
