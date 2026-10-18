package monitor

import (
	"encoding/json"
	"net/http"
	"os"
	"time"

	"stitch/internal/server/helpers"
)

func profileFromPath(w http.ResponseWriter, r *http.Request) (providerProfile, bool) {
	p, ok := profiles[r.PathValue("provider")]
	if !ok {
		helpers.WriteJSONError(w, "Unknown provider", http.StatusBadRequest)
	}
	return p, ok
}

// HandleGetProviders lists supported providers and whether their ~/.<provider> directory exists.
func HandleGetProviders(w http.ResponseWriter, r *http.Request) {
	type item struct {
		ID     string `json:"id"`
		Label  string `json:"label"`
		Exists bool   `json:"exists"`
	}
	out := []item{}
	for _, id := range providerOrder {
		root, err := providerRoot(id)
		if err != nil {
			helpers.WriteJSONError(w, "Cannot resolve home dir", http.StatusInternalServerError)
			return
		}
		fi, err := os.Stat(root)
		out = append(out, item{ID: id, Label: profiles[id].Label, Exists: err == nil && fi.IsDir()})
	}
	helpers.WriteJSONResponse(w, out)
}

// HandleGetProviderAnalysis scans ~/.<provider> (metadata only) and returns storage, activity,
// session analysis, insights and cleanup estimates.
func HandleGetProviderAnalysis(w http.ResponseWriter, r *http.Request) {
	p, ok := profileFromPath(w, r)
	if !ok {
		return
	}
	res, err := scan(p)
	if err != nil {
		helpers.WriteJSONError(w, "Cannot resolve home dir", http.StatusInternalServerError)
		return
	}
	helpers.WriteJSONResponse(w, buildReport(res, time.Now()))
}

// HandlePostProviderCleanup previews (dryRun) or runs a cleanup action against a fresh scan.
// Session ids are only honoured if they exist in that scan, so clients cannot pass arbitrary paths.
func HandlePostProviderCleanup(w http.ResponseWriter, r *http.Request) {
	p, ok := profileFromPath(w, r)
	if !ok {
		return
	}
	var req cleanupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		helpers.WriteJSONError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	res, err := scan(p)
	if err != nil {
		helpers.WriteJSONError(w, "Cannot resolve home dir", http.StatusInternalServerError)
		return
	}
	if !res.Exists {
		helpers.WriteJSONError(w, "Provider directory does not exist", http.StatusNotFound)
		return
	}
	plan, err := buildPlan(res, req, time.Now())
	if err != nil {
		helpers.WriteJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.DryRun {
		helpers.WriteJSONResponse(w, cleanupResult{cleanupPlan: *plan, DryRun: true})
		return
	}
	helpers.WriteJSONResponse(w, execute(res, plan))
}
