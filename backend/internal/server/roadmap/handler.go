package roadmap

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"stitch/internal/server/helpers"
	"stitch/internal/shell"
)

func HandleGetRoadmap(w http.ResponseWriter, r *http.Request) {
	owner := r.URL.Query().Get("owner")
	name := r.URL.Query().Get("name")
	if owner == "" || name == "" {
		helpers.WriteJSONError(w, "owner and name are required.", http.StatusBadRequest)
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
		helpers.WriteJSONError(w, "owner, name, and task are required.", http.StatusBadRequest)
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
			issueNumber = existing[0].Number
			currentBody = existing[0].Body
		}
	}

	newBody := strings.TrimRight(currentBody, "\r\n\t ") + fmt.Sprintf("\n- [ ] %s", body.Task)

	w.Header().Set("Content-Type", "application/json")
	if issueNumber > 0 {
		editRes := shell.RunCmd(fmt.Sprintf(`gh issue edit %d --repo "%s/%s" --body %s`, issueNumber, body.Owner, body.Name, strconv.Quote(newBody)), "")
		if !editRes.Success {
			helpers.WriteJSONError(w, fmt.Sprintf("Failed to update roadmap issue. details: %s", strings.ReplaceAll(editRes.Stderr, `"`, `\"`)), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "issueNumber": issueNumber, "message": "Task appended to roadmap issue."})
	} else {
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
			helpers.WriteJSONError(w, fmt.Sprintf("Failed to create roadmap issue. details: %s", strings.ReplaceAll(createRes.Stderr, `"`, `\"`)), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "message": "Roadmap issue created with first task."})
	}
}
