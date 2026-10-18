package monitor

import (
	"fmt"
	"path"
	"sort"
	"strings"
	"time"
)

const activityDays = 30

type amount struct {
	Files int   `json:"files"`
	Bytes int64 `json:"bytes"`
}

type categoryStat struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Description string `json:"description,omitempty"`
	Cleanable   bool   `json:"cleanable"`
	amount
}

type typeStat struct {
	Extension string `json:"extension"`
	amount
}

type dayStat struct {
	Date            string `json:"date"`
	FilesCreated    int    `json:"filesCreated"`
	BytesCreated    int64  `json:"bytesCreated"`
	SessionsStarted int    `json:"sessionsStarted"`
}

type sessionInfo struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Group      string    `json:"group"`
	Bytes      int64     `json:"bytes"`
	Files      int       `json:"files"`
	Created    time.Time `json:"created"`
	LastActive time.Time `json:"lastActive"`
}

type groupStat struct {
	Label      string    `json:"label"`
	Sessions   int       `json:"sessions"`
	Bytes      int64     `json:"bytes"`
	LastActive time.Time `json:"lastActive"`
}

type sessionStats struct {
	Supported     bool          `json:"supported"`
	Total         int           `json:"total"`
	Active7d      int           `json:"active7d"`
	Started7d     int           `json:"started7d"`
	Started30d    int           `json:"started30d"`
	PerActiveDay  float64       `json:"perActiveDay"`
	MedianBytes   int64         `json:"medianBytes"`
	LargestBytes  int64         `json:"largestBytes"`
	Stale         amount        `json:"stale"`
	StaleSessions int           `json:"staleSessions"`
	TinySessions  int           `json:"tinySessions"`
	List          []sessionInfo `json:"list"`
	Truncated     bool          `json:"truncated"`
}

type actionRef struct {
	Action   string `json:"action"`
	Days     int    `json:"days,omitempty"`
	Category string `json:"category,omitempty"`
}

type insight struct {
	Level  string     `json:"level"` // info | warn | critical | good
	Title  string     `json:"title"`
	Detail string     `json:"detail"`
	Action *actionRef `json:"action,omitempty"`
}

type actionInfo struct {
	actionRef
	Label       string `json:"label"`
	Description string `json:"description"`
	Estimate    amount `json:"estimate"`
	Sessions    int    `json:"sessions"`
}

type report struct {
	Provider    string         `json:"provider"`
	Label       string         `json:"label"`
	Root        string         `json:"root"`
	Exists      bool           `json:"exists"`
	ScannedAt   time.Time      `json:"scannedAt"`
	ScanMs      int64          `json:"scanMs"`
	Total       amount         `json:"total"`
	Media       amount         `json:"media"`
	Created7d   amount         `json:"created7d"`
	Created30d  amount         `json:"created30d"`
	Categories  []categoryStat `json:"categories"`
	FileTypes   []typeStat     `json:"fileTypes"`
	Activity    []dayStat      `json:"activity"`
	Sessions    sessionStats   `json:"sessions"`
	Groups      []groupStat    `json:"groups"`
	Insights    []insight      `json:"insights"`
	Actions     []actionInfo   `json:"actions"`
	Reclaimable amount         `json:"reclaimable"`
}

func dayKey(t time.Time) string { return t.Local().Format("2006-01-02") }

