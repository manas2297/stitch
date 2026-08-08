package ideas

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"stitch/internal/config"
	"stitch/internal/server/helpers"
)

// HandleGetIdeasFiles lists all markdown/text files in the repo's ideas folder.
func HandleGetIdeasFiles(w http.ResponseWriter, r *http.Request) {
	owner := r.URL.Query().Get("owner")
	name := r.URL.Query().Get("name")
	if owner == "" || name == "" {
		helpers.WriteJSONError(w, "owner and name are required.", http.StatusBadRequest)
		return
	}

	cfg := config.Read()
	activeRepo := helpers.FindRepoByOwnerName(&cfg, owner, name)
	if activeRepo == nil {
		helpers.WriteJSONError(w, "Repository not found in workspace.", http.StatusNotFound)
		return
	}

	dirPath := helpers.GetIdeasDirPath(activeRepo, owner, name)

	type IdeaFile struct {
		Filename string `json:"filename"`
		Size     int64  `json:"size"`
		Modified string `json:"modified"`
	}
	filesList := []IdeaFile{}

	if entries, err := os.ReadDir(dirPath); err == nil {
		for _, e := range entries {
			if !e.IsDir() {
				ext := strings.ToLower(filepath.Ext(e.Name()))
				if ext == ".md" || ext == ".txt" {
					info, err := e.Info()
					modStr := ""
					size := int64(0)
					if err == nil {
						modStr = info.ModTime().Format("2006-01-02 15:04:05")
						size = info.Size()
					}
					filesList = append(filesList, IdeaFile{
						Filename: e.Name(),
						Size:     size,
						Modified: modStr,
					})
				}
			}
		}
	}

	helpers.WriteJSONResponse(w, map[string]interface{}{"files": filesList})
}

// HandleGetIdeasFile returns the contents of a specific ideas file.
func HandleGetIdeasFile(w http.ResponseWriter, r *http.Request) {
	owner := r.URL.Query().Get("owner")
	name := r.URL.Query().Get("name")
	filename := r.URL.Query().Get("filename")
	if owner == "" || name == "" || filename == "" {
		helpers.WriteJSONError(w, "owner, name, and filename are required.", http.StatusBadRequest)
		return
	}

	if strings.Contains(filename, "..") || strings.Contains(filename, "/") || strings.Contains(filename, "\\") {
		helpers.WriteJSONError(w, "Invalid filename.", http.StatusBadRequest)
		return
	}

	cfg := config.Read()
	activeRepo := helpers.FindRepoByOwnerName(&cfg, owner, name)
	if activeRepo == nil {
		helpers.WriteJSONError(w, "Repository not found in workspace.", http.StatusNotFound)
		return
	}

	dirPath := helpers.GetIdeasDirPath(activeRepo, owner, name)
	filePath := filepath.Join(dirPath, filename)
	content := ""
	if _, err := os.Stat(filePath); err == nil {
		bytes, err := os.ReadFile(filePath)
		if err == nil {
			content = string(bytes)
		}
	}

	helpers.WriteJSONResponse(w, map[string]interface{}{"content": content})
}

// HandlePostIdeasFile writes content to a specific ideas file.
func HandlePostIdeasFile(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Owner    string `json:"owner"`
		Name     string `json:"name"`
		Filename string `json:"filename"`
		Content  string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Owner == "" || body.Name == "" || body.Filename == "" {
		helpers.WriteJSONError(w, "owner, name, filename, and content are required.", http.StatusBadRequest)
		return
	}

	if strings.Contains(body.Filename, "..") || strings.Contains(body.Filename, "/") || strings.Contains(body.Filename, "\\") {
		helpers.WriteJSONError(w, "Invalid filename.", http.StatusBadRequest)
		return
	}

	cfg := config.Read()
	activeRepo := helpers.FindRepoByOwnerName(&cfg, body.Owner, body.Name)
	if activeRepo == nil {
		helpers.WriteJSONError(w, "Repository not found in workspace.", http.StatusNotFound)
		return
	}

	dirPath := helpers.GetIdeasDirPath(activeRepo, body.Owner, body.Name)
	filePath := filepath.Join(dirPath, body.Filename)

	err := os.WriteFile(filePath, []byte(body.Content), 0644)
	if err != nil {
		helpers.WriteJSONError(w, fmt.Sprintf("Failed to save file: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	helpers.WriteJSONResponse(w, map[string]interface{}{"success": true})
}

// HandleDeleteIdeasFile deletes a specific ideas file.
func HandleDeleteIdeasFile(w http.ResponseWriter, r *http.Request) {
	owner := r.URL.Query().Get("owner")
	name := r.URL.Query().Get("name")
	filename := r.URL.Query().Get("filename")
	if owner == "" || name == "" || filename == "" {
		helpers.WriteJSONError(w, "owner, name, and filename are required.", http.StatusBadRequest)
		return
	}

	if strings.Contains(filename, "..") || strings.Contains(filename, "/") || strings.Contains(filename, "\\") {
		helpers.WriteJSONError(w, "Invalid filename.", http.StatusBadRequest)
		return
	}

	cfg := config.Read()
	activeRepo := helpers.FindRepoByOwnerName(&cfg, owner, name)
	if activeRepo == nil {
		helpers.WriteJSONError(w, "Repository not found in workspace.", http.StatusNotFound)
		return
	}

	dirPath := helpers.GetIdeasDirPath(activeRepo, owner, name)
	filePath := filepath.Join(dirPath, filename)
	if _, err := os.Stat(filePath); err == nil {
		err = os.Remove(filePath)
		if err != nil {
			helpers.WriteJSONError(w, fmt.Sprintf("Failed to delete file: %s", err.Error()), http.StatusInternalServerError)
			return
		}
	}

	helpers.WriteJSONResponse(w, map[string]interface{}{"success": true})
}
