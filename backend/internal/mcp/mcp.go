// Package mcp exposes Stitch's Focus planner and diagrams to MCP clients (Claude Desktop,
// Claude Code) over stdio. Each tool serves a request through server.Routes() in-process,
// so the HTTP handlers stay the only implementation.
package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/jsonschema-go/jsonschema"
	"github.com/modelcontextprotocol/go-sdk/mcp"

	"stitch/internal/config"
	"stitch/internal/models"
	store "stitch/internal/planner"
	"stitch/internal/server"
)

// Run serves MCP on stdin/stdout until the client disconnects.
func Run(ctx context.Context) error {
	// Handlers log with fmt.Printf; keep stdout for protocol frames only.
	out := os.Stdout
	os.Stdout = os.Stderr
	return NewServer().Run(ctx, &mcp.IOTransport{Reader: os.Stdin, Writer: out})
}

var routes = server.Routes()

// call serves one API request in-process and returns the JSON body, or the handler's error message.
func call(method, target string, body any) (json.RawMessage, error) {
	var r io.Reader = http.NoBody
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		r = bytes.NewReader(data)
	}
	req := httptest.NewRequest(method, target, r)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	routes.ServeHTTP(rec, req)
	data := bytes.TrimSpace(rec.Body.Bytes())
	if rec.Code >= 400 {
		var e struct {
			Error string `json:"error"`
		}
		if json.Unmarshal(data, &e) == nil && e.Error != "" {
			return nil, errors.New(e.Error)
		}
		return nil, fmt.Errorf("%s %s failed (%d)", method, target, rec.Code)
	}
	return data, nil
}

// resolveRepo finds a tracked repo by local path or owner/name; "" means the focus project.
func resolveRepo(repo string) (models.Repo, error) {
	cfg := config.Read()
	if repo == "" {
		repo = cfg.FocusProject
		if repo == "" {
			return models.Repo{}, errors.New("no repo given and no focus project is set; call set_focus or pass repo")
		}
	}
	abs, _ := filepath.Abs(repo)
	for _, r := range cfg.Repos {
		if r.Path != "" {
			if rAbs, _ := filepath.Abs(r.Path); strings.EqualFold(rAbs, abs) {
				return r, nil
			}
		}
		if r.Owner != "" && strings.EqualFold(r.Owner+"/"+r.Name, repo) {
			return r, nil
		}
	}
	return models.Repo{}, fmt.Errorf("repo %q is not tracked by Stitch; call list_repos to see tracked repos", repo)
}

// projectKey is the planner's project id: the local path, else owner/name.
func projectKey(r models.Repo) string {
	if r.Path != "" {
		return r.Path
	}
	return r.Owner + "/" + r.Name
}

func text(data json.RawMessage) (*mcp.CallToolResult, any, error) {
	return &mcp.CallToolResult{Content: []mcp.Content{&mcp.TextContent{Text: string(data)}}}, nil, nil
}

// Schema helpers.
func str(desc string) *jsonschema.Schema {
	return &jsonschema.Schema{Type: "string", Description: desc}
}

func enum(desc string, values []string) *jsonschema.Schema {
	s := str(desc)
	for _, v := range values {
		s.Enum = append(s.Enum, v)
	}
	return s
}

func object(props map[string]*jsonschema.Schema, required ...string) *jsonschema.Schema {
	return &jsonschema.Schema{Type: "object", Properties: props, Required: required}
}

func ptr[T any](v T) *T { return &v }

var repoProp = str("Tracked repo as owner/name or local path. Omit to use the current focus project.")

