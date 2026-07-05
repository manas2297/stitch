package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct manages desktop operations and lifecycle
type App struct {
	ctx context.Context
}

// NewApp creates a new App struct instance
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// OpenURL spawns the default desktop browser targeting the specified URL link
func (a *App) OpenURL(url string) {
	runtime.BrowserOpenURL(a.ctx, url)
}

// ── Bindings mapping the existing Go API logic for Wails ──────────────────────

// GetRepos retrieves tracked repository details
func (a *App) GetRepos() []Repo {
	cfg := readConfig()
	
	// Query current active login
	activeLogin := ""
	if userRes := runCmd("gh api user --jq .login", ""); userRes.Success {
		activeLogin = strings.TrimSpace(userRes.Stdout)
	}

	for i := range cfg.Repos {
		r := &cfg.Repos[i]
		if _, err := os.Stat(r.Path); err == nil {
			r.Exists = true
			if branchRes := runCmd("git branch --show-current", r.Path); branchRes.Success {
				r.Branch = strings.TrimSpace(branchRes.Stdout)
			}
			
			// Resolve repo owner details dynamically
			owner, _ := getRepoInfoFromGit(r.Path)
			if owner != "" {
				r.Owner = owner
			}
			
			// Separate own repos vs forks/clones
			if r.Owner != "" && activeLogin != "" && strings.ToLower(r.Owner) == strings.ToLower(activeLogin) {
				r.Type = "my-repo"
			} else {
				r.Type = "fork-or-clone"
			}
		} else {
			r.Exists = false
		}
	}
	return cfg.Repos
}

// AddRepo tracks a new repository path
func (a *App) AddRepo(path string) (string, error) {
	cleanPath := strings.TrimSpace(path)
	if cleanPath == "" {
		return "", fmt.Errorf("repository path cannot be empty")
	}

	fi, err := os.Stat(cleanPath)
	if err != nil || !fi.IsDir() {
		return "", fmt.Errorf("path is not a valid directory")
	}

	gitPath := filepath.Join(cleanPath, ".git")
	if _, err := os.Stat(gitPath); err != nil {
		return "", fmt.Errorf("directory is not a git repository")
	}

	owner, name := getRepoInfoFromGit(cleanPath)

	cfg := readConfig()
	// Check if already tracking
	for _, r := range cfg.Repos {
		if r.Path == cleanPath {
			return "", fmt.Errorf("repository already tracked")
		}
	}

	newRepo := Repo{
		Name:           name,
		Owner:          owner,
		Path:           cleanPath,
		IsMajorProject: false,
		BuildScripts:   []string{"npm run build", "go build"},
	}

	cfg.Repos = append(cfg.Repos, newRepo)
	writeConfig(cfg)

	return fmt.Sprintf("Repository '%s' added successfully", name), nil
}

// DeleteRepo removes a tracked repository
func (a *App) DeleteRepo(path string) string {
	cfg := readConfig()
	newRepos := []Repo{}
	for _, r := range cfg.Repos {
		if r.Path != path {
			newRepos = append(newRepos, r)
		}
	}
	cfg.Repos = newRepos
	writeConfig(cfg)
	return "Repository untracked"
}

// ToggleMajor tags repository as a primary project
func (a *App) ToggleMajor(path string) bool {
	cfg := readConfig()
	val := false
	for i := range cfg.Repos {
		if cfg.Repos[i].Path == path {
			cfg.Repos[i].IsMajorProject = !cfg.Repos[i].IsMajorProject
			val = cfg.Repos[i].IsMajorProject
			break
		}
	}
	writeConfig(cfg)
	return val
}

// SetFocus sets the active project workspace focus
func (a *App) SetFocus(path string) string {
	cfg := readConfig()
	cfg.FocusProject = path
	writeConfig(cfg)
	return "Focus updated"
}

// GetProfile details for desktop view
func (a *App) GetProfile() map[string]interface{} {
	// 1. Fetch GitHub CLI User info
	var githubUser string
	var githubAvatar string
	var githubEmail string

	userRes := runCmd("gh api user --jq '{login: .login, avatar: .avatar_url, email: .email}'", "")
	if userRes.Success && userRes.Stdout != "" {
		var u struct {
			Login  string `json:"login"`
			Avatar string `json:"avatar"`
			Email  string `json:"email"`
		}
		if err := json.Unmarshal([]byte(userRes.Stdout), &u); err == nil {
			githubUser = u.Login
			githubAvatar = u.Avatar
			githubEmail = u.Email
		}
	}

	// 2. Fetch Global Git Identity
	var gitName string
	var gitEmail string
	if res := runCmd("git config --global user.name", ""); res.Success {
		gitName = res.Stdout
	}
	if res := runCmd("git config --global user.email", ""); res.Success {
		gitEmail = res.Stdout
	}

	// 3. Fetch Runtimes
	runtimes := map[string]string{
		"go":       "Not Installed",
		"node":     "Not Installed",
		"npm":      "Not Installed",
		"python":   "Not Installed",
		"postgres": "Not Installed",
		"mongo":    "Not Installed",
		"redis":    "Not Installed",
	}

	if res := runCmd("go version", ""); res.Success {
		runtimes["go"] = strings.TrimSpace(res.Stdout)
	}
	if res := runCmd("node --version", ""); res.Success {
		runtimes["node"] = strings.TrimSpace(res.Stdout)
	}
	if res := runCmd("npm --version", ""); res.Success {
		runtimes["npm"] = strings.TrimSpace(res.Stdout)
	}
	if res := runCmd("python3 --version", ""); res.Success {
		runtimes["python"] = strings.TrimSpace(res.Stdout)
	}
	if res := runCmd("postgres --version", ""); res.Success {
		runtimes["postgres"] = strings.TrimSpace(res.Stdout)
	}

	return map[string]interface{}{
		"github": map[string]interface{}{
			"username":  githubUser,
			"avatarUrl": githubAvatar,
			"email":     githubEmail,
		},
		"git": map[string]interface{}{
			"globalName":  gitName,
			"globalEmail": gitEmail,
		},
		"diagnostics": map[string]interface{}{
			"os":    "macOS",
			"shell": "zsh",
		},
		"runtimes": runtimes,
	}
}
