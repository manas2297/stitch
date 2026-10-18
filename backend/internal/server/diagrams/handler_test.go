package diagrams

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func call(t *testing.T, h http.HandlerFunc, method, target, body string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h(rec, httptest.NewRequest(method, target, strings.NewReader(body)))
	return rec
}

func TestDiagramPathRejectsBadNames(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	for _, name := range []string{"", "../x", "a/b", `a\b`, ".hidden", strings.Repeat("a", 101)} {
		if _, _, err := diagramPath("", name); err == nil {
			t.Errorf("name %q should be rejected", name)
		}
	}
	if _, p, err := diagramPath("", "System overview (v2)"); err != nil || filepath.Base(p) != "System overview (v2).stitchdraw" {
		t.Errorf("valid name rejected: %v %q", err, p)
	}
	if _, err := scopeDir("../../etc"); err == nil {
		t.Error("repo outside owner/name form should be rejected")
	}
}

func TestPersonalLifecycle(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	dir := filepath.Join(home, ".stitch", "diagrams", "personal")

	if rec := call(t, HandleCreate, "POST", "/api/diagrams", `{"name":"Backend"}`); rec.Code != 200 {
		t.Fatalf("create: %d %s", rec.Code, rec.Body)
	}
	if rec := call(t, HandleCreate, "POST", "/api/diagrams", `{"name":"Backend"}`); rec.Code != http.StatusConflict {
		t.Errorf("duplicate create should conflict, got %d", rec.Code)
	}

	scene := `{"type":"stitchdraw","version":2,"elements":[{"id":"a","type":"rectangle"}],"appState":{},"files":{}}`
	if rec := call(t, HandleSave, "PUT", "/api/diagrams/file?name=Backend", scene); rec.Code != 200 {
		t.Fatalf("save: %d %s", rec.Code, rec.Body)
	}
	for _, bad := range []string{`{"type":"other"}`, `{"type":"excalidraw","elements":[]}`} {
		if rec := call(t, HandleSave, "PUT", "/api/diagrams/file?name=Backend", bad); rec.Code != http.StatusBadRequest {
			t.Errorf("non-stitchdraw body %s should be rejected, got %d", bad, rec.Code)
		}
	}
	if fi, err := os.Stat(filepath.Join(dir, "Backend.stitchdraw")); err != nil {
		t.Errorf("drawing should be stored with the .stitchdraw extension: %v", err)
	} else if runtime.GOOS != "windows" && fi.Mode().Perm() != 0o644 {
		t.Errorf("drawing mode = %v, want 0644", fi.Mode().Perm())
	}
	if rec := call(t, HandleGet, "GET", "/api/diagrams/file?name=Backend", ""); rec.Body.String() != scene {
		t.Errorf("get returned %s", rec.Body)
	}

	if rec := call(t, HandleRename, "POST", "/api/diagrams/rename", `{"from":"Backend","to":"API"}`); rec.Code != 200 {
		t.Fatalf("rename: %d %s", rec.Code, rec.Body)
	}
	rec := call(t, HandleList, "GET", "/api/diagrams", "")
	var list struct {
		Files []fileInfo `json:"files"`
	}
	json.Unmarshal(rec.Body.Bytes(), &list)
	if len(list.Files) != 1 || list.Files[0].Name != "API" {
		t.Errorf("list after rename = %+v", list.Files)
	}

	if rec := call(t, HandleDelete, "DELETE", "/api/diagrams/file?name=API", ""); rec.Code != 200 {
		t.Fatalf("delete: %d", rec.Code)
	}
	entries, _ := os.ReadDir(dir)
	if len(entries) != 0 {
		t.Errorf("expected empty dir (no temp files left), got %d entries", len(entries))
	}
}

func TestLibrary(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	if rec := call(t, HandleGetLibrary, "GET", "/api/diagrams/library", ""); !strings.Contains(rec.Body.String(), `"stitchdrawlib"`) {
		t.Errorf("default library = %s", rec.Body)
	}
	lib := `{"type":"stitchdrawlib","version":2,"libraryItems":[{"id":"x"}]}`
	if rec := call(t, HandleSaveLibrary, "PUT", "/api/diagrams/library", lib); rec.Code != 200 {
		t.Fatalf("save library: %d %s", rec.Code, rec.Body)
	}
	if rec := call(t, HandleGetLibrary, "GET", "/api/diagrams/library", ""); rec.Body.String() != lib {
		t.Errorf("library roundtrip = %s", rec.Body)
	}
}