// taskFields are the writable task fields shared by create_tasks and update_task.
func taskFields() map[string]*jsonschema.Schema {
	return map[string]*jsonschema.Schema{
		"title":       str("Short task title."),
		"description": str("Longer details in plain text."),
		"status":      enum("Board column. New tasks default to todo.", store.Statuses),
		"priority":    enum("Priority. New tasks default to none.", store.Priorities),
		"tags":        {Type: "array", Items: str("Tag without the leading #."), Description: "Tags; replaces the existing list."},
		"dueDate":     {Type: "string", Description: "Due date as YYYY-MM-DD; empty string clears it.", Format: "date"},
		"scheduledAt": str("Calendar time-block start as an RFC3339 timestamp; empty string clears it."),
		"durationMin": {Type: "integer", Description: "Time-block length in minutes.", Minimum: ptr(0.0), Maximum: ptr(1440.0)},
		"checklist": {
			Type:        "array",
			Description: "Checklist; replaces the existing list.",
			Items: object(map[string]*jsonschema.Schema{
				"text": str("Item text."),
				"done": {Type: "boolean"},
			}, "text"),
		},
	}
}

// skeletonSchema describes the element skeletons the client passes to Excalidraw's convertToExcalidrawElements.
func skeletonSchema() *jsonschema.Schema {
	num := func(desc string) *jsonschema.Schema { return &jsonschema.Schema{Type: "number", Description: desc} }
	ref := func() *jsonschema.Schema {
		return object(map[string]*jsonschema.Schema{"id": str("id of the shape to bind to.")}, "id")
	}
	arrowheads := []string{"arrow", "triangle", "dot", "bar"}
	return object(map[string]*jsonschema.Schema{
		"type":            enum("Element kind.", []string{"rectangle", "ellipse", "diamond", "text", "arrow", "line", "frame"}),
		"id":              str("Unique id, referenced by arrow start/end and frame children."),
		"x":               num("Left edge in px (frames wrap their children and need no position)."),
		"y":               num("Top edge in px."),
		"width":           num("Width in px; for arrows and lines, the horizontal extent."),
		"height":          num("Height in px."),
		"label":           object(map[string]*jsonschema.Schema{"text": str("Text centered in the shape or on the arrow."), "fontSize": num("Font size, default 20.")}, "text"),
		"text":            str("Content of a text element."),
		"fontSize":        num("Font size of a text element."),
		"strokeColor":     str("Outline and text color as hex, default #1e1e1e."),
		"backgroundColor": str("Fill color as hex."),
		"fillStyle":       enum("Fill pattern.", []string{"solid", "hachure", "cross-hatch"}),
		"strokeWidth":     num("Outline width: 1, 2 or 4."),
		"strokeStyle":     enum("Outline style.", []string{"solid", "dashed", "dotted"}),
		"roundness":       object(map[string]*jsonschema.Schema{"type": {Type: "integer", Description: "3 for rounded corners."}}),
		"start":           ref(),
		"end":             ref(),
		"startArrowhead":  enum("Arrowhead at the start of an arrow.", arrowheads),
		"endArrowhead":    enum("Arrowhead at the end of an arrow.", arrowheads),
		"children":        {Type: "array", Items: str("Shape id."), Description: "Ids of the shapes inside a frame."},
		"name":            str("Frame title."),
	}, "type")
}

type repoArg struct {
	Repo string `json:"repo"`
}