func buildReport(res *scanResult, now time.Time) *report {
	p := res.Profile
	r := &report{
		Provider:   p.ID,
		Label:      p.Label,
		Root:       res.Root,
		Exists:     res.Exists,
		ScannedAt:  now,
		ScanMs:     res.Duration.Milliseconds(),
		Categories: []categoryStat{},
		FileTypes:  []typeStat{},
		Groups:     []groupStat{},
		Insights:   []insight{},
		Actions:    []actionInfo{},
	}
	r.Sessions.Supported = len(p.Sessions) > 0
	r.Sessions.List = []sessionInfo{}

	// Activity buckets for the last 30 days, oldest first.
	days := make([]dayStat, activityDays)
	dayIdx := map[string]int{}
	for i := range days {
		d := now.AddDate(0, 0, i-activityDays+1)
		days[i].Date = dayKey(d)
		dayIdx[days[i].Date] = i
	}
	since7 := now.AddDate(0, 0, -7)
	since30 := now.AddDate(0, 0, -activityDays)

	cats := map[string]*categoryStat{}
	catOrder := []string{}
	for _, c := range p.Categories {
		cats[c.ID] = &categoryStat{ID: c.ID, Label: c.Label, Description: c.Description, Cleanable: c.Cleanable}
		catOrder = append(catOrder, c.ID)
	}
	types := map[string]*typeStat{}

	for _, f := range res.Files {
		r.Total.Files++
		r.Total.Bytes += f.Size

		c := cats[f.Category]
		if c == nil {
			label := strings.TrimPrefix(f.Category, "dir:")
			if f.Category == "root" {
				label = "Top-level files"
			}
			c = &categoryStat{ID: f.Category, Label: label}
			cats[f.Category] = c
			catOrder = append(catOrder, f.Category)
		}
		c.Files++
		c.Bytes += f.Size

		ext := strings.ToLower(strings.TrimPrefix(path.Ext(f.Rel), "."))
		if ext == "" || len(ext) > 8 {
			ext = "(none)"
		}
		t := types[ext]
		if t == nil {
			t = &typeStat{Extension: ext}
			types[ext] = t
		}
		t.Files++
		t.Bytes += f.Size

		if mediaExts["."+ext] {
			r.Media.Files++
			r.Media.Bytes += f.Size
		}
		if f.Created.After(since7) {
			r.Created7d.Files++
			r.Created7d.Bytes += f.Size
		}
		if f.Created.After(since30) {
			r.Created30d.Files++
			r.Created30d.Bytes += f.Size
		}
		if i, ok := dayIdx[dayKey(f.Created)]; ok {
			days[i].FilesCreated++
			days[i].BytesCreated += f.Size
		}
	}

	for _, id := range catOrder {
		if c := cats[id]; c.Files > 0 {
			r.Categories = append(r.Categories, *c)
		}
	}
	sort.SliceStable(r.Categories, func(i, j int) bool { return r.Categories[i].Bytes > r.Categories[j].Bytes })

	for _, t := range types {
		r.FileTypes = append(r.FileTypes, *t)
	}
	sort.Slice(r.FileTypes, func(i, j int) bool { return r.FileTypes[i].Bytes > r.FileTypes[j].Bytes })
	if len(r.FileTypes) > 10 {
		other := typeStat{Extension: "other"}
		for _, t := range r.FileTypes[9:] {
			other.Files += t.Files
			other.Bytes += t.Bytes
		}
		r.FileTypes = append(r.FileTypes[:9], other)
	}

	// Sessions.
	staleBefore := now.AddDate(0, 0, -30)
	tinyIdle := now.Add(-24 * time.Hour)
	groups := map[string]*groupStat{}
	sizes := []int64{}
	activeDays := map[string]bool{}
	for _, s := range res.Sessions {
		ss := &r.Sessions
		ss.Total++
		sizes = append(sizes, s.Bytes)
		if s.Bytes > ss.LargestBytes {
			ss.LargestBytes = s.Bytes
		}
		if s.LastActive.After(since7) {
			ss.Active7d++
		}
		if s.Created.After(since7) {
			ss.Started7d++
		}
		if s.Created.After(since30) {
			ss.Started30d++
			activeDays[dayKey(s.Created)] = true
		}
		if i, ok := dayIdx[dayKey(s.Created)]; ok {
			days[i].SessionsStarted++
		}
		if s.LastActive.Before(staleBefore) {
			ss.StaleSessions++
			ss.Stale.Files += s.Files
			ss.Stale.Bytes += s.Bytes
		}
		if s.Bytes < tinySessionBytes && s.LastActive.Before(tinyIdle) {
			ss.TinySessions++
		}
		ss.List = append(ss.List, sessionInfo{
			ID: s.ID, Name: s.Stem, Group: s.Group, Bytes: s.Bytes, Files: s.Files,
			Created: s.Created, LastActive: s.LastActive,
		})
		g := groups[s.Group]
		if g == nil {
			g = &groupStat{Label: s.Group}
			groups[s.Group] = g
		}
		g.Sessions++
		g.Bytes += s.Bytes
		if s.LastActive.After(g.LastActive) {
			g.LastActive = s.LastActive
		}
	}
	if len(activeDays) > 0 {
		r.Sessions.PerActiveDay = float64(r.Sessions.Started30d) / float64(len(activeDays))
	}
	if len(sizes) > 0 {
		sort.Slice(sizes, func(i, j int) bool { return sizes[i] < sizes[j] })
		r.Sessions.MedianBytes = sizes[len(sizes)/2]
	}
	sort.Slice(r.Sessions.List, func(i, j int) bool {
		return r.Sessions.List[i].LastActive.After(r.Sessions.List[j].LastActive)
	})
	if len(r.Sessions.List) > 1000 {
		r.Sessions.List = r.Sessions.List[:1000]
		r.Sessions.Truncated = true
	}
	for _, g := range groups {
		r.Groups = append(r.Groups, *g)
	}
	sort.Slice(r.Groups, func(i, j int) bool { return r.Groups[i].Bytes > r.Groups[j].Bytes })
	if len(r.Groups) > 20 {
		r.Groups = r.Groups[:20]
	}
	r.Activity = days

	r.Actions = buildActions(res, now, &r.Reclaimable)
	r.Insights = buildInsights(r)
	return r
}

