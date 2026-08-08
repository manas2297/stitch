package releases

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"stitch/internal/config"
	"stitch/internal/server/helpers"
	"stitch/internal/shell"
)

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

	helpers.WriteJSONResponse(w, map[string]interface{}{"releases": releaseInfo})
}

func HandlePostReleaseCreate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path  string `json:"path"`
		Owner string `json:"owner"`
		Name  string `json:"name"`
		Tag   string `json:"tag"`
		Notes string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		helpers.WriteJSONError(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	isLocal := body.Path != ""
	if isLocal {
		absPath, _ := filepath.Abs(body.Path)
		tagCmd := fmt.Sprintf(`git tag -a "%s" -m "%s"`, body.Tag, body.Notes)
		tagRes := shell.RunCmd(tagCmd, absPath)
		if !tagRes.Success {
			helpers.WriteJSONError(w, fmt.Sprintf("Failed to create local tag: %s", tagRes.Stderr), http.StatusInternalServerError)
			return
		}

		pushRes := shell.RunCmd(fmt.Sprintf(`git push origin "%s"`, body.Tag), absPath)
		if !pushRes.Success {
			helpers.WriteJSONError(w, fmt.Sprintf("Failed to push tag: %s", pushRes.Stderr), http.StatusInternalServerError)
			return
		}

		ghRes := shell.RunCmd(fmt.Sprintf(`gh release create "%s" --title "%s" --notes "%s" --repo "%s/%s"`, body.Tag, body.Tag, body.Notes, body.Owner, body.Name), absPath)
		if !ghRes.Success {
			helpers.WriteJSONError(w, fmt.Sprintf("Created tag but failed to create GitHub release: %s", ghRes.Stderr), http.StatusInternalServerError)
			return
		}
	} else {
		ghRes := shell.RunCmd(fmt.Sprintf(`gh release create "%s" --title "%s" --notes "%s" --repo "%s/%s"`, body.Tag, body.Tag, body.Notes, body.Owner, body.Name), "")
		if !ghRes.Success {
			helpers.WriteJSONError(w, fmt.Sprintf("Failed to create GitHub release: %s", ghRes.Stderr), http.StatusInternalServerError)
			return
		}
	}

	helpers.WriteJSONResponse(w, map[string]interface{}{"success": true})
}
