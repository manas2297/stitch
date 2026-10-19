package contributions

import "testing"

func TestParseCommitLog(t *testing.T) {
	out := "@2026-10-01 14\n\n10\t2\tsrc/app.tsx\n5\t5\tpackage-lock.json\n-\t-\tlogo.png\n3\t0\tsrc/{old => new}/util.go\n@2026-10-02 09\n1\t1\tDockerfile"
	commits := parseCommitLog(out, 3)
	if len(commits) != 2 {
		t.Fatalf("got %d commits, want 2", len(commits))
	}
	c := commits[0]
	if c.Date != "2026-10-01" || c.Hour != 14 || c.Repo != 3 {
		t.Errorf("header parsed as %+v", c)
	}
	if c.Additions != 13 || c.Deletions != 2 {
		t.Errorf("lines = +%d -%d, want +13 -2 (lockfile and binary excluded)", c.Additions, c.Deletions)
	}
	if c.Languages["tsx"] != 12 || c.Languages["go"] != 3 || len(c.Languages) != 2 {
		t.Errorf("languages = %v", c.Languages)
	}
	if commits[1].Languages["dockerfile"] != 2 {
		t.Errorf("second commit languages = %v", commits[1].Languages)
	}
}

func TestIsGenerated(t *testing.T) {
	for path, want := range map[string]bool{
		"go.sum":                      true,
		"web/node_modules/x/index.js": true,
		"dist/app.js":                 true,
		"assets/app.min.js":           true,
		"src/build.ts":                false,
		"cmd/main.go":                 false,
	} {
		if got := isGenerated(path); got != want {
			t.Errorf("isGenerated(%q) = %v, want %v", path, got, want)
		}
	}
}
