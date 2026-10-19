package planner

import (
	"strings"
	"testing"

	store "stitch/internal/planner"
)

func TestMeetingICS(t *testing.T) {
	m := store.Meeting{
		ID:          "abc",
		Title:       "Sprint review; demo, Q&A",
		Start:       "2026-10-21T09:30:00+05:30",
		DurationMin: 45,
		Location:    "https://meet.example/xyz",
		Attendees:   []string{"dev@example.com", "not-an-email", "evil@x.com\r\nATTENDEE:mailto:spy@x.com"},
		Agenda:      "1. Demo\n2. Retro",
	}
	ics, err := MeetingICS(m, "owner/repo")
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{
		"DTSTART:20261021T040000Z",
		"DTEND:20261021T044500Z",
		`SUMMARY:Sprint review\; demo\, Q&A`,
		`DESCRIPTION:1. Demo\n2. Retro\n\nProject: owner/repo`,
		"ATTENDEE;RSVP=TRUE:mailto:dev@example.com",
	} {
		if !strings.Contains(ics, want) {
			t.Errorf("missing %q in:\n%s", want, ics)
		}
	}
	if strings.Contains(ics, "spy@x.com") || strings.Contains(ics, "not-an-email") {
		t.Errorf("unsafe or invalid attendees must be dropped:\n%s", ics)
	}
	for _, line := range strings.Split(strings.TrimSuffix(ics, "\r\n"), "\r\n") {
		if strings.Contains(line, "\n") {
			t.Errorf("raw newline inside a line: %q", line)
		}
	}
}

func TestIssueBody(t *testing.T) {
	body := issueBody(store.Task{Description: "Do it", Checklist: []store.ChecklistItem{{Text: "a", Done: true}, {Text: "b"}}})
	if body != "Do it\n\n- [x] a\n- [ ] b\n" {
		t.Errorf("body = %q", body)
	}
	if issueBody(store.Task{}) == "" {
		t.Error("empty tasks still need a body for gh")
	}
}