// buildActions dry-runs every applicable cleanup so the UI can show what each would free.
// reclaimable receives the de-duplicated total across all actions.
func buildActions(res *scanResult, now time.Time, reclaimable *amount) []actionInfo {
	p := res.Profile
	type spec struct {
		ref         actionRef
		label, desc string
	}
	specs := []spec{}
	if len(p.Sessions) > 0 {
		specs = append(specs,
			spec{actionRef{Action: "stale-sessions", Days: 30}, "Delete stale sessions", "Sessions with no activity for 30+ days, plus their side data."},
			spec{actionRef{Action: "tiny-sessions"}, "Delete empty sessions", "Sessions under 4 KB idle for a day: usually abandoned or accidental chats."},
		)
	}
	if len(p.SessionData) > 0 {
		specs = append(specs, spec{actionRef{Action: "orphans"}, "Remove orphaned session data", "File history, todos and logs left behind by sessions that no longer exist."})
	}
	specs = append(specs,
		spec{actionRef{Action: "media"}, "Delete screenshots & recordings", "Images and videos captured by browser automation and agents."},
		spec{actionRef{Action: "logs"}, "Delete log files", "Plain .log files."},
	)
	for _, c := range p.Categories {
		if c.Cleanable {
			specs = append(specs, spec{actionRef{Action: "category", Category: c.ID, Days: 7}, "Clear " + strings.ToLower(c.Label), c.Description + " Only files older than 7 days."})
		}
	}

	seen := map[string]bool{}
	out := []actionInfo{}
	for _, s := range specs {
		plan, err := buildPlan(res, cleanupRequest{Action: s.ref.Action, Days: s.ref.Days, Category: s.ref.Category}, now)
		if err != nil {
			continue
		}
		for _, f := range plan.targets {
			if !seen[f.Rel] {
				seen[f.Rel] = true
				reclaimable.Files++
				reclaimable.Bytes += f.Size
			}
		}
		out = append(out, actionInfo{
			actionRef:   s.ref,
			Label:       s.label,
			Description: s.desc,
			Estimate:    amount{Files: plan.Files, Bytes: plan.Bytes},
			Sessions:    plan.Sessions,
		})
	}
	return out
}

func human(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGT"[exp])
}

const (
	mb = int64(1024 * 1024)
	gb = 1024 * mb
)

