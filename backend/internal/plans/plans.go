package plans

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"
)

var (
	mu        sync.Mutex
	plansFile = "plans.json"
)

// Plan is a single local planning item tied to a repository.
type Plan struct {
	ID             string   `json:"id"`
	Project        string   `json:"project"` // "owner/name" or "/local/path"
	Title          string   `json:"title"`
	Description    string   `json:"description"`
	Tags           []string `json:"tags"`
	Status         string   `json:"status"` // todo | in-progress | blocked | done
	CreatedAt      string   `json:"createdAt"`
	UpdatedAt      string   `json:"updatedAt"`
	GitHubIssueURL string   `json:"githubIssueUrl"`
}

// DB is the top-level plans file structure.
type DB struct {
	Plans []Plan `json:"plans"`
}

// newID returns a UUID-v4-like string without external dependencies.
func newID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant bits
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// readDB reads plans.json from disk. Caller must hold mu.
func readDB() DB {
	var db DB
	data, err := os.ReadFile(plansFile)
	if err != nil {
		return DB{Plans: []Plan{}}
	}
	if err := json.Unmarshal(data, &db); err != nil {
		return DB{Plans: []Plan{}}
	}
	if db.Plans == nil {
		db.Plans = []Plan{}
	}
	return db
}

// writeDB persists DB to disk. Caller must hold mu.
func writeDB(db DB) {
	if db.Plans == nil {
		db.Plans = []Plan{}
	}
	data, err := json.MarshalIndent(db, "", "  ")
	if err != nil {
		fmt.Printf("plans: marshal error: %v\n", err)
		return
	}
	if err := os.WriteFile(plansFile, data, 0644); err != nil {
		fmt.Printf("plans: write error: %v\n", err)
	}
}

// Read returns the full plans database (thread-safe).
func Read() DB {
	mu.Lock()
	defer mu.Unlock()
	return readDB()
}

// Add creates and persists a new plan, returning the created Plan.
func Add(project, title, description string, tags []string, status string) Plan {
	mu.Lock()
	defer mu.Unlock()

	if status == "" {
		status = "todo"
	}
	if tags == nil {
		tags = []string{}
	}
	now := time.Now().Format(time.RFC3339)
	p := Plan{
		ID:          newID(),
		Project:     project,
		Title:       title,
		Description: description,
		Tags:        tags,
		Status:      status,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	db := readDB()
	db.Plans = append(db.Plans, p)
	writeDB(db)
	return p
}

// Update modifies an existing plan. Returns the updated Plan and true if found.
// Empty title is ignored. Tags and description are always overwritten.
func Update(id, title, description string, tags []string, status string) (Plan, bool) {
	mu.Lock()
	defer mu.Unlock()

	db := readDB()
	for i := range db.Plans {
		if db.Plans[i].ID == id {
			if title != "" {
				db.Plans[i].Title = title
			}
			db.Plans[i].Description = description
			if tags != nil {
				db.Plans[i].Tags = tags
			} else {
				db.Plans[i].Tags = []string{}
			}
			if status != "" {
				db.Plans[i].Status = status
			}
			db.Plans[i].UpdatedAt = time.Now().Format(time.RFC3339)
			writeDB(db)
			return db.Plans[i], true
		}
	}
	return Plan{}, false
}

// Delete removes a plan by ID. Returns true if the plan was found and removed.
func Delete(id string) bool {
	mu.Lock()
	defer mu.Unlock()

	db := readDB()
	newPlans := make([]Plan, 0, len(db.Plans))
	found := false
	for _, p := range db.Plans {
		if p.ID == id {
			found = true
			continue
		}
		newPlans = append(newPlans, p)
	}
	if !found {
		return false
	}
	db.Plans = newPlans
	writeDB(db)
	return true
}

// SetIssueURL persists the GitHub issue URL after a plan is promoted.
func SetIssueURL(id, url string) bool {
	mu.Lock()
	defer mu.Unlock()

	db := readDB()
	for i := range db.Plans {
		if db.Plans[i].ID == id {
			db.Plans[i].GitHubIssueURL = url
			db.Plans[i].UpdatedAt = time.Now().Format(time.RFC3339)
			writeDB(db)
			return true
		}
	}
	return false
}
