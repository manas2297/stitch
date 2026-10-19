package repos

import (
	"os"
	"path/filepath"
	"sort"
	"testing"
	"time"

	"stitch/internal/models"
)

func mkdirs(t *testing.T, root string, dirs ...string) {
	t.Helper()
	for _, d := range dirs {
		if err := os.MkdirAll(filepath.Join(root, d), 0o755); err != nil {
			t.Fatal(err)
		}
	}
}

func TestFindGitRepos(t *testing.T) {
	root := t.TempDir()
	mkdirs(t, root,
		"alpha/.git",
		"alpha/packages/nested/.git", // inside a repo: not listed separately
		"group/beta/.git",
		"group/node_modules/dep/.git", // skipped folder
		".hidden/gamma/.git",          // hidden folder
		"a/b/c/d/e/too-deep/.git",     // beyond depth
	)

	paths, truncated := findGitRepos(root, 4, time.Now().Add(time.Minute))
	if truncated {
		t.Fatal("unexpected truncation")
	}
	for i, p := range paths {
		paths[i], _ = filepath.Rel(root, p)
	}
	sort.Strings(paths)
	want := []string{"alpha", filepath.Join("group", "beta")}
	if len(paths) != len(want) || paths[0] != want[0] || paths[1] != want[1] {
		t.Fatalf("found %v, want %v", paths, want)
	}
}

func TestWithinHome(t *testing.T) {
	home, _ := os.UserHomeDir()
	for path, want := range map[string]bool{
		home:                               true,
		filepath.Join(home, "code"):        true,
		filepath.Join(home, "..", "other"): false,
		"/etc":                             false,
		filepath.Join(home+"x", "sibling"): false,
	} {
		if got := withinHome(filepath.Clean(path)); got != want {
			t.Errorf("withinHome(%q) = %v, want %v", path, got, want)
		}
	}
}

func TestAddAndRemoveRepoConfig(t *testing.T) {
	dir := t.TempDir()
	cfg := models.Config{Repos: []models.Repo{{Owner: "me", Name: "web"}}, FocusProject: dir}

	if _, err := addRepoToConfig(&cfg, dir, "", "", false); err != nil {
		t.Fatal(err)
	}
	if _, err := addRepoToConfig(&cfg, dir, "", "", true); err != nil { // re-adding replaces, not duplicates
		t.Fatal(err)
	}
	if _, err := addRepoToConfig(&cfg, filepath.Join(dir, "missing"), "", "", false); err == nil {
		t.Error("expected an error for a missing path")
	}
	if len(cfg.Repos) != 2 || !cfg.Repos[1].IsMajorProject {
		t.Fatalf("repos after add = %+v", cfg.Repos)
	}

	if removeRepoFromConfig(&cfg, "", "", "") {
		t.Error("an empty remove must not match anything")
	}
	if len(cfg.Repos) != 2 {
		t.Fatalf("empty remove changed the config: %+v", cfg.Repos)
	}

	if !removeRepoFromConfig(&cfg, dir, "", "") || cfg.FocusProject != "" {
		t.Errorf("removing the focused path should untrack it and clear focus; cfg = %+v", cfg)
	}
	if !removeRepoFromConfig(&cfg, "", "ME", "Web") || len(cfg.Repos) != 0 {
		t.Errorf("owner/name removal should be case-insensitive; repos = %+v", cfg.Repos)
	}
}
