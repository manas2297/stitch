package server

import (
	"net/http"
	"os"
	"path/filepath"
)

func Routes() http.Handler {
	mux := http.NewServeMux()

	// 1. Repos (GET, POST, DELETE)
	mux.HandleFunc("GET /api/repos", HandleGetRepos)
	mux.HandleFunc("POST /api/repos", HandlePostRepos)
	mux.HandleFunc("DELETE /api/repos", HandleDeleteRepos)
	mux.HandleFunc("POST /api/repos/toggle-major", HandleToggleMajor)
	mux.HandleFunc("POST /api/repos/set-focus", HandleSetFocus)

	// 2. Details, Roadmap, Releases
	mux.HandleFunc("GET /api/projects/details", HandleProjectDetails)
	mux.HandleFunc("GET /api/roadmap", HandleGetRoadmap)
	mux.HandleFunc("POST /api/roadmap/add", HandlePostRoadmapAdd)
	mux.HandleFunc("GET /api/releases", HandleGetReleases)
	mux.HandleFunc("POST /api/release/create", HandlePostReleaseCreate)

	// 3. Focus Area
	mux.HandleFunc("GET /api/focus/info", HandleFocusInfo)
	mux.HandleFunc("GET /api/focus/contents", HandleFocusContents)
	mux.HandleFunc("GET /api/ideas", HandleGetIdeasFiles)
	mux.HandleFunc("GET /api/ideas/file", HandleGetIdeasFile)
	mux.HandleFunc("POST /api/ideas/file", HandlePostIdeasFile)
	mux.HandleFunc("DELETE /api/ideas/file", HandleDeleteIdeasFile)
	mux.HandleFunc("GET /api/plans", HandleGetPlans)
	mux.HandleFunc("POST /api/plans", HandlePostPlan)
	mux.HandleFunc("PUT /api/plans", HandlePutPlan)
	mux.HandleFunc("DELETE /api/plans", HandleDeletePlan)
	mux.HandleFunc("POST /api/plans/promote", HandlePromotePlan)

	// 4. PRs, Issues, Recents
	mux.HandleFunc("GET /api/recents", HandleGetRecents)
	mux.HandleFunc("GET /api/prs", HandleGetPrs)
	mux.HandleFunc("GET /api/issues", HandleGetIssues)

	// 5. Builds & Tasks (SSE)
	mux.HandleFunc("GET /api/build/run", HandleBuildRun)

	// 6. Contributions (GitHub and Local Commits)
	mux.HandleFunc("GET /api/contributions", HandleGetGitHubContributions)
	mux.HandleFunc("GET /api/contributions/local", HandleGetLocalContributions)

	// 7. Profile & Settings
	mux.HandleFunc("GET /api/profile", HandleGetProfile)
	mux.HandleFunc("POST /api/profile/git", HandlePostProfileGit)
	mux.HandleFunc("POST /api/config/tab-energies", HandlePostTabEnergies)

	// 8. Provider Disk Monitor
	mux.HandleFunc("GET /api/provider/{provider}/disk", HandleGetProviderDisk)
	mux.HandleFunc("DELETE /api/provider/{provider}/media", HandleDeleteProviderMedia)

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