func buildInsights(r *report) []insight {
	out := []insight{}
	if !r.Exists {
		return out
	}
	action := func(id string) *actionInfo {
		for i := range r.Actions {
			if r.Actions[i].Action == id {
				return &r.Actions[i]
			}
		}
		return nil
	}

	switch {
	case r.Total.Bytes > 5*gb:
		out = append(out, insight{Level: "critical", Title: "Very large footprint", Detail: fmt.Sprintf("~/.%s uses %s across %d files.", r.Provider, human(r.Total.Bytes), r.Total.Files)})
	case r.Total.Bytes > gb:
		out = append(out, insight{Level: "warn", Title: "Large footprint", Detail: fmt.Sprintf("~/.%s uses %s across %d files.", r.Provider, human(r.Total.Bytes), r.Total.Files)})
	}

	// Growth rate: what last week's creations add up to over a month.
	if r.Created7d.Bytes > 50*mb {
		monthly := r.Created7d.Bytes * 30 / 7
		level := "info"
		if monthly > gb {
			level = "warn"
		}
		out = append(out, insight{Level: level, Title: "Fast storage growth", Detail: fmt.Sprintf("%s of new files in the last 7 days, about %s per month at this pace.", human(r.Created7d.Bytes), human(monthly))})
	}
	if r.Created7d.Files > 5000 {
		out = append(out, insight{Level: "warn", Title: "High file churn", Detail: fmt.Sprintf("%d files created in the last 7 days (%d/day). Agents writing snapshots or screenshots per step are the usual cause.", r.Created7d.Files, r.Created7d.Files/7)})
	}

	if r.Media.Bytes > 50*mb && r.Total.Bytes > 0 && r.Media.Bytes*100/r.Total.Bytes >= 30 {
		a := action("media")
		out = append(out, insight{Level: "warn", Title: "Media dominates storage", Detail: fmt.Sprintf("Screenshots and recordings take %s (%d%% of the folder).", human(r.Media.Bytes), r.Media.Bytes*100/r.Total.Bytes), Action: refOf(a)})
	}

	s := r.Sessions
	if s.Supported && s.Total > 0 {
		if s.PerActiveDay >= 15 {
			out = append(out, insight{Level: "warn", Title: "Lots of new chats", Detail: fmt.Sprintf("You start about %.0f sessions on a typical active day (%d in the last 30 days). Resuming an existing session keeps context and cuts clutter.", s.PerActiveDay, s.Started30d)})
		} else if s.Started7d > 0 {
			out = append(out, insight{Level: "info", Title: "Session pace", Detail: fmt.Sprintf("%d sessions started in the last 7 days, %d in the last 30 (≈%.1f per active day).", s.Started7d, s.Started30d, s.PerActiveDay)})
		}
		if s.StaleSessions >= 20 || s.Stale.Bytes > 200*mb {
			out = append(out, insight{Level: "warn", Title: "Stale sessions piling up", Detail: fmt.Sprintf("%d of %d sessions haven't been touched in 30+ days, holding %s.", s.StaleSessions, s.Total, human(s.Stale.Bytes)), Action: refOf(action("stale-sessions"))})
		}
		if s.TinySessions >= 10 {
			out = append(out, insight{Level: "info", Title: "Abandoned chats", Detail: fmt.Sprintf("%d sessions are under 4 KB: opened and left without real work.", s.TinySessions), Action: refOf(action("tiny-sessions"))})
		}
		if s.LargestBytes > 100*mb || (s.Total > 5 && r.Total.Bytes > 0 && s.LargestBytes*4 > r.Total.Bytes) {
			out = append(out, insight{Level: "info", Title: "One session is outsized", Detail: fmt.Sprintf("The largest session is %s (median is %s). Find it in the Sessions table sorted by size.", human(s.LargestBytes), human(s.MedianBytes))})
		}
	}

	if a := action("orphans"); a != nil && a.Estimate.Bytes > 10*mb {
		out = append(out, insight{Level: "info", Title: "Orphaned session data", Detail: fmt.Sprintf("%s of side data belongs to sessions that no longer exist.", human(a.Estimate.Bytes)), Action: refOf(a)})
	}
	for i := range r.Actions {
		a := &r.Actions[i]
		if a.Action == "category" && a.Estimate.Bytes > 100*mb {
			out = append(out, insight{Level: "info", Title: "Cache worth clearing", Detail: fmt.Sprintf("%s: %s older than a week.", strings.TrimPrefix(a.Label, "Clear "), human(a.Estimate.Bytes)), Action: refOf(a)})
		}
	}

	if len(out) == 0 {
		out = append(out, insight{Level: "good", Title: "Looking tidy", Detail: "No storage or usage concerns detected."})
	}
	rank := map[string]int{"critical": 0, "warn": 1, "info": 2, "good": 3}
	sort.SliceStable(out, func(i, j int) bool { return rank[out[i].Level] < rank[out[j].Level] })
	return out
}

func refOf(a *actionInfo) *actionRef {
	if a == nil || a.Estimate.Files == 0 {
		return nil
	}
	ref := a.actionRef
	return &ref
}
