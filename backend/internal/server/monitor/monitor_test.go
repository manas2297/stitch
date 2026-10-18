package monitor

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"
)

const (
	oldID    = "11111111-1111-1111-1111-111111111111"
	freshID  = "22222222-2222-2222-2222-222222222222"
	goneID   = "33333333-3333-3333-3333-333333333333"
	tinyID   = "44444444-4444-4444-4444-444444444444"
	projName = "-Users-me-repo"
)

// fakeClaude builds a ~/.claude tree under a temporary HOME and returns its root.
func fakeClaude(t *testing.T) string {
	t.Helper()
	home := t.TempDir()
	t.Setenv("HOME", home)
	root := filepath.Join(home, ".claude")
	old := time.Now().AddDate(0, 0, -60)
	write := func(rel string, size int, mod time.Time) {
		abs := filepath.Join(root, rel)
		if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(abs, []byte(strings.Repeat("x", size)), 0o644); err != nil {
			t.Fatal(err)
		}
		if err := os.Chtimes(abs, mod, mod); err != nil {
			t.Fatal(err)
		}
	}
	write(".credentials.json", 100, old)
	write("settings.json", 100, old)
	write("projects/"+projName+"/"+oldID+".jsonl", 10000, old)
	write("projects/"+projName+"/"+oldID+"/subagents/agent-1.jsonl", 5000, old)
	write("projects/"+projName+"/"+freshID+".jsonl", 10000, time.Now())
	write("projects/"+projName+"/"+tinyID+".jsonl", 100, old)
	write("projects/"+projName+"/memory/MEMORY.md", 100, old)
	write("file-history/"+oldID+"/abc@v1", 2000, old)
	write("file-history/"+goneID+"/abc@v1", 3000, old)
	write("todos/"+goneID+"-agent-"+goneID+".json", 50, old)
	write("shell-snapshots/snapshot-zsh-1.sh", 400, old)
	write("debug/latest.log", 300, old)
	return root
}

func mustScan(t *testing.T) *scanResult {
	t.Helper()
	res, err := scan(profiles["claude"])
	if err != nil || !res.Exists {
		t.Fatalf("scan failed: %v exists=%v", err, res != nil && res.Exists)
	}
	return res
}

func planFor(t *testing.T, res *scanResult, req cleanupRequest) *cleanupPlan {
	t.Helper()
	plan, err := buildPlan(res, req, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	return plan
}

func rels(p *cleanupPlan) []string {
	out := []string{}
	for _, f := range p.targets {
		out = append(out, f.Rel)
	}
	sort.Strings(out)
	return out
}

func TestScanSessions(t *testing.T) {
	fakeClaude(t)
	res := mustScan(t)

	if len(res.Sessions) != 3 {
		t.Fatalf("want 3 sessions, got %d: %v", len(res.Sessions), res.Sessions)
	}
	s := res.Sessions["projects/"+projName+"/"+oldID+".jsonl"]
	if s == nil || s.Files != 2 || s.Bytes != 15000 || s.Stem != oldID {
		t.Fatalf("sibling subagent dir not merged into session: %+v", s)
	}
	if s.Dir != "projects/"+projName+"/"+oldID {
		t.Errorf("session dir = %q", s.Dir)
	}
	for _, f := range res.Files {
		switch f.Rel {
		case ".credentials.json", "settings.json", "projects/" + projName + "/memory/MEMORY.md":
			if !f.Protected {
				t.Errorf("%s should be protected", f.Rel)
			}
			if f.Session != "" {
				t.Errorf("%s should not belong to a session", f.Rel)
			}
		}
	}
}

func TestStaleSessionsIncludesSideDataAndSkipsRecent(t *testing.T) {
	fakeClaude(t)
	res := mustScan(t)
	plan := planFor(t, res, cleanupRequest{Action: "stale-sessions", Days: 30})

	want := []string{
		"file-history/" + oldID + "/abc@v1",
		"projects/" + projName + "/" + oldID + ".jsonl",
		"projects/" + projName + "/" + oldID + "/subagents/agent-1.jsonl",
		"projects/" + projName + "/" + tinyID + ".jsonl",
	}
	if got := rels(plan); strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("plan targets:\n got %v\nwant %v", got, want)
	}
	if plan.Sessions != 2 {
		t.Errorf("sessions = %d, want 2", plan.Sessions)
	}

	// Explicitly selecting the live session is refused by the recency guard.
	live := planFor(t, res, cleanupRequest{Action: "sessions", IDs: []string{"projects/" + projName + "/" + freshID + ".jsonl"}})
	if live.Files != 0 || live.SkippedRecent != 1 {
		t.Errorf("recent session should be skipped: %+v", live)
	}
}

