package contributions

import (
	"encoding/json"
	"fmt"
	"net/http"

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
