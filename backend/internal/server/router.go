package server

import (
	"net/http"

	"stitch/internal/server/contributions"
	"stitch/internal/server/diagrams"
	"stitch/internal/server/focus"
	"stitch/internal/server/ideas"
	"stitch/internal/server/monitor"
	"stitch/internal/server/planner"
	"stitch/internal/server/plans"
	"stitch/internal/server/profile"
	"stitch/internal/server/projects"
	"stitch/internal/server/releases"
	"stitch/internal/server/repos"
	"stitch/internal/server/roadmap"
)

// Routes returns the /api handlers. The desktop webview calls them in-process via
// the Wails asset server; static assets are served by Wails from the embedded dist/.
func Routes() http.Handler {
	mux := http.NewServeMux()

	// 1. Repos (GET, POST, DELETE)
	mux.HandleFunc("GET /api/repos", repos.HandleGetRepos)
	mux.HandleFunc("POST /api/repos", repos.HandlePostRepos)
	mux.HandleFunc("DELETE /api/repos", repos.HandleDeleteRepos)
	mux.HandleFunc("POST /api/repos/toggle-major", repos.HandleToggleMajor)
	mux.HandleFunc("POST /api/repos/set-focus", repos.HandleSetFocus)
	mux.HandleFunc("POST /api/repos/open", repos.HandleOpenRepo)
	mux.HandleFunc("POST /api/repos/bulk", repos.HandleBulkRepos)
	mux.HandleFunc("GET /api/repos/discover", repos.HandleDiscover)
	mux.HandleFunc("GET /api/repos/discover/roots", repos.HandleDiscoverRoots)
	mux.HandleFunc("GET /api/repos/github", repos.HandleGitHubRepos)

	// 2. Details, Roadmap, Releases
	mux.HandleFunc("GET /api/projects/details", projects.HandleProjectDetails)
	mux.HandleFunc("GET /api/roadmap", roadmap.HandleGetRoadmap)
	mux.HandleFunc("POST /api/roadmap/add", roadmap.HandlePostRoadmapAdd)
	mux.HandleFunc("GET /api/releases", releases.HandleGetReleases)
	mux.HandleFunc("POST /api/release/create", releases.HandlePostReleaseCreate)

	// 3. Focus Area
	mux.HandleFunc("GET /api/focus/info", focus.HandleFocusInfo)
	mux.HandleFunc("GET /api/focus/contents", focus.HandleFocusContents)
	mux.HandleFunc("GET /api/focus/fs/list", focus.HandleFSList)
	mux.HandleFunc("GET /api/focus/fs/read", focus.HandleFSRead)
	mux.HandleFunc("PUT /api/focus/fs/write", focus.HandleFSWrite)
	mux.HandleFunc("GET /api/focus/fs/status", focus.HandleFSStatus)

	// 3b. Focus planner: tasks, checklists, calendar, meetings, notes
	mux.HandleFunc("GET /api/focus/board", planner.HandleGetBoard)
	mux.HandleFunc("POST /api/focus/tasks", planner.HandleCreateTasks)
	mux.HandleFunc("PATCH /api/focus/tasks/{id}", planner.HandleUpdateTask)
	mux.HandleFunc("DELETE /api/focus/tasks/{id}", planner.HandleDeleteTask)
	mux.HandleFunc("POST /api/focus/tasks/{id}/issue", planner.HandleCreateIssue)
	mux.HandleFunc("POST /api/focus/meetings", planner.HandleCreateMeeting)
	mux.HandleFunc("PATCH /api/focus/meetings/{id}", planner.HandleUpdateMeeting)
	mux.HandleFunc("DELETE /api/focus/meetings/{id}", planner.HandleDeleteMeeting)
	mux.HandleFunc("GET /api/focus/meetings/{id}/ics", planner.HandleMeetingICS)
	mux.HandleFunc("POST /api/focus/pages", planner.HandleCreatePage)
	mux.HandleFunc("PATCH /api/focus/pages/{id}", planner.HandleUpdatePage)
	mux.HandleFunc("DELETE /api/focus/pages/{id}", planner.HandleDeletePage)
	mux.HandleFunc("GET /api/ideas", ideas.HandleGetIdeasFiles)
	mux.HandleFunc("GET /api/ideas/file", ideas.HandleGetIdeasFile)
	mux.HandleFunc("POST /api/ideas/file", ideas.HandlePostIdeasFile)
	mux.HandleFunc("DELETE /api/ideas/file", ideas.HandleDeleteIdeasFile)
	mux.HandleFunc("GET /api/plans", plans.HandleGetPlans)
	mux.HandleFunc("POST /api/plans", plans.HandlePostPlan)
	mux.HandleFunc("PUT /api/plans", plans.HandlePutPlan)
	mux.HandleFunc("DELETE /api/plans", plans.HandleDeletePlan)
	mux.HandleFunc("POST /api/plans/promote", plans.HandlePromotePlan)

	// 4. PRs, Issues, Recents
	mux.HandleFunc("GET /api/recents", contributions.HandleGetRecents)
	mux.HandleFunc("GET /api/prs", contributions.HandleGetPrs)
	mux.HandleFunc("GET /api/issues", contributions.HandleGetIssues)

	// 6. Contributions (GitHub and Local Commits)
	mux.HandleFunc("GET /api/contributions", contributions.HandleGetGitHubContributions)
	mux.HandleFunc("GET /api/contributions/local", contributions.HandleGetLocalContributions)
	mux.HandleFunc("GET /api/overview/delivery", contributions.HandleGetDelivery)
	mux.HandleFunc("GET /api/overview/goals", contributions.HandleGetGoals)
	mux.HandleFunc("POST /api/overview/goals", contributions.HandlePostGoals)

	// 7. Profile & Settings
	mux.HandleFunc("GET /api/profile", profile.HandleGetProfile)
	mux.HandleFunc("POST /api/profile/git", profile.HandlePostProfileGit)
	mux.HandleFunc("POST /api/config/tab-energies", repos.HandlePostTabEnergies)

	// 8. AI Monitor (provider usage analysis & cleanup)
	mux.HandleFunc("GET /api/providers", monitor.HandleGetProviders)
	mux.HandleFunc("GET /api/provider/{provider}/analysis", monitor.HandleGetProviderAnalysis)
	mux.HandleFunc("POST /api/provider/{provider}/cleanup", monitor.HandlePostProviderCleanup)

	// 9. Architecture diagrams (StitchDraw drawings)
	mux.HandleFunc("GET /api/diagrams", diagrams.HandleList)
	mux.HandleFunc("POST /api/diagrams", diagrams.HandleCreate)
	mux.HandleFunc("GET /api/diagrams/file", diagrams.HandleGet)
	mux.HandleFunc("PUT /api/diagrams/file", diagrams.HandleSave)
	mux.HandleFunc("DELETE /api/diagrams/file", diagrams.HandleDelete)
	mux.HandleFunc("POST /api/diagrams/rename", diagrams.HandleRename)
	mux.HandleFunc("GET /api/diagrams/library", diagrams.HandleGetLibrary)
	mux.HandleFunc("PUT /api/diagrams/library", diagrams.HandleSaveLibrary)

	return mux
}
