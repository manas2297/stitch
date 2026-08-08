package desktop

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"stitch/internal/config"
	"stitch/internal/models"
	"stitch/internal/shell"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App manages desktop operations and Wails lifecycle hooks.
type App struct {
	ctx context.Context
}

// NewApp creates a new App instance for Wails binding.
func NewApp() *App {
	return &App{}
}

// Startup is called when the desktop app starts.
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
}

// OpenURL opens a URL in the system default browser.
func (a *App) OpenURL(url string) {
	runtime.BrowserOpenURL(a.ctx, url)
}

// ShowConfirmDialog prompts the user with a native Yes/No dialog.
func (a *App) ShowConfirmDialog(title, message string) bool {
	resp, err := runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
		Type:          runtime.QuestionDialog,
		Title:         title,
		Message:       message,
		DefaultButton: "No",
	})
	if err != nil {
		return false
	}
	return resp == "Yes"
}


// GetRepos retrieves tracked repository details.
func (a *App) GetRepos() []models.Repo {
	cfg := config.Read()

	activeLogin := ""
	if userRes := shell.RunCmd("gh api user --jq .login", ""); userRes.Success {
		activeLogin = strings.TrimSpace(userRes.Stdout)
	}

	for i := range cfg.Repos {
		r := &cfg.Repos[i]
		if _, err := os.Stat(r.Path); err == nil {
			r.Exists = true
			if branchRes := shell.RunCmd("git branch --show-current", r.Path); branchRes.Success {
				r.Branch = strings.TrimSpace(branchRes.Stdout)
			}

			owner, _ := shell.GetRepoInfoFromGit(r.Path)
			if owner != "" {
				r.Owner = owner
			}

			if r.Owner != "" && activeLogin != "" && strings.EqualFold(r.Owner, activeLogin) {
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

// AddRepo tracks a new repository path.
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

	owner, name := shell.GetRepoInfoFromGit(cleanPath)
	cfg := config.Read()

	for _, r := range cfg.Repos {
		if r.Path == cleanPath {
			return "", fmt.Errorf("repository already tracked")
		}
	}

	newRepo := models.Repo{
		Name:           name,
		Owner:          owner,
		Path:           cleanPath,
		IsMajorProject: false,
		BuildScripts:   []string{"npm run build", "go build"},
	}

	cfg.Repos = append(cfg.Repos, newRepo)
	config.Write(cfg)

	return fmt.Sprintf("Repository '%s' added successfully", name), nil
}

// DeleteRepo removes a tracked repository.
func (a *App) DeleteRepo(path string) string {
	cfg := config.Read()
	newRepos := []models.Repo{}
	for _, r := range cfg.Repos {
		if r.Path != path {
			newRepos = append(newRepos, r)
		}
	}
	cfg.Repos = newRepos
	config.Write(cfg)
	return "Repository untracked"
}

// ToggleMajor tags a repository as a primary project.
func (a *App) ToggleMajor(path string) bool {
	cfg := config.Read()
	val := false
	for i := range cfg.Repos {
		if cfg.Repos[i].Path == path {
			cfg.Repos[i].IsMajorProject = !cfg.Repos[i].IsMajorProject
			val = cfg.Repos[i].IsMajorProject
			break
		}
	}
	config.Write(cfg)
	return val
}

// SetFocus sets the active project workspace focus.
func (a *App) SetFocus(path string) string {
	cfg := config.Read()
	cfg.FocusProject = path
	config.Write(cfg)
	return "Focus updated"
}

// GetProfile returns developer profile details for the desktop view.
func (a *App) GetProfile() map[string]interface{} {
	var githubUser, githubAvatar, githubEmail string

	userRes := shell.RunCmd("gh api user --jq '{login: .login, avatar: .avatar_url, email: .email}'", "")
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

	var gitName, gitEmail string
	if res := shell.RunCmd("git config --global user.name", ""); res.Success {
		gitName = res.Stdout
	}
	if res := shell.RunCmd("git config --global user.email", ""); res.Success {
		gitEmail = res.Stdout
	}

	runtimes := map[string]string{
		"go":       "Not Installed",
		"node":     "Not Installed",
		"npm":      "Not Installed",
		"python":   "Not Installed",
		"postgres": "Not Installed",
		"mongo":    "Not Installed",
		"redis":    "Not Installed",
	}

	if res := shell.RunCmd("go version", ""); res.Success {
		runtimes["go"] = strings.TrimSpace(res.Stdout)
	}
	if res := shell.RunCmd("node --version", ""); res.Success {
		runtimes["node"] = strings.TrimSpace(res.Stdout)
	}
	if res := shell.RunCmd("npm --version", ""); res.Success {
		runtimes["npm"] = strings.TrimSpace(res.Stdout)
	}
	if res := shell.RunCmd("python3 --version", ""); res.Success {
		runtimes["python"] = strings.TrimSpace(res.Stdout)
	}
	if res := shell.RunCmd("postgres --version", ""); res.Success {
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
