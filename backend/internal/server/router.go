package server

import (
	"net/http"
	"os"
	"path/filepath"

	"stitch/internal/server/build"
	"stitch/internal/server/contributions"
	"stitch/internal/server/focus"
	"stitch/internal/server/ideas"
	"stitch/internal/server/monitor"
	"stitch/internal/server/plans"
	"stitch/internal/server/profile"
	"stitch/internal/server/projects"
	"stitch/internal/server/releases"
	"stitch/internal/server/repos"
	"stitch/internal/server/roadmap"
)

func Routes() http.Handler {
	mux := http.NewServeMux()

	// 1. Repos (GET, POST, DELETE)
	mux.HandleFunc("GET /api/repos", repos.HandleGetRepos)
	mux.HandleFunc("POST /api/repos", repos.HandlePostRepos)
	mux.HandleFunc("DELETE /api/repos", repos.HandleDeleteRepos)
	mux.HandleFunc("POST /api/repos/toggle-major", repos.HandleToggleMajor)
	mux.HandleFunc("POST /api/repos/set-focus", repos.HandleSetFocus)

	// 2. Details, Roadmap, Releases
	mux.HandleFunc("GET /api/projects/details", projects.HandleProjectDetails)
	mux.HandleFunc("GET /api/roadmap", roadmap.HandleGetRoadmap)
	mux.HandleFunc("POST /api/roadmap/add", roadmap.HandlePostRoadmapAdd)
	mux.HandleFunc("GET /api/releases", releases.HandleGetReleases)
	mux.HandleFunc("POST /api/release/create", releases.HandlePostReleaseCreate)

	// 3. Focus Area
	mux.HandleFunc("GET /api/focus/info", focus.HandleFocusInfo)
	mux.HandleFunc("GET /api/focus/contents", focus.HandleFocusContents)
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

	// 5. Builds & Tasks (SSE)
	mux.HandleFunc("GET /api/build/run", build.HandleBuildRun)

	// 6. Contributions (GitHub and Local Commits)
	mux.HandleFunc("GET /api/contributions", contributions.HandleGetGitHubContributions)
	mux.HandleFunc("GET /api/contributions/local", contributions.HandleGetLocalContributions)

	// 7. Profile & Settings
	mux.HandleFunc("GET /api/profile", profile.HandleGetProfile)
	mux.HandleFunc("POST /api/profile/git", profile.HandlePostProfileGit)
	mux.HandleFunc("POST /api/config/tab-energies", repos.HandlePostTabEnergies)

	// 8. Provider Disk Monitor
	mux.HandleFunc("GET /api/provider/{provider}/disk", monitor.HandleGetProviderDisk)
	mux.HandleFunc("DELETE /api/provider/{provider}/media", monitor.HandleDeleteProviderMedia)

	// Static client file hosting (Vite build target)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Serve index.html if file doesn't exist
		path := filepath.Join("dist", r.URL.Path)
		if fi, err := os.Stat(path); err != nil || fi.IsDir() {
			http.ServeFile(w, r, filepath.Join("dist", "index.html"))
			return
		}
		http.FileServer(http.Dir("dist")).ServeHTTP(w, r)
	})

	// Global CORS and OPTIONS handler middleware
	globalCORS := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS, PUT")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		
		mux.ServeHTTP(w, r)
	})

	return globalCORS
}

