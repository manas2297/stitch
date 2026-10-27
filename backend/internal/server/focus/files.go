package focus

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"unicode/utf8"

	"stitch/internal/config"
	"stitch/internal/server/helpers"
	"stitch/internal/shell"
)

// maxEditableBytes caps what the in-app editor will open or save.
const maxEditableBytes = 2 << 20

// focusRoot returns the absolute, symlink-resolved root of the focused local repository.
func focusRoot() (string, bool) {
	cfg := config.Read()
	if cfg.FocusProject == "" {
		return "", false
	}
	repo := helpers.FindRepoByPathOrOwnerName(&cfg, cfg.FocusProject)
	if repo == nil || repo.Path == "" {
		return "", false
	}
	abs, err := filepath.Abs(repo.Path)
	if err != nil {
		return "", false
	}
	resolved, err := filepath.EvalSymlinks(abs)
	if err != nil {
		return "", false
	}
	return resolved, true
}

// resolveInRoot maps a repo-relative path to an absolute one, rejecting anything that escapes the root
// (including through symlinks). The target need not exist when allowMissing is set (new files).
func resolveInRoot(root, rel string, allowMissing bool) (string, bool) {
	joined := filepath.Join(root, filepath.FromSlash(rel))
	target := joined
	if resolved, err := filepath.EvalSymlinks(joined); err == nil {
		target = resolved
	} else if allowMissing && os.IsNotExist(err) {
		parent, perr := filepath.EvalSymlinks(filepath.Dir(joined))
		if perr != nil {
			return "", false
		}
		target = filepath.Join(parent, filepath.Base(joined))
	} else {
		return "", false
	}
	if target != root && !strings.HasPrefix(target, root+string(filepath.Separator)) {
		return "", false
	}
	return target, true
}

func inGitDir(rel string) bool {
	for _, part := range strings.Split(filepath.ToSlash(rel), "/") {
		if part == ".git" {
			return true
		}
	}
	return false
}

type fsEntry struct {
	Name string `json:"name"`
	Path string `json:"path"`
	Type string `json:"type"` // "dir" | "file"
	Size int64  `json:"size"`
}

// HandleFSList lists one directory of the focused local repo (directories first).
func HandleFSList(w http.ResponseWriter, r *http.Request) {
	root, ok := focusRoot()
	if !ok {
		helpers.WriteJSONError(w, "Focused project is not a local repository.", http.StatusBadRequest)
		return
	}
	rel := strings.Trim(r.URL.Query().Get("path"), "/")
	if inGitDir(rel) {
		helpers.WriteJSONError(w, "Path not allowed.", http.StatusForbidden)
		return
	}
	dir, ok := resolveInRoot(root, rel, false)
	if !ok {
		helpers.WriteJSONError(w, "Path is outside the repository.", http.StatusForbidden)
		return
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		helpers.WriteJSONError(w, "Cannot read directory.", http.StatusNotFound)
		return
	}
	out := make([]fsEntry, 0, len(entries))
	for _, e := range entries {
		if e.Name() == ".git" || e.Name() == ".DS_Store" {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		kind := "file"
		if e.IsDir() {
			kind = "dir"
		} else if e.Type()&os.ModeSymlink != 0 {
			if st, err := os.Stat(filepath.Join(dir, e.Name())); err == nil && st.IsDir() {
				kind = "dir"
			}
		}
		out = append(out, fsEntry{Name: e.Name(), Path: filepath.ToSlash(filepath.Join(rel, e.Name())), Type: kind, Size: info.Size()})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Type != out[j].Type {
			return out[i].Type == "dir"
		}
		return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
	})
	helpers.WriteJSONResponse(w, out)
}

