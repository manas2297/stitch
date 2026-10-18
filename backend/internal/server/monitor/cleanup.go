package monitor

import (
	"errors"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// recentGuard protects anything touched this recently, so a running session is never deleted from under itself.
const recentGuard = 15 * time.Minute

// tinySessionBytes is the size below which a session is considered empty or abandoned.
const tinySessionBytes = 4 * 1024

type cleanupRequest struct {
	Action   string   `json:"action"`
	Days     int      `json:"days,omitempty"`
	Category string   `json:"category,omitempty"`
	IDs      []string `json:"ids,omitempty"`
	DryRun   bool     `json:"dryRun"`
}

type cleanupPlan struct {
	Action        string   `json:"action"`
	Files         int      `json:"files"`
	Bytes         int64    `json:"bytes"`
	Sessions      int      `json:"sessions"`
	SkippedRecent int      `json:"skippedRecent"`
	Sample        []string `json:"sample"`

	targets []*fileEntry
	prune   []string
}

type cleanupResult struct {
	cleanupPlan
	DryRun     bool  `json:"dryRun"`
	Deleted    int   `json:"deleted"`
	FreedBytes int64 `json:"freedBytes"`
	Failed     int   `json:"failed"`
}

func (p *cleanupPlan) add(f *fileEntry) {
	p.targets = append(p.targets, f)
	p.Files++
	p.Bytes += f.Size
}

func (p *cleanupPlan) finish() {
	sort.Slice(p.targets, func(i, j int) bool { return p.targets[i].Size > p.targets[j].Size })
	p.Sample = []string{}
	for i := 0; i < len(p.targets) && i < 8; i++ {
		p.Sample = append(p.Sample, p.targets[i].Rel)
	}
}

func isRecent(t, now time.Time) bool { return now.Sub(t) < recentGuard }

// planSessions deletes whole sessions plus their side data (file-history/<id>, todos/<id>..., etc).
func planSessions(res *scanResult, now time.Time, pick func(*session) bool) *cleanupPlan {
	plan := &cleanupPlan{}
	chosen := map[string]bool{}
	stems := map[string]bool{}
	for id, s := range res.Sessions {
		if !pick(s) {
			continue
		}
		if isRecent(s.LastActive, now) {
			plan.SkippedRecent++
			continue
		}
		chosen[id] = true
		stems[strings.ToLower(s.Stem)] = true
		plan.Sessions++
		if s.Dir != "" {
			plan.prune = append(plan.prune, s.Dir)
		}
	}
	for _, f := range res.Files {
		if f.Protected || isRecent(f.Modified, now) {
			continue
		}
		if chosen[f.Session] {
			plan.add(f)
		} else if stem, ok := res.Profile.sessionDataStem(f.Rel); ok && stems[stem] {
			plan.add(f)
		}
	}
	return plan
}

// planFiles deletes individual files matching pick, skipping protected and recently modified ones.
func planFiles(res *scanResult, now time.Time, pick func(*fileEntry) bool) *cleanupPlan {
	plan := &cleanupPlan{}
	for _, f := range res.Files {
		if f.Protected || !pick(f) {
			continue
		}
		if isRecent(f.Modified, now) {
			plan.SkippedRecent++
			continue
		}
		plan.add(f)
	}
	return plan
}

func buildPlan(res *scanResult, req cleanupRequest, now time.Time) (*cleanupPlan, error) {
	days := req.Days
	cutoff := func(def int) time.Time {
		if days <= 0 {
			days = def
		}
		return now.AddDate(0, 0, -days)
	}
	var plan *cleanupPlan
	switch req.Action {
	case "media":
		plan = planFiles(res, now, func(f *fileEntry) bool { return mediaExts[strings.ToLower(path.Ext(f.Rel))] })
	case "logs":
		plan = planFiles(res, now, func(f *fileEntry) bool { return strings.HasSuffix(strings.ToLower(f.Rel), ".log") })
	case "stale-sessions":
		before := cutoff(30)
		plan = planSessions(res, now, func(s *session) bool { return s.LastActive.Before(before) })
	case "tiny-sessions":
		idle := now.Add(-24 * time.Hour)
		plan = planSessions(res, now, func(s *session) bool { return s.Bytes < tinySessionBytes && s.LastActive.Before(idle) })
	case "sessions":
		if len(req.IDs) == 0 {
			return nil, errors.New("no sessions selected")
		}
		ids := map[string]bool{}
		for _, id := range req.IDs {
			ids[id] = true
		}
		plan = planSessions(res, now, func(s *session) bool { return ids[s.ID] })
	case "category":
		var cat *category
		for i := range res.Profile.Categories {
			if res.Profile.Categories[i].ID == req.Category {
				cat = &res.Profile.Categories[i]
			}
		}
		if cat == nil || !cat.Cleanable {
			return nil, fmt.Errorf("category %q cannot be cleaned", req.Category)
		}
		before := cutoff(7)
		plan = planFiles(res, now, func(f *fileEntry) bool { return f.Category == cat.ID && f.Modified.Before(before) })
	case "orphans":
		live := map[string]bool{}
		for _, s := range res.Sessions {
			live[strings.ToLower(s.Stem)] = true
		}
		plan = planFiles(res, now, func(f *fileEntry) bool {
			stem, ok := res.Profile.sessionDataStem(f.Rel)
			return ok && !live[stem]
		})
	default:
		return nil, fmt.Errorf("unknown action %q", req.Action)
	}
	plan.Action = req.Action
	plan.finish()
	return plan, nil
}

// execute deletes the planned files one by one, re-checking that every path stays inside the root
// and is still a regular file, then prunes emptied session directories.
func execute(res *scanResult, plan *cleanupPlan) cleanupResult {
	out := cleanupResult{cleanupPlan: *plan}
	for _, f := range plan.targets {
		abs, ok := insideRoot(res.Root, f.Rel)
		if !ok {
			out.Failed++
			continue
		}
		fi, err := os.Lstat(abs)
		if err != nil || !fi.Mode().IsRegular() {
			out.Failed++
			continue
		}
		if err := os.Remove(abs); err != nil {
			out.Failed++
			continue
		}
		out.Deleted++
		out.FreedBytes += fi.Size()
		pruneSessionDataParents(res, f.Rel)
	}
	for _, dir := range plan.prune {
		if abs, ok := insideRoot(res.Root, dir); ok {
			pruneEmptyDirs(abs)
		}
	}
	return out
}

func insideRoot(root, rel string) (string, bool) {
	abs := filepath.Join(root, filepath.FromSlash(rel))
	r, err := filepath.Rel(root, abs)
	if err != nil || r == "." || r == ".." || strings.HasPrefix(r, ".."+string(filepath.Separator)) {
		return "", false
	}
	return abs, true
}

// pruneSessionDataParents removes directories emptied under a session-data dir (e.g. file-history/<uuid>),
// stopping at the session-data dir itself.
func pruneSessionDataParents(res *scanResult, rel string) {
	for _, top := range res.Profile.SessionData {
		if !strings.HasPrefix(rel, top+"/") {
			continue
		}
		for dir := path.Dir(rel); dir != top && strings.HasPrefix(dir, top+"/"); dir = path.Dir(dir) {
			abs, ok := insideRoot(res.Root, dir)
			if !ok || os.Remove(abs) != nil { // fails harmlessly if not empty
				return
			}
		}
	}
}

// pruneEmptyDirs removes dir and any empty directories beneath it, leaving anything non-empty alone.
func pruneEmptyDirs(dir string) {
	fi, err := os.Lstat(dir)
	if err != nil || !fi.IsDir() {
		return
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, e := range entries {
		if e.IsDir() {
			pruneEmptyDirs(filepath.Join(dir, e.Name()))
		}
	}
	os.Remove(dir) // fails harmlessly if not empty
}
