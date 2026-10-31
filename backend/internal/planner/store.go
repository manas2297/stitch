// Package planner stores the Focus area's tasks, meetings and notes per project.
package planner

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"stitch/internal/config"
)

var (
	mu       sync.Mutex
	file     string
	fileOnce sync.Once
)

func dbFile() string {
	fileOnce.Do(func() {
		if file == "" {
			file = config.DataFile("focus.json")
		}
	})
	return file
}

var (
	Statuses   = []string{"backlog", "todo", "in-progress", "review", "blocked", "done"}
	Priorities = []string{"urgent", "high", "medium", "low", "none"}
)

type ChecklistItem struct {
	ID   string `json:"id"`
	Text string `json:"text"`
	Done bool   `json:"done"`
}

type Task struct {
	ID             string          `json:"id"`
	Project        string          `json:"project"` // focus value: local path or owner/name
	Title          string          `json:"title"`
	Description    string          `json:"description"`
	Status         string          `json:"status"`
	Priority       string          `json:"priority"`
	Tags           []string        `json:"tags"`
	DueDate        string          `json:"dueDate,omitempty"`     // YYYY-MM-DD
	ScheduledAt    string          `json:"scheduledAt,omitempty"` // RFC3339 time block start
	DurationMin    int             `json:"durationMin,omitempty"`
	Checklist      []ChecklistItem `json:"checklist"`
	Order          float64         `json:"order"`
	GitHubIssueURL string          `json:"githubIssueUrl,omitempty"`
	MeetingID      string          `json:"meetingId,omitempty"` // set when created from meeting action items
	CreatedAt      string          `json:"createdAt"`
	UpdatedAt      string          `json:"updatedAt"`
	CompletedAt    string          `json:"completedAt,omitempty"`
}

type Meeting struct {
	ID          string   `json:"id"`
	Project     string   `json:"project"`
	Title       string   `json:"title"`
	Start       string   `json:"start"` // RFC3339
	DurationMin int      `json:"durationMin"`
	Location    string   `json:"location"` // video link or room
	Attendees   []string `json:"attendees"`
	Agenda      string   `json:"agenda"`
	Notes       string   `json:"notes"`
	CreatedAt   string   `json:"createdAt"`
	UpdatedAt   string   `json:"updatedAt"`
}

// Note is the original single scratchpad per project, kept only to migrate old files.
type Note struct {
	Project   string `json:"project"`
	Content   string `json:"content"`
	UpdatedAt string `json:"updatedAt"`
}