// HandleFSRead returns a text file's content, or flags it as binary / too large.
func HandleFSRead(w http.ResponseWriter, r *http.Request) {
	root, ok := focusRoot()
	if !ok {
		helpers.WriteJSONError(w, "Focused project is not a local repository.", http.StatusBadRequest)
		return
	}
	rel := strings.Trim(r.URL.Query().Get("path"), "/")
	if rel == "" || inGitDir(rel) {
		helpers.WriteJSONError(w, "Path not allowed.", http.StatusForbidden)
		return
	}
	file, ok := resolveInRoot(root, rel, false)
	if !ok {
		helpers.WriteJSONError(w, "Path is outside the repository.", http.StatusForbidden)
		return
	}
	info, err := os.Stat(file)
	if err != nil || info.IsDir() {
		helpers.WriteJSONError(w, "File not found.", http.StatusNotFound)
		return
	}
	resp := map[string]interface{}{"path": rel, "size": info.Size()}
	if info.Size() > maxEditableBytes {
		resp["tooLarge"] = true
		helpers.WriteJSONResponse(w, resp)
		return
	}
	data, err := os.ReadFile(file)
	if err != nil {
		helpers.WriteJSONError(w, "Cannot read file.", http.StatusInternalServerError)
		return
	}
	if !utf8.Valid(data) || strings.IndexByte(string(data), 0) >= 0 {
		resp["binary"] = true
		helpers.WriteJSONResponse(w, resp)
		return
	}
	resp["content"] = string(data)
	helpers.WriteJSONResponse(w, resp)
}

// HandleFSWrite saves text content to a file in the focused local repo (creating it if needed).
func HandleFSWrite(w http.ResponseWriter, r *http.Request) {
	root, ok := focusRoot()
	if !ok {
		helpers.WriteJSONError(w, "Focused project is not a local repository.", http.StatusBadRequest)
		return
	}
	var body struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxEditableBytes+4096)
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		helpers.WriteJSONError(w, "Invalid request body.", http.StatusBadRequest)
		return
	}
	rel := strings.Trim(body.Path, "/")
	if rel == "" || inGitDir(rel) {
		helpers.WriteJSONError(w, "Path not allowed.", http.StatusForbidden)
		return
	}
	file, ok := resolveInRoot(root, rel, true)
	if !ok {
		helpers.WriteJSONError(w, "Path is outside the repository.", http.StatusForbidden)
		return
	}
	mode := os.FileMode(0o644)
	if info, err := os.Stat(file); err == nil {
		if info.IsDir() {
			helpers.WriteJSONError(w, "Path is a directory.", http.StatusBadRequest)
			return
		}
		mode = info.Mode().Perm()
	}
	if err := os.WriteFile(file, []byte(body.Content), mode); err != nil {
		helpers.WriteJSONError(w, "Cannot write file.", http.StatusInternalServerError)
		return
	}
	helpers.WriteJSONResponse(w, map[string]interface{}{"ok": true, "size": len(body.Content)})
}

// HandleFSStatus returns {path: "M"|"A"|"D"|"?"...} from git status for change badges in the explorer.
func HandleFSStatus(w http.ResponseWriter, r *http.Request) {
	root, ok := focusRoot()
	if !ok {
		helpers.WriteJSONResponse(w, map[string]string{})
		return
	}
	out := map[string]string{}
	res := shell.RunCmd("git status --porcelain=v1 --untracked-files=all", root)
	if res.Success {
		for _, line := range strings.Split(res.Stdout, "\n") {
			// Stdout is trimmed, so the first line may have lost its leading status column; split on the first space.
			line = strings.TrimSpace(line)
			sp := strings.IndexByte(line, ' ')
			if sp < 1 {
				continue
			}
			code := line[:sp]
			path := strings.TrimSpace(line[sp+1:])
			if i := strings.Index(path, " -> "); i >= 0 {
				path = path[i+4:]
			}
			path = strings.Trim(path, `"`)
			if code == "??" {
				code = "U"
			} else if len(code) > 1 {
				code = code[:1]
			}
			out[path] = code
		}
	}
	helpers.WriteJSONResponse(w, out)
}
