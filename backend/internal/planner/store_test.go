package planner

import (
	"os"
	"path/filepath"
	"testing"
)

func useTempFile(t *testing.T) {
	t.Helper()
	old := file
	file = filepath.Join(t.TempDir(), "focus.json")
	t.Cleanup(func() { file = old })
}

func str(s string) *string { return &s }

func TestTaskLifecycle(t *testing.T) {
	useTempFile(t)

	created, err := CreateTasks("/p", []TaskPatch{
		{Title: str("First"), Tags: &[]string{"#api", "api", " ui "}},
		{Title: str("Second"), Priority: str("high")},
	})
	if err != nil {
		t.Fatal(err)
	}
	if created[0].Status != "todo" || created[0].Priority != "none" {
		t.Errorf("defaults = %+v", created[0])
	}
	if got := created[0].Tags; len(got) != 2 || got[0] != "api" || got[1] != "ui" {
		t.Errorf("tags not cleaned/deduped: %v", got)
	}
	if created[1].Order <= created[0].Order {
		t.Errorf("new tasks should append in order: %v then %v", created[0].Order, created[1].Order)
	}

	done, err := UpdateTask(created[0].ID, TaskPatch{Status: str("done")})
	if err != nil || done.CompletedAt == "" {
		t.Fatalf("done should stamp completedAt: %+v, %v", done, err)
	}
	reopened, _ := UpdateTask(created[0].ID, TaskPatch{Status: str("in-progress")})
	if reopened.CompletedAt != "" {
		t.Errorf("reopening should clear completedAt")
	}

	scheduled, err := UpdateTask(created[1].ID, TaskPatch{ScheduledAt: str("2026-10-20T10:00:00+05:30")})
	if err != nil || scheduled.DurationMin != 60 {
		t.Errorf("scheduling defaults to a 60 min block: %+v, %v", scheduled, err)
	}
	cleared, _ := UpdateTask(created[1].ID, TaskPatch{ScheduledAt: str(""), DueDate: str("")})
	if cleared.ScheduledAt != "" || cleared.DueDate != "" {
		t.Errorf("empty strings should clear dates: %+v", cleared)
	}

	if b := GetBoard("/p"); len(b.Tasks) != 2 || len(GetBoard("/other").Tasks) != 0 {
		t.Errorf("board should be scoped to its project")
	}
	if err := DeleteTask(created[0].ID); err != nil || len(GetBoard("/p").Tasks) != 1 {
		t.Errorf("delete failed: %v", err)
	}
}

func TestTaskValidation(t *testing.T) {
	useTempFile(t)
	if _, err := CreateTasks("/p", []TaskPatch{{}}); err == nil {
		t.Error("title is required")
	}
	if _, err := CreateTasks("/p", []TaskPatch{{Title: str("  ")}}); err == nil {
		t.Error("blank title should fail")
	}
	created, _ := CreateTasks("/p", []TaskPatch{{Title: str("ok")}})
	id := created[0].ID
	for name, p := range map[string]TaskPatch{
		"status":   {Status: str("doing")},
		"priority": {Priority: str("p0")},
		"due":      {DueDate: str("tomorrow")},
		"schedule": {ScheduledAt: str("2026-10-20 10:00")},
	} {
		if _, err := UpdateTask(id, p); err == nil {
			t.Errorf("%s: expected a validation error", name)
		}
	}
	checklist := []ChecklistItem{{Text: "write tests"}, {Text: "   "}}
	updated, _ := UpdateTask(id, TaskPatch{Checklist: &checklist})
	if len(updated.Checklist) != 1 || updated.Checklist[0].ID == "" {
		t.Errorf("checklist should drop blanks and assign ids: %+v", updated.Checklist)
	}
}

func TestMeetingsAndNotes(t *testing.T) {
	useTempFile(t)
	if _, err := CreateMeeting("/p", MeetingPatch{Title: str("Sync")}); err == nil {
		t.Error("start is required")
	}
	m, err := CreateMeeting("/p", MeetingPatch{Title: str("Sync"), Start: str("2026-10-21T09:30:00Z"), Attendees: &[]string{"a@x.dev", " "}})
	if err != nil || m.DurationMin != 30 || len(m.Attendees) != 1 {
		t.Fatalf("meeting defaults: %+v, %v", m, err)
	}
	notes := "- decided X"
	if updated, err := UpdateMeeting(m.ID, MeetingPatch{Notes: &notes}); err != nil || updated.Notes != notes {
		t.Errorf("update notes: %+v, %v", updated, err)
	}
	pg, err := CreatePage("/p", PagePatch{Title: str("  Ideas  "), Icon: str("💡")})
	if err != nil || pg.Title != "Ideas" {
		t.Fatalf("create page: %+v, %v", pg, err)
	}
	doc := `{"type":"doc","content":[]}`
	pinned := true
	if updated, err := UpdatePage(pg.ID, PagePatch{Content: &doc, Pinned: &pinned}); err != nil || updated.Content != doc || !updated.Pinned {
		t.Errorf("update page: %+v, %v", updated, err)
	}
	if _, err := UpdatePage(pg.ID, PagePatch{Icon: str("this is not an emoji at all")}); err == nil {
		t.Error("long icon should be rejected")
	}
	if b := GetBoard("/p"); len(b.Pages) != 1 || len(b.Meetings) != 1 {
		t.Errorf("board = %+v", b)
	}
	if err := DeletePage(pg.ID); err != nil || len(GetBoard("/p").Pages) != 0 {
		t.Errorf("delete page: %v", err)
	}
}

func TestLegacyNotesMigrateToPages(t *testing.T) {
	useTempFile(t)
	legacy := `{"tasks":[],"meetings":[],"notes":[{"project":"/p","content":"old scratchpad","updatedAt":"2026-10-01T10:00:00Z"},{"project":"/q","content":"  "}]}`
	if err := os.WriteFile(file, []byte(legacy), 0o600); err != nil {
		t.Fatal(err)
	}
	first := GetBoard("/p")
	if len(first.Pages) != 1 || first.Pages[0].Content != "old scratchpad" || first.Pages[0].Title != "Notes" {
		t.Fatalf("migrated pages = %+v", first.Pages)
	}
	if again := GetBoard("/p"); again.Pages[0].ID != first.Pages[0].ID {
		t.Error("migration must persist so page IDs stay stable")
	}
	if len(GetBoard("/q").Pages) != 0 {
		t.Error("empty notes should not become pages")
	}
}
