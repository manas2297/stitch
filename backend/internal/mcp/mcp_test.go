package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"stitch/internal/config"
	"stitch/internal/models"
	store "stitch/internal/planner"
)

// repoDir is the tracked local repo (acme/widgets) that starts as the focus project.
var repoDir string

// TestMain points HOME at a temp dir once: config and planner cache their file paths on first use.
func TestMain(m *testing.M) {
	home, err := os.MkdirTemp("", "stitch-mcp-*")
	if err != nil {
		panic(err)
	}
	os.Setenv("HOME", home)
	// gh is logged out under the temp HOME; the dead proxy keeps any call it makes offline.
	os.Setenv("HTTPS_PROXY", "http://127.0.0.1:1")
	os.Unsetenv("GH_TOKEN")
	os.Unsetenv("GITHUB_TOKEN")

	repoDir = filepath.Join(home, "widgets")
	os.MkdirAll(repoDir, 0o755)
	config.Write(models.Config{
		Repos: []models.Repo{
			{Owner: "acme", Name: "widgets", Path: repoDir},
			{Owner: "acme", Name: "web"},
		},
		FocusProject: repoDir,
	})

	code := m.Run()
	os.RemoveAll(home)
	os.Exit(code)
}

func session(t *testing.T) *mcp.ClientSession {
	t.Helper()
	ctx := context.Background()
	st, ct := mcp.NewInMemoryTransports()
	ss, err := NewServer().Connect(ctx, st, nil)
	if err != nil {
		t.Fatal(err)
	}
	cs, err := mcp.NewClient(&mcp.Implementation{Name: "test"}, nil).Connect(ctx, ct, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { cs.Close(); ss.Wait() })
	return cs
}

// callTool returns the tool's text output and whether it reported an error.
func callTool(t *testing.T, name string, args map[string]any) (string, bool) {
	t.Helper()
	res, err := session(t).CallTool(context.Background(), &mcp.CallToolParams{Name: name, Arguments: args})
	if err != nil {
		t.Fatalf("%s: %v", name, err)
	}
	var out strings.Builder
	for _, c := range res.Content {
		if tc, ok := c.(*mcp.TextContent); ok {
			out.WriteString(tc.Text)
		}
	}
	return out.String(), res.IsError
}

func mustCall(t *testing.T, name string, args map[string]any, v any) {
	t.Helper()
	out, isErr := callTool(t, name, args)
	if isErr {
		t.Fatalf("%s failed: %s", name, out)
	}
	if v != nil {
		if err := json.Unmarshal([]byte(out), v); err != nil {
			t.Fatalf("%s returned non-JSON %q: %v", name, out, err)
		}
	}
}

func TestGetFocus(t *testing.T) {
	var info struct {
		Active bool `json:"active"`
		Repo   struct {
			Owner string `json:"owner"`
			Name  string `json:"name"`
			Path  string `json:"path"`
		} `json:"repo"`
	}
	mustCall(t, "get_focus", nil, &info)
	if !info.Active || info.Repo.Name != "widgets" || info.Repo.Path != repoDir {
		t.Errorf("get_focus = %+v", info)
	}
}

func TestSetFocus(t *testing.T) {
	t.Cleanup(func() { mustCall(t, "set_focus", map[string]any{"repo": repoDir}, nil) })

	var res struct {
		FocusProject string `json:"focusProject"`
	}
	mustCall(t, "set_focus", map[string]any{"repo": "ACME/web"}, &res)
	if res.FocusProject != "acme/web" || config.Read().FocusProject != "acme/web" {
		t.Errorf("focus = %q, config = %q", res.FocusProject, config.Read().FocusProject)
	}
	if out, isErr := callTool(t, "set_focus", map[string]any{"repo": "someone/else"}); !isErr {
		t.Errorf("untracked repo should fail, got %s", out)
	}
}

func TestListRepos(t *testing.T) {
	var res struct {
		Repos []struct {
			Owner, Name, Path string
		} `json:"repos"`
		FocusProject string `json:"focusProject"`
	}
	mustCall(t, "list_repos", nil, &res)
	if len(res.Repos) != 2 || res.Repos[0].Path != repoDir || res.Repos[1].Name != "web" || res.FocusProject != repoDir {
		t.Errorf("list_repos = %+v", res)
	}
}

