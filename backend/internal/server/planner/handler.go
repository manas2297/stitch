// Package planner serves the Focus area's tasks, meetings and notes.
package planner

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"time"

	"stitch/internal/config"
	"stitch/internal/models"
	store "stitch/internal/planner"
	"stitch/internal/server/helpers"
)

// trackedRepo resolves a focus value (local path or owner/name) to a tracked repo.
func trackedRepo(project string) (models.Repo, bool) {
	if project == "" {
		return models.Repo{}, false
	}
	for _, r := range config.Read().Repos {
		key := r.Path
		if key == "" {
			key = r.Owner + "/" + r.Name
		}
		if key == project {
			return r, true
		}
	}
	return models.Repo{}, false
}

func requireProject(w http.ResponseWriter, project string) bool {
	if _, ok := trackedRepo(project); !ok {
		helpers.WriteJSONError(w, "Unknown project. Choose a tracked repository.", http.StatusBadRequest)
		return false
	}
	return true
}

func writeErr(w http.ResponseWriter, err error) {
	if errors.Is(err, os.ErrNotExist) {
		helpers.WriteJSONError(w, "Not found.", http.StatusNotFound)
		return
	}
	helpers.WriteJSONError(w, err.Error(), http.StatusBadRequest)
}

func HandleGetBoard(w http.ResponseWriter, r *http.Request) {
	project := r.URL.Query().Get("project")
	if !requireProject(w, project) {
		return
	}
	helpers.WriteJSONResponse(w, store.GetBoard(project))
}

