package projects

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"

	"stitch/internal/server/helpers"
	"stitch/internal/shell"
)

func HandleProjectDetails(w http.ResponseWriter, r *http.Request) {
	owner := r.URL.Query().Get("owner")
	name := r.URL.Query().Get("name")
	if owner == "" || name == "" {
		helpers.WriteJSONError(w, "owner and name are required.", http.StatusBadRequest)
		return
	}

	var issuesRes shell.Result
	var prsRes shell.Result
	var tagRes shell.Result

	var wg sync.WaitGroup
	wg.Add(3)

	go func() {
		defer wg.Done()
		issuesRes = shell.RunCmd(fmt.Sprintf(`gh issue list --repo "%s/%s" --json number,title,author,url,createdAt,labels --limit 50`, owner, name), "")
	}()

	go func() {
		defer wg.Done()
		prsRes = shell.RunCmd(fmt.Sprintf(`gh pr list --repo "%s/%s" --state all --json number,title,author,url,createdAt,reviewRequests,reviewDecision,state --limit 30`, owner, name), "")
	}()

	go func() {
		defer wg.Done()
		tagRes = shell.RunCmd(fmt.Sprintf(`gh api repos/%s/%s/releases/latest --jq .tag_name`, owner, name), "")
	}()

	wg.Wait()

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

	helpers.WriteJSONResponse(w, map[string]interface{}{
		"features":      features,
		"bugs":          bugs,
		"general":       general,
		"prs":           rawPrs,
		"lastTag":       lastTag,
		"roadmapIssues": roadmap,
	})
}
