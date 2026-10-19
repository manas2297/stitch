package repos

import (
	"encoding/json"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"stitch/internal/config"
	"stitch/internal/models"
	"stitch/internal/server/helpers"
	"stitch/internal/shell"
)

const (
	maxDiscovered   = 400
	discoverTimeout = 15 * time.Second
	defaultDepth    = 4
	maxDepth        = 6
)

// Folders that never hold a user's own projects, or are too large to walk.
var skipDirs = map[string]bool{
	"node_modules": true, "vendor": true, "dist": true, "build": true, "target": true,
	"venv": true, "__pycache__": true, "Library": true, "Applications": true,
	"Pictures": true, "Movies": true, "Music": true, "Public": true,
}

var rootCandidates = []string{
	"code", "Code", "dev", "Developer", "projects", "Projects", "src", "repos",
	"workspace", "Workspace", "GitHub", "git", "Documents", "Desktop", "go/src",
}

type discoveredRepo struct {
	Path       string `json:"path"`
	Name       string `json:"name"`
	Slug       string `json:"slug,omitempty"`
	LastCommit string `json:"lastCommit,omitempty"`
	Tracked    bool   `json:"tracked"`
}

func homeDir() string {
	home, _ := os.UserHomeDir()
	return home
}

// withinHome keeps discovery scoped to the user's own files.
func withinHome(path string) bool {
	home := homeDir()
	if home == "" {
		return false
	}
	rel, err := filepath.Rel(home, path)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

func trackedPaths(cfg models.Config) map[string]bool {
	out := map[string]bool{}
	for _, r := range cfg.Repos {
		if r.Path != "" {
			abs, _ := filepath.Abs(r.Path)
			out[strings.ToLower(abs)] = true
		}
	}
	return out
}

// HandleDiscoverRoots suggests common project folders that exist under the home directory.
func HandleDiscoverRoots(w http.ResponseWriter, r *http.Request) {
	home := homeDir()
	roots := []map[string]string{}
	seen := map[string]bool{}
	for _, c := range rootCandidates {
		p := filepath.Join(home, c)
		info, err := os.Stat(p)
		if err != nil || !info.IsDir() {
			continue
		}
		// Case-insensitive filesystems report both "code" and "Code"
		real, _ := filepath.EvalSymlinks(p)
		if seen[strings.ToLower(real)] {
			continue
		}
		seen[strings.ToLower(real)] = true
		roots = append(roots, map[string]string{"path": p, "label": "~/" + c})
	}
	helpers.WriteJSONResponse(w, map[string]interface{}{"home": home, "roots": roots})
}

// findGitRepos walks root up to depth levels and returns folders containing a .git entry.
// It doesn't descend into a repo once found, so nested packages aren't listed twice.
func findGitRepos(root string, depth int, deadline time.Time) (paths []string, truncated bool) {
	rootDepth := strings.Count(root, string(filepath.Separator))
	filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil || !d.IsDir() {
			return nil
		}
		if time.Now().After(deadline) || len(paths) >= maxDiscovered {
			truncated = true
			return filepath.SkipAll
		}
		name := d.Name()
		if path != root && (strings.HasPrefix(name, ".") || skipDirs[name]) {
			return filepath.SkipDir
		}
		if _, err := os.Stat(filepath.Join(path, ".git")); err == nil {
			paths = append(paths, path)
			return filepath.SkipDir
		}
		if strings.Count(path, string(filepath.Separator))-rootDepth >= depth {
			return filepath.SkipDir
		}
		return nil
	})
	return paths, truncated
}