// Page is a rich notes document. Content is the editor's JSON document, or plain
// text for pages migrated from the old scratchpad (the client converts it on load).
type Page struct {
	ID        string `json:"id"`
	Project   string `json:"project"`
	Title     string `json:"title"`
	Icon      string `json:"icon"`
	Content   string `json:"content"`
	Pinned    bool   `json:"pinned"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

type DB struct {
	Tasks    []Task    `json:"tasks"`
	Meetings []Meeting `json:"meetings"`
	Pages    []Page    `json:"pages"`
	Notes    []Note    `json:"notes,omitempty"`
}

// Board is everything the Focus area needs for one project.
type Board struct {
	Tasks    []Task    `json:"tasks"`
	Meetings []Meeting `json:"meetings"`
	Pages    []Page    `json:"pages"`
}

func NewID() string {
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%x", b)
}

func now() string { return time.Now().Format(time.RFC3339) }

func readDB() DB {
	var db DB
	if data, err := os.ReadFile(dbFile()); err == nil {
		if err := json.Unmarshal(data, &db); err != nil {
			fmt.Printf("planner: parse error, starting empty: %v\n", err)
			db = DB{}
		}
	}
	if db.Tasks == nil {
		db.Tasks = []Task{}
	}
	if db.Meetings == nil {
		db.Meetings = []Meeting{}
	}
	if db.Pages == nil {
		db.Pages = []Page{}
	}
	if len(db.Notes) > 0 {
		migrateNotes(&db)
	}
	return db
}

// migrateNotes turns each old scratchpad into a "Notes" page and persists right away,
// so the new page IDs are stable across reads.
func migrateNotes(db *DB) {
	for _, n := range db.Notes {
		if strings.TrimSpace(n.Content) == "" {
			continue
		}
		ts := n.UpdatedAt
		if ts == "" {
			ts = now()
		}
		db.Pages = append(db.Pages, Page{ID: NewID(), Project: n.Project, Title: "Notes", Icon: "📝", Content: n.Content, CreatedAt: ts, UpdatedAt: ts})
	}
	db.Notes = nil
	if err := writeDB(*db); err != nil {
		fmt.Printf("planner: could not persist notes migration: %v\n", err)
	}
}

// writeDB writes via a temp file and rename so a crash never leaves half a file.
func writeDB(db DB) error {
	data, err := json.MarshalIndent(db, "", "  ")
	if err != nil {
		return err
	}
	tmp := dbFile() + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, dbFile())
}

func contains(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

func validDate(s string) bool {
	_, err := time.Parse("2006-01-02", s)
	return err == nil
}

func validTime(s string) bool {
	_, err := time.Parse(time.RFC3339, s)
	return err == nil
}

func cleanTags(tags []string) []string {
	out := []string{}
	seen := map[string]bool{}
	for _, t := range tags {
		t = strings.TrimSpace(strings.TrimPrefix(t, "#"))
		if t != "" && !seen[strings.ToLower(t)] {
			seen[strings.ToLower(t)] = true
			out = append(out, t)
		}
	}
	return out
}

// GetBoard returns a project's tasks (by status order), meetings (by start) and note.
func GetBoard(project string) Board {
	mu.Lock()
	defer mu.Unlock()
	db := readDB()
	b := Board{Tasks: []Task{}, Meetings: []Meeting{}, Pages: []Page{}}
	for _, t := range db.Tasks {
		if t.Project == project {
			b.Tasks = append(b.Tasks, t)
		}
	}
	for _, m := range db.Meetings {
		if m.Project == project {
			b.Meetings = append(b.Meetings, m)
		}
	}
	for _, p := range db.Pages {
		if p.Project == project {
			b.Pages = append(b.Pages, p)
		}
	}
	sort.SliceStable(b.Tasks, func(i, j int) bool { return b.Tasks[i].Order < b.Tasks[j].Order })
	sort.SliceStable(b.Meetings, func(i, j int) bool { return b.Meetings[i].Start < b.Meetings[j].Start })
	sort.SliceStable(b.Pages, func(i, j int) bool { return b.Pages[i].UpdatedAt > b.Pages[j].UpdatedAt })
	return b
}

// TaskPatch holds optional fields; nil means "leave unchanged".
type TaskPatch struct {
	Title          *string          `json:"title"`
	Description    *string          `json:"description"`
	Status         *string          `json:"status"`
	Priority       *string          `json:"priority"`
	Tags           *[]string        `json:"tags"`
	DueDate        *string          `json:"dueDate"`
	ScheduledAt    *string          `json:"scheduledAt"`
	DurationMin    *int             `json:"durationMin"`
	Checklist      *[]ChecklistItem `json:"checklist"`
	Order          *float64         `json:"order"`
	GitHubIssueURL *string          `json:"githubIssueUrl"`
	MeetingID      *string          `json:"meetingId"`
}

// apply validates and applies a patch; empty strings clear optional dates.
func (p TaskPatch) apply(t *Task) error {
	if p.Title != nil {
		title := strings.TrimSpace(*p.Title)
		if title == "" {
			return fmt.Errorf("title cannot be empty")
		}
		t.Title = title
	}
	if p.Description != nil {
		t.Description = *p.Description
	}
	if p.Status != nil {
		if !contains(Statuses, *p.Status) {
			return fmt.Errorf("unknown status %q", *p.Status)
		}
		if *p.Status == "done" && t.Status != "done" {
			t.CompletedAt = now()
		} else if *p.Status != "done" {
			t.CompletedAt = ""
		}
		t.Status = *p.Status
	}
	if p.Priority != nil {
		if !contains(Priorities, *p.Priority) {
			return fmt.Errorf("unknown priority %q", *p.Priority)
		}
		t.Priority = *p.Priority
	}
	if p.Tags != nil {
		t.Tags = cleanTags(*p.Tags)
	}
	if p.DueDate != nil {
		if *p.DueDate != "" && !validDate(*p.DueDate) {
			return fmt.Errorf("dueDate must be YYYY-MM-DD")
		}
		t.DueDate = *p.DueDate
	}
	if p.ScheduledAt != nil {
		if *p.ScheduledAt != "" && !validTime(*p.ScheduledAt) {
			return fmt.Errorf("scheduledAt must be an RFC3339 timestamp")
		}
		t.ScheduledAt = *p.ScheduledAt
		if t.ScheduledAt != "" && t.DurationMin == 0 && p.DurationMin == nil {
			t.DurationMin = 60
		}
	}
	if p.DurationMin != nil {
		if *p.DurationMin < 0 || *p.DurationMin > 24*60 {
			return fmt.Errorf("durationMin must be between 0 and 1440")
		}
		t.DurationMin = *p.DurationMin
	}
	if p.Checklist != nil {
		items := []ChecklistItem{}
		for _, it := range *p.Checklist {
			it.Text = strings.TrimSpace(it.Text)
			if it.Text == "" {
				continue
			}
			if it.ID == "" {
				it.ID = NewID()
			}
			items = append(items, it)
		}
		t.Checklist = items
	}
	if p.Order != nil {
		t.Order = *p.Order
	}
	if p.GitHubIssueURL != nil {
		t.GitHubIssueURL = *p.GitHubIssueURL
	}
	if p.MeetingID != nil {
		t.MeetingID = *p.MeetingID
	}
	return nil
}

// CreateTasks adds tasks for a project in one write; new tasks go to the end of their column.
func CreateTasks(project string, patches []TaskPatch) ([]Task, error) {
	mu.Lock()
	defer mu.Unlock()
	db := readDB()

	maxOrder := 0.0
	for _, t := range db.Tasks {
		if t.Project == project && t.Order > maxOrder {
			maxOrder = t.Order
		}
	}
	created := []Task{}
	for i, p := range patches {
		ts := now()
		t := Task{ID: NewID(), Project: project, Status: "todo", Priority: "none", Tags: []string{}, Checklist: []ChecklistItem{}, CreatedAt: ts, UpdatedAt: ts}
		if p.Title == nil {
			return nil, fmt.Errorf("title is required")
		}
		if err := p.apply(&t); err != nil {
			return nil, err
		}
		if p.Order == nil {
			t.Order = maxOrder + float64(i+1)*1024
		}
		created = append(created, t)
	}
	db.Tasks = append(db.Tasks, created...)
	return created, writeDB(db)
}

func UpdateTask(id string, p TaskPatch) (Task, error) {
	mu.Lock()
	defer mu.Unlock()
	db := readDB()
	for i := range db.Tasks {
		if db.Tasks[i].ID == id {
			updated := db.Tasks[i]
			if err := p.apply(&updated); err != nil {
				return Task{}, err
			}
			updated.UpdatedAt = now()
			db.Tasks[i] = updated
			return updated, writeDB(db)
		}
	}
	return Task{}, os.ErrNotExist
}

func DeleteTask(id string) error {
	mu.Lock()
	defer mu.Unlock()
	db := readDB()
	for i, t := range db.Tasks {
		if t.ID == id {
			db.Tasks = append(db.Tasks[:i], db.Tasks[i+1:]...)
			return writeDB(db)
		}
	}
	return os.ErrNotExist
}

func GetTask(id string) (Task, bool) {
	mu.Lock()
	defer mu.Unlock()
	for _, t := range readDB().Tasks {
		if t.ID == id {
			return t, true
		}
	}
	return Task{}, false
}

// MeetingPatch mirrors TaskPatch for meetings.
type MeetingPatch struct {
	Title       *string   `json:"title"`
	Start       *string   `json:"start"`
	DurationMin *int      `json:"durationMin"`
	Location    *string   `json:"location"`
	Attendees   *[]string `json:"attendees"`
	Agenda      *string   `json:"agenda"`
	Notes       *string   `json:"notes"`
}

func (p MeetingPatch) apply(m *Meeting) error {
	if p.Title != nil {
		title := strings.TrimSpace(*p.Title)
		if title == "" {
			return fmt.Errorf("title cannot be empty")
		}
		m.Title = title
	}
	if p.Start != nil {
		if !validTime(*p.Start) {
			return fmt.Errorf("start must be an RFC3339 timestamp")
		}
		m.Start = *p.Start
	}
	if p.DurationMin != nil {
		if *p.DurationMin <= 0 || *p.DurationMin > 24*60 {
			return fmt.Errorf("durationMin must be between 1 and 1440")
		}
		m.DurationMin = *p.DurationMin
	}
	if p.Location != nil {
		m.Location = strings.TrimSpace(*p.Location)
	}
	if p.Attendees != nil {
		m.Attendees = []string{}
		for _, a := range *p.Attendees {
			if a = strings.TrimSpace(a); a != "" {
				m.Attendees = append(m.Attendees, a)
			}
		}
	}
	if p.Agenda != nil {
		m.Agenda = *p.Agenda
	}
	if p.Notes != nil {
		m.Notes = *p.Notes
	}
	return nil
}

func CreateMeeting(project string, p MeetingPatch) (Meeting, error) {
	if p.Title == nil || p.Start == nil {
		return Meeting{}, fmt.Errorf("title and start are required")
	}
	mu.Lock()
	defer mu.Unlock()
	ts := now()
	m := Meeting{ID: NewID(), Project: project, DurationMin: 30, Attendees: []string{}, CreatedAt: ts, UpdatedAt: ts}
	if err := p.apply(&m); err != nil {
		return Meeting{}, err
	}
	db := readDB()
	db.Meetings = append(db.Meetings, m)
	return m, writeDB(db)
}

func UpdateMeeting(id string, p MeetingPatch) (Meeting, error) {
	mu.Lock()
	defer mu.Unlock()
	db := readDB()
	for i := range db.Meetings {
		if db.Meetings[i].ID == id {
			updated := db.Meetings[i]
			if err := p.apply(&updated); err != nil {
				return Meeting{}, err
			}
			updated.UpdatedAt = now()
			db.Meetings[i] = updated
			return updated, writeDB(db)
		}
	}
	return Meeting{}, os.ErrNotExist
}

func DeleteMeeting(id string) error {
	mu.Lock()
	defer mu.Unlock()
	db := readDB()
	for i, m := range db.Meetings {
		if m.ID == id {
			db.Meetings = append(db.Meetings[:i], db.Meetings[i+1:]...)
			return writeDB(db)
		}
	}
	return os.ErrNotExist
}

func GetMeeting(id string) (Meeting, bool) {
	mu.Lock()
	defer mu.Unlock()
	for _, m := range readDB().Meetings {
		if m.ID == id {
			return m, true
		}
	}
	return Meeting{}, false
}

// PagePatch holds optional page fields; nil means "leave unchanged".
type PagePatch struct {
	Title   *string `json:"title"`
	Icon    *string `json:"icon"`
	Content *string `json:"content"`
	Pinned  *bool   `json:"pinned"`
}

const maxPageBytes = 5 << 20

func (p PagePatch) apply(pg *Page) error {
	if p.Title != nil {
		pg.Title = strings.TrimSpace(*p.Title)
	}
	if p.Icon != nil {
		if len(*p.Icon) > 16 {
			return fmt.Errorf("icon must be a single emoji")
		}
		pg.Icon = *p.Icon
	}
	if p.Content != nil {
		if len(*p.Content) > maxPageBytes {
			return fmt.Errorf("page is too large (max 5 MB)")
		}
		pg.Content = *p.Content
	}
	if p.Pinned != nil {
		pg.Pinned = *p.Pinned
	}
	return nil
}

func CreatePage(project string, p PagePatch) (Page, error) {
	mu.Lock()
	defer mu.Unlock()
	ts := now()
	pg := Page{ID: NewID(), Project: project, CreatedAt: ts, UpdatedAt: ts}
	if err := p.apply(&pg); err != nil {
		return Page{}, err
	}
	db := readDB()
	db.Pages = append(db.Pages, pg)
	return pg, writeDB(db)
}

func UpdatePage(id string, p PagePatch) (Page, error) {
	mu.Lock()
	defer mu.Unlock()
	db := readDB()
	for i := range db.Pages {
		if db.Pages[i].ID == id {
			updated := db.Pages[i]
			if err := p.apply(&updated); err != nil {
				return Page{}, err
			}
			updated.UpdatedAt = now()
			db.Pages[i] = updated
			return updated, writeDB(db)
		}
	}
	return Page{}, os.ErrNotExist
}

func DeletePage(id string) error {
	mu.Lock()
	defer mu.Unlock()
	db := readDB()
	for i, p := range db.Pages {
		if p.ID == id {
			db.Pages = append(db.Pages[:i], db.Pages[i+1:]...)
			return writeDB(db)
		}
	}
	return os.ErrNotExist
}
