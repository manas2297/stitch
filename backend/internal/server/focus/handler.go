package focus

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"stitch/internal/config"
	"stitch/internal/server/helpers"
	"stitch/internal/shell"
)

func HandleFocusInfo(w http.ResponseWriter, r *http.Request) {
	cfg := config.Read()
	if cfg.FocusProject == "" {
		w.Write([]byte(`{"active":false}`))
		return
	}

	activeRepo := helpers.FindRepoByPathOrOwnerName(&cfg, cfg.FocusProject)
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
		var issuesRes shell.Result
		var prsRes shell.Result

		var wg sync.WaitGroup
		wg.Add(2)

		go func() {
			defer wg.Done()
			issuesRes = shell.RunCmd(fmt.Sprintf(`gh issue list --repo "%s/%s" --json number,title,author,url,createdAt,labels --limit 30`, owner, name), "")
		}()

		go func() {
			defer wg.Done()
			prsRes = shell.RunCmd(fmt.Sprintf(`gh pr list --repo "%s/%s" --json number,title,author,url,createdAt,reviewRequests --limit 30`, owner, name), "")
		}()

		wg.Wait()

		if issuesRes.Success {
			json.Unmarshal([]byte(issuesRes.Stdout), &issues)
		}
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
		helpers.WriteJSONError(w, "Owner and name are required.", http.StatusBadRequest)
		return
	}

	cmd := fmt.Sprintf(`gh api repos/%s/%s/contents/%s`, owner, name, helpers.UrlPathEncode(filePath))
	result := shell.RunCmd(cmd, "")

	w.Header().Set("Content-Type", "application/json")
	if result.Success {
		var payload interface{}
		if err := json.Unmarshal([]byte(result.Stdout), &payload); err == nil {
			if m, ok := payload.(map[string]interface{}); ok {
				if content, ok := m["content"].(string); ok && m["encoding"] == "base64" {
					cleaned := strings.ReplaceAll(strings.ReplaceAll(content, "\n", ""), "\r", "")
					if decoded, err := base64.StdEncoding.DecodeString(cleaned); err == nil {
						m["decodedContent"] = string(decoded)
					}
				}
			}
			json.NewEncoder(w).Encode(payload)
		} else {
			helpers.WriteJSONError(w, "Failed to parse api response.", http.StatusInternalServerError)
		}
	} else {
		helpers.WriteJSONError(w, fmt.Sprintf("Failed to fetch contents: %s", result.Stderr), http.StatusInternalServerError)
	}
}