// HandleDiscover scans a folder for git repositories the user may want to track.
func HandleDiscover(w http.ResponseWriter, r *http.Request) {
	root := r.URL.Query().Get("root")
	if strings.HasPrefix(root, "~") {
		root = filepath.Join(homeDir(), strings.TrimPrefix(root, "~"))
	}
	root, _ = filepath.Abs(root)
	if root == "" || !withinHome(root) {
		helpers.WriteJSONError(w, "Choose a folder inside your home directory.", http.StatusBadRequest)
		return
	}
	if info, err := os.Stat(root); err != nil || !info.IsDir() {
		helpers.WriteJSONError(w, "That folder does not exist.", http.StatusBadRequest)
		return
	}
	depth := defaultDepth
	if v, err := strconv.Atoi(r.URL.Query().Get("depth")); err == nil && v > 0 {
		depth = min(v, maxDepth)
	}

	paths, truncated := findGitRepos(root, depth, time.Now().Add(discoverTimeout))
	tracked := trackedPaths(config.Read())

	repos := make([]discoveredRepo, len(paths))
	sem := make(chan struct{}, 8)
	var wg sync.WaitGroup
	for i, p := range paths {
		wg.Add(1)
		go func(i int, p string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			repo := discoveredRepo{Path: p, Name: filepath.Base(p), Tracked: tracked[strings.ToLower(p)]}
			if res := shell.RunCmd("git log -1 --format=%cI", p); res.Success {
				repo.LastCommit = strings.TrimSpace(res.Stdout)
			}
			if owner, name := shell.GetRepoInfoFromGit(p); owner != "" && name != "" {
				repo.Slug = owner + "/" + name
			}
			repos[i] = repo
		}(i, p)
	}
	wg.Wait()

	sort.Slice(repos, func(a, b int) bool { return repos[a].LastCommit > repos[b].LastCommit })
	helpers.WriteJSONResponse(w, map[string]interface{}{"root": root, "repos": repos, "truncated": truncated})
}

// HandleGitHubRepos lists the signed-in user's GitHub repositories with tracking state.
func HandleGitHubRepos(w http.ResponseWriter, r *http.Request) {
	res := shell.RunCmd(`gh repo list --limit 300 --json nameWithOwner,description,isPrivate,isFork,isArchived,pushedAt,primaryLanguage,url,stargazerCount`, "")
	if !res.Success {
		helpers.WriteJSONError(w, "Could not list GitHub repositories. Is the GitHub CLI signed in?", http.StatusBadGateway)
		return
	}
	var list []map[string]interface{}
	if err := json.Unmarshal([]byte(res.Stdout), &list); err != nil {
		helpers.WriteJSONError(w, "Failed to parse GitHub CLI output.", http.StatusInternalServerError)
		return
	}

	webTracked, cloned := map[string]bool{}, map[string]bool{}
	for _, repo := range config.Read().Repos {
		if repo.Owner == "" || repo.Name == "" {
			continue
		}
		slug := strings.ToLower(repo.Owner + "/" + repo.Name)
		if repo.Path == "" {
			webTracked[slug] = true
		} else {
			cloned[slug] = true
		}
	}
	for _, item := range list {
		slug := strings.ToLower(item["nameWithOwner"].(string))
		item["tracked"] = webTracked[slug] || cloned[slug]
		item["cloned"] = cloned[slug]
	}
	helpers.WriteJSONResponse(w, map[string]interface{}{"repos": list})
}

// HandleBulkRepos adds and removes many repositories with a single config write.
func HandleBulkRepos(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Add    []string `json:"add"`
		Remove []struct {
			Path  string `json:"path"`
			Owner string `json:"owner"`
			Name  string `json:"name"`
		} `json:"remove"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		helpers.WriteJSONError(w, "Request parsing failed.", http.StatusBadRequest)
		return
	}

	cfg := config.Read()
	added, removed := 0, 0
	failed := []map[string]string{}
	for _, target := range body.Add {
		if _, err := addRepoToConfig(&cfg, target, "", "", false); err != nil {
			failed = append(failed, map[string]string{"target": target, "error": err.Error()})
			continue
		}
		added++
	}
	for _, rm := range body.Remove {
		if removeRepoFromConfig(&cfg, rm.Path, rm.Owner, rm.Name) {
			removed++
		}
	}

	if added+removed > 0 && !config.Write(cfg) {
		helpers.WriteJSONError(w, "Failed to save config.", http.StatusInternalServerError)
		return
	}
	helpers.WriteJSONResponse(w, map[string]interface{}{"added": added, "removed": removed, "failed": failed})
}
