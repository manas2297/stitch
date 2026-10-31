// Package diagrams stores StitchDraw drawings as .stitchdraw files (JSON scenes tagged "type": "stitchdraw").
//
// Scope: a local repo keeps drawings in <repo>/docs/diagrams so they are versioned with the code;
// a remote-only repo uses ~/.stitch/diagrams/<owner>-<name>; no repo means ~/.stitch/diagrams/personal.
package diagrams

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"stitch/internal/config"
	"stitch/internal/server/helpers"
)

const (
	ext         = ".stitchdraw"
	sceneType   = "stitchdraw"
	libraryType = "stitchdrawlib"
	maxScene    = 64 << 20 // scenes embed images as data URLs
	libraryFile = "library.stitchdrawlib"
)

var validName = regexp.MustCompile(`^[\p{L}\p{N}_][\p{L}\p{N}_ .()\-]{0,99}$`)

func stitchDir() (string, error) {
	return filepath.Join(config.DataDir(), "diagrams"), nil
}

// scopeDir resolves the directory for a scope ("" = personal, otherwise "owner/name" of a tracked repo).
func scopeDir(repo string) (string, error) {
	base, err := stitchDir()
	if err != nil {
		return "", err
	}
	if repo == "" {
		return filepath.Join(base, "personal"), nil
	}
	owner, name, ok := strings.Cut(repo, "/")
	if !ok || owner == "" || name == "" {
		return "", errors.New("repo must be owner/name")
	}
	cfg := config.Read()
	r := helpers.FindRepoByOwnerName(&cfg, owner, name)
	if r == nil {
		return "", errors.New("repository not found in workspace")
	}
	if r.Path != "" {
		return filepath.Join(r.Path, "docs", "diagrams"), nil
	}
	safe := strings.NewReplacer("/", "-", "\\", "-", "..", "-").Replace(owner + "-" + name)
	return filepath.Join(base, safe), nil
}

// diagramPath validates the drawing name and returns its file path inside the scope directory.
func diagramPath(repo, name string) (string, string, error) {
	name = strings.TrimSpace(strings.TrimSuffix(name, ext))
	if !validName.MatchString(name) {
		return "", "", errors.New("names may use letters, numbers, spaces, . _ - ( ) and up to 100 characters")
	}
	dir, err := scopeDir(repo)
	if err != nil {
		return "", "", err
	}
	return dir, filepath.Join(dir, name+ext), nil
}

// writeAtomic writes via a temp file and rename so a crash never leaves a half-written drawing.
func writeAtomic(dir, path string, data []byte) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, ".tmp-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	// CreateTemp uses 0600; drawings are ordinary (often committed) project files.
	if err := tmp.Chmod(0o644); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), path)
}

// readJSONBody reads a JSON object body and checks its top-level "type" field.
func readJSONBody(w http.ResponseWriter, r *http.Request, wantType string) ([]byte, bool) {
	data, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxScene))
	if err != nil {
		helpers.WriteJSONError(w, "Drawing too large or unreadable", http.StatusRequestEntityTooLarge)
		return nil, false
	}
	var head struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(data, &head); err != nil || head.Type != wantType {
		helpers.WriteJSONError(w, "Body must be a "+wantType+" JSON document", http.StatusBadRequest)
		return nil, false
	}
	return data, true
}

func emptyScene() []byte {
	scene, _ := json.MarshalIndent(map[string]any{
		"type":     sceneType,
		"version":  2,
		"source":   "stitch",
		"elements": []any{},
		"appState": map[string]any{"gridSize": 20, "viewBackgroundColor": "#ffffff"},
		"files":    map[string]any{},
	}, "", "  ")
	return scene
}

type fileInfo struct {
	Name     string    `json:"name"`
	Modified time.Time `json:"modified"`
	Size     int64     `json:"size"`
}

// HandleList lists drawings in a scope, newest first.
func HandleList(w http.ResponseWriter, r *http.Request) {
	dir, err := scopeDir(r.URL.Query().Get("repo"))
	if err != nil {
		helpers.WriteJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}
	files := []fileInfo{}
	if entries, err := os.ReadDir(dir); err == nil {
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ext) {
				continue
			}
			if info, err := e.Info(); err == nil {
				files = append(files, fileInfo{Name: strings.TrimSuffix(e.Name(), ext), Modified: info.ModTime(), Size: info.Size()})
			}
		}
	}
	sort.Slice(files, func(i, j int) bool { return files[i].Modified.After(files[j].Modified) })
	helpers.WriteJSONResponse(w, map[string]any{"dir": dir, "files": files})
}