// NewServer registers Stitch's tools on a new MCP server.
func NewServer() *mcp.Server {
	s := mcp.NewServer(&mcp.Implementation{Name: "stitch", Version: "1.0.0"}, nil)

	mcp.AddTool(s, &mcp.Tool{
		Name:        "get_focus",
		Description: "Get the repo Stitch is focused on: its owner/name, path and branch, open GitHub issues and PRs, and local git status. Returns {\"active\": false} when nothing is focused.",
		InputSchema: object(nil),
	}, func(ctx context.Context, req *mcp.CallToolRequest, _ struct{}) (*mcp.CallToolResult, any, error) {
		data, err := call("GET", "/api/focus/info", nil)
		if err != nil {
			return nil, nil, err
		}
		return text(data)
	})

	mcp.AddTool(s, &mcp.Tool{
		Name:        "set_focus",
		Description: "Set the focus project, which other tools use when repo is omitted and which the Stitch Focus tab shows.",
		InputSchema: object(map[string]*jsonschema.Schema{
			"repo": str("Tracked repo as owner/name or local path (see list_repos)."),
		}, "repo"),
	}, func(ctx context.Context, req *mcp.CallToolRequest, in repoArg) (*mcp.CallToolResult, any, error) {
		if in.Repo == "" {
			return nil, nil, errors.New("repo is required")
		}
		r, err := resolveRepo(in.Repo)
		if err != nil {
			return nil, nil, err
		}
		data, err := call("POST", "/api/repos/set-focus", map[string]string{"path": r.Path, "owner": r.Owner, "name": r.Name})
		if err != nil {
			return nil, nil, err
		}
		return text(data)
	})

	mcp.AddTool(s, &mcp.Tool{
		Name:        "list_repos",
		Description: "List the repositories tracked in Stitch (local clones and GitHub-only repos) with owner, name, path and branch, plus the current focusProject.",
		InputSchema: object(nil),
	}, func(ctx context.Context, req *mcp.CallToolRequest, _ struct{}) (*mcp.CallToolResult, any, error) {
		data, err := call("GET", "/api/repos", nil)
		if err != nil {
			return nil, nil, err
		}
		return text(data)
	})

	mcp.AddTool(s, &mcp.Tool{
		Name:        "list_tasks",
		Description: "List a project's Focus planner tasks in board order, with id, title, status, priority, tags, dates and checklist.",
		InputSchema: object(map[string]*jsonschema.Schema{"repo": repoProp}),
	}, func(ctx context.Context, req *mcp.CallToolRequest, in repoArg) (*mcp.CallToolResult, any, error) {
		r, err := resolveRepo(in.Repo)
		if err != nil {
			return nil, nil, err
		}
		data, err := call("GET", "/api/focus/board?project="+url.QueryEscape(projectKey(r)), nil)
		if err != nil {
			return nil, nil, err
		}
		var board struct {
			Tasks json.RawMessage `json:"tasks"`
		}
		if err := json.Unmarshal(data, &board); err != nil {
			return nil, nil, err
		}
		return text(board.Tasks)
	})

	mcp.AddTool(s, &mcp.Tool{
		Name:        "create_tasks",
		Description: "Create one or more tasks on a project's Focus planner board in a single call. Returns the created tasks with their ids.",
		InputSchema: object(map[string]*jsonschema.Schema{
			"repo": repoProp,
			"tasks": {
				Type:        "array",
				Description: "Tasks to create.",
				MinItems:    ptr(1),
				Items:       object(taskFields(), "title"),
			},
		}, "tasks"),
	}, func(ctx context.Context, req *mcp.CallToolRequest, in struct {
		Repo  string            `json:"repo"`
		Tasks []json.RawMessage `json:"tasks"`
	}) (*mcp.CallToolResult, any, error) {
		r, err := resolveRepo(in.Repo)
		if err != nil {
			return nil, nil, err
		}
		data, err := call("POST", "/api/focus/tasks", map[string]any{"project": projectKey(r), "tasks": in.Tasks})
		if err != nil {
			return nil, nil, err
		}
		return text(data)
	})

	mcp.AddTool(s, &mcp.Tool{
		Name:        "update_task",
		Description: "Update a task by id (from list_tasks). Only the fields present in patch change; setting status to done records the completion time.",
		InputSchema: object(map[string]*jsonschema.Schema{
			"id":    str("Task id."),
			"patch": object(taskFields()),
		}, "id", "patch"),
	}, func(ctx context.Context, req *mcp.CallToolRequest, in struct {
		ID    string          `json:"id"`
		Patch json.RawMessage `json:"patch"`
	}) (*mcp.CallToolResult, any, error) {
		data, err := call("PATCH", "/api/focus/tasks/"+url.PathEscape(in.ID), in.Patch)
		if err != nil {
			return nil, nil, err
		}
		return text(data)
	})

	mcp.AddTool(s, &mcp.Tool{
		Name:        "create_page",
		Description: "Create a notes page in a project's Focus planner. Content may be HTML (h1-h3, p, ul/ol/li, pre/code, strong, em, a, blockquote) for formatting, or plain text where each line becomes a paragraph.",
		InputSchema: object(map[string]*jsonschema.Schema{
			"repo":    repoProp,
			"title":   str("Page title."),
			"content": str("Page body as HTML or plain text."),
		}, "title", "content"),
	}, func(ctx context.Context, req *mcp.CallToolRequest, in struct {
		Repo    string `json:"repo"`
		Title   string `json:"title"`
		Content string `json:"content"`
	}) (*mcp.CallToolResult, any, error) {
		r, err := resolveRepo(in.Repo)
		if err != nil {
			return nil, nil, err
		}
		data, err := call("POST", "/api/focus/pages", map[string]string{"project": projectKey(r), "title": in.Title, "content": in.Content})
		if err != nil {
			return nil, nil, err
		}
		return text(data)
	})

	mcp.AddTool(s, &mcp.Tool{
		Name: "create_diagram",
		Description: "Create an architecture drawing in Stitch's Architecture tab, saved as a .stitchdraw file (in docs/diagrams for local repos). " +
			"Prefer elements: you lay out the shapes yourself and they open as editable, styled shapes. " +
			"Layout tips: boxes about 180x80 on a grid with 80-120px gaps, flowing left-to-right or top-to-bottom; " +
			"give every shape an id and connect shapes with arrows whose start/end reference those ids (the arrow's x/y only needs to be near its source); " +
			"color-code layers with backgroundColor and fillStyle solid (e.g. #a5d8ff clients, #b2f2bb services, #ffec99 queues, #ffc9c9 data stores, #d0bfff external systems); " +
			"use diamonds for decisions, ellipses for actors, a frame (children = ids) to group a subsystem, and text elements for a title or notes. " +
			"mermaid is a plainer, auto-laid-out fallback. Pass exactly one of elements or mermaid.",
		InputSchema: object(map[string]*jsonschema.Schema{
			"repo": repoProp,
			"name": str("Drawing name: letters, numbers, spaces, . _ - ( ), up to 100 characters. Must not already exist."),
			"elements": {
				Type:        "array",
				Description: "Excalidraw element skeletons. Other Excalidraw element properties (opacity, roughness, fontFamily, ...) are passed through.",
				MinItems:    ptr(1),
				Items:       skeletonSchema(),
			},
			"mermaid": str("Mermaid source (flowchart, sequence or class diagram), e.g. \"flowchart LR\\n  A[Client] --> B[API]\". Only when not passing elements."),
		}, "name"),
	}, func(ctx context.Context, req *mcp.CallToolRequest, in struct {
		Repo     string            `json:"repo"`
		Name     string            `json:"name"`
		Elements []json.RawMessage `json:"elements"`
		Mermaid  string            `json:"mermaid"`
	}) (*mcp.CallToolResult, any, error) {
		r, err := resolveRepo(in.Repo)
		if err != nil {
			return nil, nil, err
		}
		if r.Owner == "" || r.Name == "" {
			return nil, nil, fmt.Errorf("repo %q has no GitHub owner/name, which diagrams are filed under", projectKey(r))
		}
		hasMermaid := strings.TrimSpace(in.Mermaid) != ""
		if (len(in.Elements) > 0) == hasMermaid {
			return nil, nil, errors.New("pass exactly one of elements or mermaid")
		}
		// The client converts "skeleton" or "mermaid" into elements on first open, saves, and drops the field.
		scene := map[string]any{
			"type":     "stitchdraw",
			"version":  2,
			"source":   "stitch",
			"elements": []any{},
			"appState": map[string]any{"gridSize": 20, "viewBackgroundColor": "#ffffff"},
			"files":    map[string]any{},
		}
		if hasMermaid {
			scene["mermaid"] = in.Mermaid
		} else {
			scene["skeleton"] = in.Elements
		}
		data, err := call("POST", "/api/diagrams", map[string]any{"repo": r.Owner + "/" + r.Name, "name": in.Name, "scene": scene})
		if err != nil {
			return nil, nil, err
		}
		return text(data)
	})

	return s
}
