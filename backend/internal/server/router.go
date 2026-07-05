package server

import (
	"net/http"
	"os"
	"path/filepath"
)

func Routes() http.Handler {
	mux := http.NewServeMux()

	// CORS and JSON header utility wrapper
	wrap := func(h http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			h(w, r)
		}
	}

	// 1. Repos (GET, POST, DELETE)
	mux.HandleFunc("GET /api/repos", wrap(HandleGetRepos))
	mux.HandleFunc("POST /api/repos", wrap(HandlePostRepos))
	mux.HandleFunc("DELETE /api/repos", wrap(HandleDeleteRepos))
	mux.HandleFunc("POST /api/repos/toggle-major", wrap(HandleToggleMajor))
	mux.HandleFunc("POST /api/repos/set-focus", wrap(HandleSetFocus))

	// 2. Details, Roadmap, Releases
	mux.HandleFunc("GET /api/projects/details", wrap(HandleProjectDetails))
	mux.HandleFunc("GET /api/roadmap", wrap(HandleGetRoadmap))
	mux.HandleFunc("POST /api/roadmap/add", wrap(HandlePostRoadmapAdd))
	mux.HandleFunc("GET /api/releases", wrap(HandleGetReleases))
	mux.HandleFunc("POST /api/release/create", wrap(HandlePostReleaseCreate))

	// 3. Focus Area
	mux.HandleFunc("GET /api/focus/info", wrap(HandleFocusInfo))
	mux.HandleFunc("GET /api/focus/contents", wrap(HandleFocusContents))

	// 4. PRs, Issues, Recents
	mux.HandleFunc("GET /api/recents", wrap(HandleGetRecents))
	mux.HandleFunc("GET /api/prs", wrap(HandleGetPrs))
	mux.HandleFunc("GET /api/issues", wrap(HandleGetIssues))

	// 5. Builds & Tasks (SSE)
	mux.HandleFunc("GET /api/build/run", wrap(HandleBuildRun))

	// 6. Contributions (GitHub and Local Commits)
	mux.HandleFunc("GET /api/contributions", wrap(HandleGetGitHubContributions))
	mux.HandleFunc("GET /api/contributions/local", wrap(HandleGetLocalContributions))

	// 7. Profile & Settings
	mux.HandleFunc("GET /api/profile", wrap(HandleGetProfile))
	mux.HandleFunc("POST /api/profile/git", wrap(HandlePostProfileGit))

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

	return mux
}

