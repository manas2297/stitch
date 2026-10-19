package repos

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"

	"stitch/internal/config"
	"stitch/internal/server/helpers"
)

// Absolute candidates first: GUI-launched apps often lack the shell's PATH.
var editorCLIs = []string{"/usr/local/bin/code", "/opt/homebrew/bin/code", "code"}

func findBinary(candidates []string) string {
	for _, c := range candidates {
		if filepath.IsAbs(c) {
			if _, err := os.Stat(c); err == nil {
				return c
			}
			continue
		}
		if p, err := exec.LookPath(c); err == nil {
			return p
		}
	}
	return ""
}

// openCommand builds the command for target without a shell, so paths are never interpreted.
func openCommand(target, dir string) (*exec.Cmd, error) {
	switch target {
	case "editor":
		if code := findBinary(editorCLIs); code != "" {
			return exec.Command(code, dir), nil
		}
		if runtime.GOOS == "darwin" {
			return exec.Command("open", "-a", "Visual Studio Code", dir), nil
		}
		return nil, fmt.Errorf("VS Code's `code` command was not found")
	case "terminal":
		if runtime.GOOS == "darwin" {
			return exec.Command("open", "-a", "Terminal", dir), nil
		}
		if term := findBinary([]string{"x-terminal-emulator", "gnome-terminal", "konsole"}); term != "" {
			cmd := exec.Command(term)
			cmd.Dir = dir
			return cmd, nil
		}
		return nil, fmt.Errorf("no terminal application found")
	case "finder":
		switch runtime.GOOS {
		case "darwin":
			return exec.Command("open", dir), nil
		case "windows":
			return exec.Command("explorer", dir), nil
		default:
			return exec.Command("xdg-open", dir), nil
		}
	}
	return nil, fmt.Errorf("unknown target %q", target)
}

// HandleOpenRepo opens a tracked local repository in the editor, a terminal, or the file manager.
func HandleOpenRepo(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path   string `json:"path"`
		Target string `json:"target"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Path == "" {
		helpers.WriteJSONError(w, "A repository path is required.", http.StatusBadRequest)
		return
	}

	// Only open folders the user already tracks.
	tracked := false
	for _, repo := range config.Read().Repos {
		if repo.Path != "" && repo.Path == body.Path {
			tracked = true
			break
		}
	}
	if !tracked {
		helpers.WriteJSONError(w, "That path is not a tracked repository.", http.StatusForbidden)
		return
	}
	dir, _ := filepath.Abs(body.Path)
	if info, err := os.Stat(dir); err != nil || !info.IsDir() {
		helpers.WriteJSONError(w, "Repository folder no longer exists.", http.StatusNotFound)
		return
	}

	cmd, err := openCommand(body.Target, dir)
	if err != nil {
		helpers.WriteJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := cmd.Start(); err != nil {
		helpers.WriteJSONError(w, fmt.Sprintf("Failed to open: %v", err), http.StatusInternalServerError)
		return
	}
	go cmd.Wait() // reap the child without blocking the request
	helpers.WriteJSONResponse(w, map[string]interface{}{"success": true})
}