// HandleCreate creates a new drawing, empty or from a provided scene (used for duplicate/import).
func HandleCreate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Repo  string          `json:"repo"`
		Name  string          `json:"name"`
		Scene json.RawMessage `json:"scene,omitempty"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxScene)).Decode(&body); err != nil {
		helpers.WriteJSONError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	dir, path, err := diagramPath(body.Repo, body.Name)
	if err != nil {
		helpers.WriteJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if _, err := os.Stat(path); err == nil {
		helpers.WriteJSONError(w, "A drawing with that name already exists", http.StatusConflict)
		return
	}
	scene := []byte(body.Scene)
	if len(scene) == 0 || string(scene) == "null" {
		scene = emptyScene()
	} else {
		var head struct {
			Type string `json:"type"`
		}
		if json.Unmarshal(scene, &head) != nil || head.Type != sceneType {
			helpers.WriteJSONError(w, "scene must be a stitchdraw JSON document", http.StatusBadRequest)
			return
		}
	}
	if err := writeAtomic(dir, path, scene); err != nil {
		helpers.WriteJSONError(w, "Could not create drawing: "+err.Error(), http.StatusInternalServerError)
		return
	}
	helpers.WriteJSONResponse(w, map[string]any{"name": strings.TrimSuffix(filepath.Base(path), ext)})
}

// HandleGet returns the raw .stitchdraw scene.
func HandleGet(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	_, path, err := diagramPath(q.Get("repo"), q.Get("name"))
	if err != nil {
		helpers.WriteJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}
	data, err := os.ReadFile(path)
	if err != nil {
		helpers.WriteJSONError(w, "Drawing not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

// HandleSave overwrites a drawing with the posted scene.
func HandleSave(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	dir, path, err := diagramPath(q.Get("repo"), q.Get("name"))
	if err != nil {
		helpers.WriteJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}
	data, ok := readJSONBody(w, r, sceneType)
	if !ok {
		return
	}
	if err := writeAtomic(dir, path, data); err != nil {
		helpers.WriteJSONError(w, "Could not save drawing: "+err.Error(), http.StatusInternalServerError)
		return
	}
	helpers.WriteJSONResponse(w, map[string]any{"saved": time.Now()})
}

// HandleRename renames a drawing within its scope.
func HandleRename(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Repo string `json:"repo"`
		From string `json:"from"`
		To   string `json:"to"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		helpers.WriteJSONError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	_, from, err := diagramPath(body.Repo, body.From)
	if err != nil {
		helpers.WriteJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}
	_, to, err := diagramPath(body.Repo, body.To)
	if err != nil {
		helpers.WriteJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if _, err := os.Stat(to); err == nil && !strings.EqualFold(from, to) {
		helpers.WriteJSONError(w, "A drawing with that name already exists", http.StatusConflict)
		return
	}
	if err := os.Rename(from, to); err != nil {
		helpers.WriteJSONError(w, "Could not rename drawing", http.StatusInternalServerError)
		return
	}
	helpers.WriteJSONResponse(w, map[string]any{"name": strings.TrimSuffix(filepath.Base(to), ext)})
}

// HandleDelete removes a drawing.
func HandleDelete(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	_, path, err := diagramPath(q.Get("repo"), q.Get("name"))
	if err != nil {
		helpers.WriteJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := os.Remove(path); err != nil {
		helpers.WriteJSONError(w, "Drawing not found", http.StatusNotFound)
		return
	}
	helpers.WriteJSONResponse(w, map[string]any{"success": true})
}

// HandleGetLibrary returns the shared shape library (~/.stitch/diagrams/library.stitchdrawlib).
func HandleGetLibrary(w http.ResponseWriter, r *http.Request) {
	base, err := stitchDir()
	if err != nil {
		helpers.WriteJSONError(w, "Cannot resolve home dir", http.StatusInternalServerError)
		return
	}
	data, err := os.ReadFile(filepath.Join(base, libraryFile))
	if err != nil {
		data = []byte(`{"type":"` + libraryType + `","version":2,"libraryItems":[]}`)
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

// HandleSaveLibrary stores the shared shape library.
func HandleSaveLibrary(w http.ResponseWriter, r *http.Request) {
	base, err := stitchDir()
	if err != nil {
		helpers.WriteJSONError(w, "Cannot resolve home dir", http.StatusInternalServerError)
		return
	}
	data, ok := readJSONBody(w, r, libraryType)
	if !ok {
		return
	}
	if err := writeAtomic(base, filepath.Join(base, libraryFile), data); err != nil {
		helpers.WriteJSONError(w, "Could not save library", http.StatusInternalServerError)
		return
	}
	helpers.WriteJSONResponse(w, map[string]any{"success": true})
}
