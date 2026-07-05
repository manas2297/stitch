package models

// Repo is a tracked repository (local clone or web-only remote).
type Repo struct {
	Name           string   `json:"name"`
	Owner          string   `json:"owner"`
	Path           string   `json:"path"`
	IsMajorProject bool     `json:"isMajorProject"`
	Exists         bool     `json:"exists,omitempty"`
	Branch         string   `json:"branch,omitempty"`
	Type           string   `json:"type,omitempty"`
	BuildScripts   []string `json:"buildScripts,omitempty"`
}

// Config is the persisted local Stitch workspace state.
type Config struct {
	Repos        []Repo `json:"repos"`
	FocusProject string `json:"focusProject"`
}
