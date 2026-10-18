package monitor

import (
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// fileEntry is the metadata recorded for every regular file. File contents are never read.
type fileEntry struct {
	Rel       string // slash-separated, relative to the provider root
	Size      int64
	Modified  time.Time
	Created   time.Time
	Category  string
	Session   string
	Protected bool
}

type session struct {
	ID         string // root-relative path of the session file or directory
	Stem       string // id used by side data such as file-history/<stem>
	Group      string
	Dir        string // root-relative directory to prune once emptied, if any
	Bytes      int64
	Files      int
	Created    time.Time
	LastActive time.Time
}

type scanResult struct {
	Profile  providerProfile
	Root     string
	Exists   bool
	Files    []*fileEntry
	Sessions map[string]*session
	Duration time.Duration
}

var uuidRe = regexp.MustCompile(`[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`)

// matchPrefix reports whether the first segments of rel match pattern, returning the matched prefix.
func matchPrefix(pattern string, segs []string) (string, bool) {
	n := strings.Count(pattern, "/") + 1
	if len(segs) < n {
		return "", false
	}
	prefix := strings.Join(segs[:n], "/")
	ok, _ := path.Match(pattern, prefix)
	return prefix, ok
}

func (p providerProfile) isProtected(rel string) bool {
	segs := strings.Split(rel, "/")
	for _, pat := range p.Protected {
		if _, ok := matchPrefix(pat, segs); ok {
			return true
		}
	}
	base := strings.ToLower(segs[len(segs)-1])
	for _, pat := range protectedNames {
		if ok, _ := path.Match(pat, base); ok {
			return true
		}
	}
	return false
}

func (p providerProfile) categoryOf(rel string) string {
	for _, c := range p.Categories {
		for _, pre := range c.Prefixes {
			if rel == pre || strings.HasPrefix(rel, pre+"/") {
				return c.ID
			}
		}
	}
	if i := strings.IndexByte(rel, '/'); i > 0 {
		return "dir:" + rel[:i]
	}
	return "root"
}

// sessionOf resolves which session a file belongs to. The sibling-dir case returns the candidate
// session file id; it is only honoured if that session file actually exists.
func (p providerProfile) sessionOf(segs []string) (id string, rule sessionRule, sibling bool, ok bool) {
	for _, r := range p.Sessions {
		n := strings.Count(r.Pattern, "/") + 1
		prefix, matched := matchPrefix(r.Pattern, segs)
		switch {
		case r.Dir && matched && len(segs) > n:
			return prefix, r, false, true
		case !r.Dir && matched && len(segs) == n:
			return prefix, r, false, true
		case !r.Dir && r.SiblingDir && len(segs) > n:
			// e.g. projects/<p>/<uuid>/subagents/x.jsonl -> projects/<p>/<uuid>.jsonl
			ext := path.Ext(r.Pattern)
			candidate := strings.Join(segs[:n], "/") + ext
			if m, _ := path.Match(r.Pattern, candidate); m {
				return candidate, r, true, true
			}
		}
	}
	return "", sessionRule{}, false, false
}

func groupLabel(p providerProfile, r sessionRule, id string) string {
	if r.GroupSegment < 0 {
		return r.GroupLabel
	}
	segs := strings.Split(id, "/")
	if r.GroupSegment >= len(segs) {
		return ""
	}
	g := segs[r.GroupSegment]
	if p.ID == "claude" {
		return decodeClaudeProject(g)
	}
	return g
}

// decodeClaudeProject turns "-Users-me-my-repo" back into "/Users/me/my-repo". Claude encodes "/", "."
// and "-" all as "-", so each "-" is tried as a separator (only into existing directories) or a literal
// "-"/"." until a path that exists is found. Falls back to treating every "-" as "/".
func decodeClaudeProject(name string) string {
	if !strings.HasPrefix(name, "-") {
		return name
	}
	isDir := func(p string) bool {
		fi, err := os.Stat(p)
		return err == nil && fi.IsDir()
	}
	listings := map[string][]string{}
	// hasPrefix prunes branches: some entry of dir must start with the segment built so far.
	hasPrefix := func(dir, seg string) bool {
		names, ok := listings[dir]
		if !ok {
			entries, _ := os.ReadDir(dir + "/")
			for _, e := range entries {
				names = append(names, e.Name())
			}
			listings[dir] = names
		}
		for _, n := range names {
			if strings.HasPrefix(n, seg) {
				return true
			}
		}
		return false
	}
	budget := 5000
	var walk func(i int, dir, seg string) string
	walk = func(i int, dir, seg string) string {
		if budget--; budget < 0 || (seg != "" && !hasPrefix(dir, seg)) {
			return ""
		}
		if i == len(name) {
			if isDir(dir + "/" + seg) {
				return dir + "/" + seg
			}
			return ""
		}
		if c := name[i]; c != '-' {
			return walk(i+1, dir, seg+string(c))
		}
		if seg != "" && isDir(dir+"/"+seg) {
			if r := walk(i+1, dir+"/"+seg, ""); r != "" {
				return r
			}
		}
		if r := walk(i+1, dir, seg+"-"); r != "" {
			return r
		}
		return walk(i+1, dir, seg+".")
	}
	if r := walk(1, "", ""); r != "" {
		return r
	}
	return strings.ReplaceAll(name, "-", "/")
}

func providerRoot(id string) (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, "."+id), nil
}