func HandleCreateTasks(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Project string            `json:"project"`
		Tasks   []store.TaskPatch `json:"tasks"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.Tasks) == 0 {
		helpers.WriteJSONError(w, "project and at least one task are required.", http.StatusBadRequest)
		return
	}
	if !requireProject(w, body.Project) {
		return
	}
	created, err := store.CreateTasks(body.Project, body.Tasks)
	if err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusCreated)
	helpers.WriteJSONResponse(w, created)
}

func HandleUpdateTask(w http.ResponseWriter, r *http.Request) {
	var patch store.TaskPatch
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		helpers.WriteJSONError(w, "Invalid JSON body.", http.StatusBadRequest)
		return
	}
	t, err := store.UpdateTask(r.PathValue("id"), patch)
	if err != nil {
		writeErr(w, err)
		return
	}
	helpers.WriteJSONResponse(w, t)
}

func HandleDeleteTask(w http.ResponseWriter, r *http.Request) {
	if err := store.DeleteTask(r.PathValue("id")); err != nil {
		writeErr(w, err)
		return
	}
	helpers.WriteJSONResponse(w, map[string]bool{"success": true})
}

// issueBody renders a task as a GitHub issue body, with its checklist as task-list items.
func issueBody(t store.Task) string {
	var b strings.Builder
	b.WriteString(strings.TrimSpace(t.Description))
	if len(t.Checklist) > 0 {
		if b.Len() > 0 {
			b.WriteString("\n\n")
		}
		for _, it := range t.Checklist {
			mark := " "
			if it.Done {
				mark = "x"
			}
			fmt.Fprintf(&b, "- [%s] %s\n", mark, it.Text)
		}
	}
	if b.Len() == 0 {
		b.WriteString("Created from the Stitch Focus planner.")
	}
	return b.String()
}

// HandleCreateIssue opens a GitHub issue from a task and links it back.
func HandleCreateIssue(w http.ResponseWriter, r *http.Request) {
	t, ok := store.GetTask(r.PathValue("id"))
	if !ok {
		helpers.WriteJSONError(w, "Task not found.", http.StatusNotFound)
		return
	}
	if t.GitHubIssueURL != "" {
		helpers.WriteJSONResponse(w, t)
		return
	}
	repo, ok := trackedRepo(t.Project)
	if !ok || repo.Owner == "" || repo.Name == "" {
		helpers.WriteJSONError(w, "This project has no GitHub remote to create an issue in.", http.StatusBadRequest)
		return
	}

	// Arguments are passed directly, never through a shell, so task text can't inject commands.
	cmd := exec.Command("gh", "issue", "create", "-R", repo.Owner+"/"+repo.Name, "-t", t.Title, "-b", issueBody(t))
	out, err := cmd.CombinedOutput()
	if err != nil {
		helpers.WriteJSONError(w, "GitHub CLI failed: "+strings.TrimSpace(string(out)), http.StatusBadGateway)
		return
	}
	url := ""
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if strings.HasPrefix(line, "https://") {
			url = strings.TrimSpace(line)
		}
	}
	if url == "" {
		helpers.WriteJSONError(w, "GitHub CLI did not return an issue URL.", http.StatusBadGateway)
		return
	}
	updated, err := store.UpdateTask(t.ID, store.TaskPatch{GitHubIssueURL: &url})
	if err != nil {
		writeErr(w, err)
		return
	}
	helpers.WriteJSONResponse(w, updated)
}

func HandleCreateMeeting(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Project string `json:"project"`
		store.MeetingPatch
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		helpers.WriteJSONError(w, "Invalid JSON body.", http.StatusBadRequest)
		return
	}
	if !requireProject(w, body.Project) {
		return
	}
	m, err := store.CreateMeeting(body.Project, body.MeetingPatch)
	if err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusCreated)
	helpers.WriteJSONResponse(w, m)
}

func HandleUpdateMeeting(w http.ResponseWriter, r *http.Request) {
	var patch store.MeetingPatch
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		helpers.WriteJSONError(w, "Invalid JSON body.", http.StatusBadRequest)
		return
	}
	m, err := store.UpdateMeeting(r.PathValue("id"), patch)
	if err != nil {
		writeErr(w, err)
		return
	}
	helpers.WriteJSONResponse(w, m)
}

func HandleDeleteMeeting(w http.ResponseWriter, r *http.Request) {
	if err := store.DeleteMeeting(r.PathValue("id")); err != nil {
		writeErr(w, err)
		return
	}
	helpers.WriteJSONResponse(w, map[string]bool{"success": true})
}

var icsEscaper = strings.NewReplacer(`\`, `\\`, ";", `\;`, ",", `\,`, "\r\n", `\n`, "\n", `\n`)
var unsafeFilename = regexp.MustCompile(`[^A-Za-z0-9._-]+`)

// MeetingICS renders a meeting as an RFC 5545 calendar file.
func MeetingICS(m store.Meeting, project string) (string, error) {
	start, err := time.Parse(time.RFC3339, m.Start)
	if err != nil {
		return "", err
	}
	end := start.Add(time.Duration(m.DurationMin) * time.Minute)
	stamp := func(t time.Time) string { return t.UTC().Format("20060102T150405Z") }

	desc := strings.TrimSpace(m.Agenda)
	if project != "" {
		desc = strings.TrimSpace(desc + "\n\nProject: " + project)
	}
	lines := []string{
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Stitch//Focus planner//EN",
		"CALSCALE:GREGORIAN",
		"BEGIN:VEVENT",
		"UID:" + m.ID + "@stitch",
		"DTSTAMP:" + stamp(time.Now()),
		"DTSTART:" + stamp(start),
		"DTEND:" + stamp(end),
		"SUMMARY:" + icsEscaper.Replace(m.Title),
	}
	if desc != "" {
		lines = append(lines, "DESCRIPTION:"+icsEscaper.Replace(desc))
	}
	if m.Location != "" {
		lines = append(lines, "LOCATION:"+icsEscaper.Replace(m.Location))
	}
	for _, a := range m.Attendees {
		if strings.Contains(a, "@") && !strings.ContainsAny(a, "\r\n:;") {
			lines = append(lines, "ATTENDEE;RSVP=TRUE:mailto:"+a)
		}
	}
	lines = append(lines, "END:VEVENT", "END:VCALENDAR")
	return strings.Join(lines, "\r\n") + "\r\n", nil
}

func HandleMeetingICS(w http.ResponseWriter, r *http.Request) {
	m, ok := store.GetMeeting(r.PathValue("id"))
	if !ok {
		helpers.WriteJSONError(w, "Meeting not found.", http.StatusNotFound)
		return
	}
	ics, err := MeetingICS(m, m.Project)
	if err != nil {
		helpers.WriteJSONError(w, "Meeting has an invalid start time.", http.StatusInternalServerError)
		return
	}
	name := strings.Trim(unsafeFilename.ReplaceAllString(m.Title, "-"), "-")
	if name == "" {
		name = "meeting"
	}
	w.Header().Set("Content-Type", "text/calendar; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s.ics"`, name))
	w.Write([]byte(ics))
}

// Pages can be large documents; cap request bodies a little above the store's limit.
const maxPageRequest = 6 << 20

func HandleCreatePage(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxPageRequest)
	var body struct {
		Project string `json:"project"`
		store.PagePatch
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		helpers.WriteJSONError(w, "Invalid JSON body.", http.StatusBadRequest)
		return
	}
	if !requireProject(w, body.Project) {
		return
	}
	p, err := store.CreatePage(body.Project, body.PagePatch)
	if err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusCreated)
	helpers.WriteJSONResponse(w, p)
}

func HandleUpdatePage(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxPageRequest)
	var patch store.PagePatch
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		helpers.WriteJSONError(w, "Invalid JSON body or page too large.", http.StatusBadRequest)
		return
	}
	p, err := store.UpdatePage(r.PathValue("id"), patch)
	if err != nil {
		writeErr(w, err)
		return
	}
	helpers.WriteJSONResponse(w, p)
}

func HandleDeletePage(w http.ResponseWriter, r *http.Request) {
	if err := store.DeletePage(r.PathValue("id")); err != nil {
		writeErr(w, err)
		return
	}
	helpers.WriteJSONResponse(w, map[string]bool{"success": true})
}
