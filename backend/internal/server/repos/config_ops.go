package repos

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"stitch/internal/models"
	"stitch/internal/shell"
)

// addRepoToConfig tracks a local path or a GitHub "owner/name", replacing an existing entry for the same repo.
func addRepoToConfig(cfg *models.Config, target, owner, name string, isMajor bool) (models.Repo, error) {
	if target == "" {
		return models.Repo{}, fmt.Errorf("repository path or owner/repo string is required")
	}
	var repoData models.Repo

	isWebFormat := strings.Contains(target, "/") &&
		!strings.HasPrefix(target, "/") &&
		!strings.Contains(target, "\\") &&
		!strings.Contains(target, ":")

	if isWebFormat {
		parts := strings.Split(target, "/")
		if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
			return repoData, fmt.Errorf("invalid web repository format, use owner/name")
		}
		wOwner, wName := parts[0], parts[1]

		existingIndex := -1
		for idx, r := range cfg.Repos {
			if r.Path == "" && strings.EqualFold(r.Owner, wOwner) && strings.EqualFold(r.Name, wName) {
				existingIndex = idx
				break
			}
		}

		repoData = models.Repo{
			Name:           wName,
			Owner:          wOwner,
			Path:           "",
			IsMajorProject: isMajor,
		}

		if existingIndex > -1 {
			cfg.Repos[existingIndex] = repoData
		} else {
			cfg.Repos = append(cfg.Repos, repoData)
		}
	} else {
		absPath, _ := filepath.Abs(target)
		if _, err := os.Stat(absPath); os.IsNotExist(err) {
			return repoData, fmt.Errorf("path does not exist: %s", absPath)
		}

		existingIndex := -1
		for idx, r := range cfg.Repos {
			if r.Path != "" {
				rAbs, _ := filepath.Abs(r.Path)
				if strings.EqualFold(rAbs, absPath) {
					existingIndex = idx
					break
				}
			}
		}

		dOwner, dName := owner, name
		if dOwner == "" || dName == "" {
			dOwner, dName = shell.GetRepoInfoFromGit(absPath)
		}

		repoData = models.Repo{
			Name:           dName,
			Owner:          dOwner,
			Path:           absPath,
			IsMajorProject: isMajor,
		}

		if existingIndex > -1 {
			cfg.Repos[existingIndex] = repoData
		} else {
			cfg.Repos = append(cfg.Repos, repoData)
		}
	}
	return repoData, nil
}

// removeRepoFromConfig untracks a local path or a GitHub owner/name, clearing focus if it pointed there.
func removeRepoFromConfig(cfg *models.Config, path, owner, name string) bool {
	filtered := []models.Repo{}
	found := false

	if path != "" {
		absBodyPath, _ := filepath.Abs(path)
		for _, r := range cfg.Repos {
			if r.Path != "" {
				rAbs, _ := filepath.Abs(r.Path)
				if strings.EqualFold(rAbs, absBodyPath) {
					found = true
					continue
				}
			}
			filtered = append(filtered, r)
		}
		fAbs, _ := filepath.Abs(cfg.FocusProject)
		if cfg.FocusProject != "" && strings.EqualFold(fAbs, absBodyPath) {
			cfg.FocusProject = ""
		}
	} else if owner != "" && name != "" {
		for _, r := range cfg.Repos {
			if r.Path == "" && strings.EqualFold(r.Owner, owner) && strings.EqualFold(r.Name, name) {
				found = true
				continue
			}
			filtered = append(filtered, r)
		}
		if cfg.FocusProject == fmt.Sprintf("%s/%s", owner, name) {
			cfg.FocusProject = ""
		}
	}
	if found {
		cfg.Repos = filtered
	}
	return found
}
