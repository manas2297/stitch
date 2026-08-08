package helpers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"stitch/internal/models"
)

// WriteJSONResponse writes any data as a JSON response with status 200 OK.
func WriteJSONResponse(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(data); err != nil {
		WriteJSONError(w, "Failed to encode JSON response", http.StatusInternalServerError)
	}
}

// WriteJSONError writes a JSON formatted error response with the given status code.
func WriteJSONError(w http.ResponseWriter, errMsg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	escapedMsg := strings.ReplaceAll(errMsg, `"`, `\"`)
	w.Write([]byte(fmt.Sprintf(`{"error":"%s"}`, escapedMsg)))
}

// FindRepoByOwnerName searches for a repository in the config by Owner and Name.
func FindRepoByOwnerName(cfg *models.Config, owner, name string) *models.Repo {
	for i := range cfg.Repos {
		repo := &cfg.Repos[i]
		if strings.EqualFold(repo.Owner, owner) && strings.EqualFold(repo.Name, name) {
			return repo
		}
	}
	return nil
}

// FindRepoByPathOrOwnerName finds a repository matching a local path or "owner/name" identifier.
func FindRepoByPathOrOwnerName(cfg *models.Config, target string) *models.Repo {
	for i := range cfg.Repos {
		repo := &cfg.Repos[i]
		if repo.Path != "" {
			rAbs, _ := filepath.Abs(repo.Path)
			fAbs, _ := filepath.Abs(target)
			if strings.EqualFold(rAbs, fAbs) {
				return repo
			}
		} else {
			if fmt.Sprintf("%s/%s", repo.Owner, repo.Name) == target {
				return repo
			}
		}
	}
	return nil
}

// GetIdeasDirPath resolves and ensures the directory path for the ideas folder.
func GetIdeasDirPath(repo *models.Repo, owner, name string) string {
	var dirPath string
	if repo.Path != "" {
		dirPath = filepath.Join(repo.Path, "ideas")
	} else {
		homedir, _ := os.UserHomeDir()
		dirPath = filepath.Join(homedir, ".stitch", "ideas", owner+"-"+name)
	}
	os.MkdirAll(dirPath, 0755)
	return dirPath
}

// UrlPathEncode preserves segments but encodes special characters.
func UrlPathEncode(str string) string {
	parts := strings.Split(str, "/")
	for i, p := range parts {
		parts[i] = strings.ReplaceAll(p, "%", "%25")
		parts[i] = strings.ReplaceAll(parts[i], " ", "%20")
		parts[i] = strings.ReplaceAll(parts[i], "?", "%3F")
		parts[i] = strings.ReplaceAll(parts[i], "#", "%23")
	}
	return strings.Join(parts, "/")
}