func TestExecuteDeletesAndPrunes(t *testing.T) {
	root := fakeClaude(t)
	res := mustScan(t)
	plan := planFor(t, res, cleanupRequest{Action: "sessions", IDs: []string{"projects/" + projName + "/" + oldID + ".jsonl"}})
	out := execute(res, plan)
	if out.Deleted != 3 || out.Failed != 0 || out.FreedBytes != 17000 {
		t.Fatalf("unexpected result: %+v", out)
	}
	for _, gone := range []string{"projects/" + projName + "/" + oldID, "file-history/" + oldID} {
		if _, err := os.Stat(filepath.Join(root, gone)); !os.IsNotExist(err) {
			t.Errorf("%s should be pruned, stat err = %v", gone, err)
		}
	}
	if _, err := os.Stat(filepath.Join(root, "file-history")); err != nil {
		t.Errorf("file-history itself must stay: %v", err)
	}
	for _, keep := range []string{".credentials.json", "settings.json", "projects/" + projName + "/memory/MEMORY.md", "projects/" + projName + "/" + freshID + ".jsonl"} {
		if _, err := os.Stat(filepath.Join(root, keep)); err != nil {
			t.Errorf("%s should survive: %v", keep, err)
		}
	}
}

func TestOrphansAndCategories(t *testing.T) {
	fakeClaude(t)
	res := mustScan(t)

	orphans := rels(planFor(t, res, cleanupRequest{Action: "orphans"}))
	want := []string{"file-history/" + goneID + "/abc@v1", "todos/" + goneID + "-agent-" + goneID + ".json"}
	if strings.Join(orphans, ",") != strings.Join(want, ",") {
		t.Errorf("orphans = %v, want %v", orphans, want)
	}

	snap := rels(planFor(t, res, cleanupRequest{Action: "category", Category: "shell-snapshots"}))
	if len(snap) != 1 || snap[0] != "shell-snapshots/snapshot-zsh-1.sh" {
		t.Errorf("shell-snapshots plan = %v", snap)
	}
	if _, err := buildPlan(res, cleanupRequest{Action: "category", Category: "transcripts"}, time.Now()); err == nil {
		t.Error("non-cleanable category should be rejected")
	}

	tiny := planFor(t, res, cleanupRequest{Action: "tiny-sessions"})
	if tiny.Sessions != 1 {
		t.Errorf("tiny sessions = %d, want 1", tiny.Sessions)
	}
}

func TestUnknownSessionIDsIgnored(t *testing.T) {
	fakeClaude(t)
	res := mustScan(t)
	plan := planFor(t, res, cleanupRequest{Action: "sessions", IDs: []string{"../../etc/passwd", ".credentials.json"}})
	if plan.Files != 0 {
		t.Fatalf("arbitrary ids must not be deleted: %v", rels(plan))
	}
}

func TestInsideRoot(t *testing.T) {
	root := filepath.FromSlash("/home/u/.claude")
	for rel, ok := range map[string]bool{"projects/a.jsonl": true, "../.ssh/id_rsa": false, "a/../../x": false, ".": false} {
		if _, got := insideRoot(root, rel); got != ok {
			t.Errorf("insideRoot(%q) = %v, want %v", rel, got, ok)
		}
	}
}

func TestReport(t *testing.T) {
	fakeClaude(t)
	r := buildReport(mustScan(t), time.Now())
	if r.Sessions.Total != 3 || r.Sessions.StaleSessions != 2 || r.Sessions.TinySessions != 1 {
		t.Errorf("session stats = %+v", r.Sessions)
	}
	if len(r.Activity) != activityDays {
		t.Errorf("activity days = %d", len(r.Activity))
	}
	if r.Reclaimable.Bytes == 0 || len(r.Actions) == 0 || len(r.Insights) == 0 {
		t.Errorf("expected actions/insights/reclaimable: %+v", r.Reclaimable)
	}
}

func TestDecodeClaudeProject(t *testing.T) {
	base := t.TempDir()
	if resolved, err := filepath.EvalSymlinks(base); err == nil {
		base = resolved
	}
	for _, rel := range []string{"my-repo", "sub/dotted.name", ".hidden", "-dash-start/a-b-c"} {
		full := filepath.Join(base, rel)
		if err := os.MkdirAll(full, 0o755); err != nil {
			t.Fatal(err)
		}
		encoded := strings.NewReplacer("/", "-", ".", "-").Replace(full)
		if got := decodeClaudeProject(encoded); got != full {
			t.Errorf("decode(%q) = %q, want %q", encoded, got, full)
		}
	}
}