// scan walks ~/.<provider> once, recording metadata for every regular file. Symlinks are not followed.
func scan(p providerProfile) (*scanResult, error) {
	start := time.Now()
	root, err := providerRoot(p.ID)
	if err != nil {
		return nil, err
	}
	res := &scanResult{Profile: p, Root: root, Sessions: map[string]*session{}}
	if fi, err := os.Stat(root); err != nil || !fi.IsDir() {
		res.Duration = time.Since(start)
		return res, nil
	}
	res.Exists = true

	type pending struct {
		file *fileEntry
		id   string
	}
	var siblings []pending

	filepath.WalkDir(root, func(abs string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || !d.Type().IsRegular() {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return nil
		}
		rel, err := filepath.Rel(root, abs)
		if err != nil {
			return nil
		}
		rel = filepath.ToSlash(rel)
		f := &fileEntry{
			Rel:       rel,
			Size:      info.Size(),
			Modified:  info.ModTime(),
			Created:   createdAt(info),
			Category:  p.categoryOf(rel),
			Protected: p.isProtected(rel),
		}
		res.Files = append(res.Files, f)

		if f.Protected {
			return nil
		}
		segs := strings.Split(rel, "/")
		id, rule, sibling, ok := p.sessionOf(segs)
		if !ok {
			return nil
		}
		if sibling {
			siblings = append(siblings, pending{f, id})
			return nil
		}
		s := res.Sessions[id]
		if s == nil {
			s = &session{ID: id, Group: groupLabel(p, rule, id)}
			base := path.Base(id)
			s.Stem = strings.TrimSuffix(base, path.Ext(base))
			if rule.Dir {
				s.Dir = id
				s.Stem = base
			}
			res.Sessions[id] = s
		}
		f.Session = id
		return nil
	})

	for _, sp := range siblings {
		if s := res.Sessions[sp.id]; s != nil {
			sp.file.Session = sp.id
			s.Dir = strings.TrimSuffix(sp.id, path.Ext(sp.id))
		}
	}
	for _, f := range res.Files {
		if s := res.Sessions[f.Session]; s != nil {
			s.Bytes += f.Size
			s.Files++
			if s.Created.IsZero() || f.Created.Before(s.Created) {
				s.Created = f.Created
			}
			if f.Modified.After(s.LastActive) {
				s.LastActive = f.Modified
			}
		}
	}
	res.Duration = time.Since(start)
	return res, nil
}

// sessionDataStem returns the session id a side-data file belongs to (file-history/<uuid>/..., todos/<uuid>-agent.json).
func (p providerProfile) sessionDataStem(rel string) (string, bool) {
	for _, dir := range p.SessionData {
		if strings.HasPrefix(rel, dir+"/") {
			child := strings.SplitN(strings.TrimPrefix(rel, dir+"/"), "/", 2)[0]
			if m := uuidRe.FindString(child); m != "" {
				return strings.ToLower(m), true
			}
		}
	}
	return "", false
}
