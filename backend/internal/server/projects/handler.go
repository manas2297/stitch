package projects

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"stitch/internal/server/helpers"
	"stitch/internal/shell"
)

// GitHub owner and repo names; anything else is rejected before reaching a shell command.
var repoPart = regexp.MustCompile(`^[A-Za-z0-9_.-]+$`)

// Tags and branches also come from the repo, so they're checked before use in a command too.
var refPart = regexp.MustCompile(`^[A-Za-z0-9_.+/-]+$`)

func decodeList(res shell.Result) []map[string]interface{} {
	out := []map[string]interface{}{}
	if res.Success && res.Stdout != "" {
		json.Unmarshal([]byte(res.Stdout), &out)
	}
	return out
}

func HandleProjectDetails(w http.ResponseWriter, r *http.Request) {
	owner := r.URL.Query().Get("owner")
	name := r.URL.Query().Get("name")
	if owner == "" || name == "" {
		helpers.WriteJSONError(w, "owner and name are required.", http.StatusBadRequest)
		return
	}
	if !repoPart.MatchString(owner) || !repoPart.MatchString(name) {
		helpers.WriteJSONError(w, "Invalid owner or name.", http.StatusBadRequest)
		return
	}
	slug := owner + "/" + name

	var issuesRes, prsRes, tagRes, latestTagRes, repoRes, releasesRes, runsRes, participationRes shell.Result

	jobs := []func(){
		func() {
			issuesRes = shell.RunCmd(fmt.Sprintf(`gh issue list --repo "%s" --json number,title,author,url,createdAt,updatedAt,labels,assignees --limit 100`, slug), "")
		},
		func() {
			prsRes = shell.RunCmd(fmt.Sprintf(`gh pr list --repo "%s" --state all --json number,title,author,url,createdAt,updatedAt,mergedAt,closedAt,reviewRequests,reviewDecision,state,isDraft,headRefName,additions,deletions --limit 60`, slug), "")
		},
		func() {
			tagRes = shell.RunCmd(fmt.Sprintf(`gh api repos/%s/releases/latest --jq .tag_name`, slug), "")
		},
		func() {
			latestTagRes = shell.RunCmd(fmt.Sprintf(`gh api "repos/%s/tags?per_page=1" --jq '.[0].name'`, slug), "")
		},
		func() {
			repoRes = shell.RunCmd(fmt.Sprintf(`gh repo view "%s" --json description,url,homepageUrl,stargazerCount,forkCount,isPrivate,isArchived,pushedAt,languages,defaultBranchRef,repositoryTopics`, slug), "")
		},
		func() {
			releasesRes = shell.RunCmd(fmt.Sprintf(`gh release list --repo "%s" --limit 6 --json tagName,name,publishedAt,isLatest,isPrerelease`, slug), "")
		},
		func() {
			runsRes = shell.RunCmd(fmt.Sprintf(`gh run list --repo "%s" --limit 20 --json status,conclusion,workflowName,displayTitle,url,headBranch,createdAt,event`, slug), "")
		},
		func() {
			participationRes = shell.RunCmd(fmt.Sprintf(`gh api repos/%s/stats/participation`, slug), "")
		},
	}
	var wg sync.WaitGroup
	for _, job := range jobs {
		wg.Add(1)
		go func(f func()) {
			defer wg.Done()
			f()
		}(job)
	}
	wg.Wait()

	var rawIssues []map[string]interface{}
	if issuesRes.Success {
		json.Unmarshal([]byte(issuesRes.Stdout), &rawIssues)
	}

	var rawPrs []map[string]interface{}
	if prsRes.Success {
		json.Unmarshal([]byte(prsRes.Stdout), &rawPrs)
	}

	// Prefer the latest release; fall back to the newest tag for repos that only tag.
	lastTag := "N/A"
	if tagRes.Success && tagRes.Stdout != "" {
		lastTag = tagRes.Stdout
	} else if latestTagRes.Success && latestTagRes.Stdout != "" && latestTagRes.Stdout != "null" {
		lastTag = latestTagRes.Stdout
	}

	var repoInfo map[string]interface{}
	if repoRes.Success {
		json.Unmarshal([]byte(repoRes.Stdout), &repoInfo)
	}

	// Commits on the default branch since the last tag show how much work is waiting to ship.
	unreleased := -1
	if lastTag != "N/A" && refPart.MatchString(lastTag) && repoInfo != nil {
		if ref, ok := repoInfo["defaultBranchRef"].(map[string]interface{}); ok {
			if branch, _ := ref["name"].(string); branch != "" && refPart.MatchString(branch) {
				cmp := shell.RunCmd(fmt.Sprintf(`gh api "repos/%s/compare/%s...%s" --jq .ahead_by`, slug, lastTag, branch), "")
				if n, err := strconv.Atoi(strings.TrimSpace(cmp.Stdout)); cmp.Success && err == nil {
					unreleased = n
				}
			}
		}
	}

	// stats/participation is weekly commit counts for the last 52 weeks; GitHub may still be computing it.
	var participation struct {
		All   []int `json:"all"`
		Owner []int `json:"owner"`
	}
	if participationRes.Success {
		json.Unmarshal([]byte(participationRes.Stdout), &participation)
	}

	features := []interface{}{}
	bugs := []interface{}{}
	roadmap := []interface{}{}
	general := []interface{}{}

	for _, issue := range rawIssues {
		labelsRaw, ok := issue["labels"].([]interface{})
		isFeature := false
		isBug := false
		isRoadmap := false

		if ok {
			for _, l := range labelsRaw {
				labelMap, ok := l.(map[string]interface{})
				if ok {
					lbl := strings.ToLower(labelMap["name"].(string))
					if strings.Contains(lbl, "feature") || strings.Contains(lbl, "enhancement") {
						isFeature = true
					}
					if strings.Contains(lbl, "bug") || strings.Contains(lbl, "error") || strings.Contains(lbl, "defect") {
						isBug = true
					}
					if strings.Contains(lbl, "roadmap") {
						isRoadmap = true
					}
				}
			}
		}

		if isFeature {
			features = append(features, issue)
		} else if isBug {
			bugs = append(bugs, issue)
		} else if isRoadmap {
			roadmap = append(roadmap, issue)
		} else {
			general = append(general, issue)
		}
	}

	helpers.WriteJSONResponse(w, map[string]interface{}{
		"features":      features,
		"bugs":          bugs,
		"general":       general,
		"prs":           rawPrs,
		"lastTag":       lastTag,
		"roadmapIssues": roadmap,
		"repo":          repoInfo,
		"releases":      decodeList(releasesRes),
		"runs":          decodeList(runsRes),
		"unreleased":    unreleased,
		"participation": participation,
	})
}