func TestListTasks(t *testing.T) {
	title := "listed task"
	if _, err := store.CreateTasks(repoDir, []store.TaskPatch{{Title: &title}}); err != nil {
		t.Fatal(err)
	}
	var tasks []store.Task
	mustCall(t, "list_tasks", nil, &tasks)
	found := false
	for _, task := range tasks {
		found = found || task.Title == title
	}
	if !found {
		t.Errorf("list_tasks for the focus project missed %q: %+v", title, tasks)
	}
	mustCall(t, "list_tasks", map[string]any{"repo": "acme/web"}, &tasks)
	if len(tasks) != 0 {
		t.Errorf("acme/web should have no tasks, got %+v", tasks)
	}
}

func TestCreateTasks(t *testing.T) {
	var created []store.Task
	mustCall(t, "create_tasks", map[string]any{
		"repo": "acme/web",
		"tasks": []map[string]any{
			{"title": "Ship MCP", "status": "in-progress", "priority": "high", "tags": []string{"#ai"}},
			{"title": "Write docs", "checklist": []map[string]any{{"text": "README"}}},
		},
	}, &created)
	if len(created) != 2 || created[0].Project != "acme/web" || created[0].Status != "in-progress" || created[0].Tags[0] != "ai" || len(created[1].Checklist) != 1 {
		t.Errorf("create_tasks = %+v", created)
	}
	if out, isErr := callTool(t, "create_tasks", map[string]any{"tasks": []map[string]any{{"title": "x", "status": "someday"}}}); !isErr {
		t.Errorf("status outside the enum should fail, got %s", out)
	}
}

func TestUpdateTask(t *testing.T) {
	title := "to finish"
	tasks, err := store.CreateTasks(repoDir, []store.TaskPatch{{Title: &title}})
	if err != nil {
		t.Fatal(err)
	}
	var updated store.Task
	mustCall(t, "update_task", map[string]any{"id": tasks[0].ID, "patch": map[string]any{"status": "done", "priority": "low"}}, &updated)
	if updated.Status != "done" || updated.Priority != "low" || updated.CompletedAt == "" || updated.Title != title {
		t.Errorf("update_task = %+v", updated)
	}
	if out, isErr := callTool(t, "update_task", map[string]any{"id": "missing", "patch": map[string]any{"status": "done"}}); !isErr {
		t.Errorf("unknown id should fail, got %s", out)
	}
}

func TestCreatePage(t *testing.T) {
	var page store.Page
	mustCall(t, "create_page", map[string]any{"title": "Plan", "content": "<h1>Plan</h1><p>Step one</p>"}, &page)
	if page.ID == "" || page.Project != repoDir || page.Title != "Plan" {
		t.Errorf("create_page = %+v", page)
	}
	board := store.GetBoard(repoDir)
	if len(board.Pages) == 0 || board.Pages[0].Content != "<h1>Plan</h1><p>Step one</p>" {
		t.Errorf("page not stored: %+v", board.Pages)
	}
}

func TestCreateDiagram(t *testing.T) {
	src := "flowchart LR\n  A[Client] --> B[API]"
	mustCall(t, "create_diagram", map[string]any{"name": "System", "mermaid": src}, nil)

	data, err := os.ReadFile(filepath.Join(repoDir, "docs", "diagrams", "System.stitchdraw"))
	if err != nil {
		t.Fatal(err)
	}
	var scene struct {
		Type     string `json:"type"`
		Elements []any  `json:"elements"`
		Mermaid  string `json:"mermaid"`
	}
	if err := json.Unmarshal(data, &scene); err != nil || scene.Type != "stitchdraw" || scene.Elements == nil || len(scene.Elements) != 0 || scene.Mermaid != src {
		t.Errorf("scene = %s (%v)", data, err)
	}
	if out, isErr := callTool(t, "create_diagram", map[string]any{"name": "System", "mermaid": src}); !isErr || !strings.Contains(out, "already exists") {
		t.Errorf("duplicate name should fail, got %s", out)
	}
	mustCall(t, "create_diagram", map[string]any{"repo": "acme/web", "name": "Web", "mermaid": src}, nil)
	if _, err := os.Stat(filepath.Join(config.DataDir(), "diagrams", "acme-web", "Web.stitchdraw")); err != nil {
		t.Error(fmt.Errorf("remote-only repo drawing: %w", err))
	}
}
