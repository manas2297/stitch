package monitor

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"stitch/internal/server/helpers"
)

// HandleGetProviderDisk scans ~/.<provider> directory and returns disk usage breakdown.
func HandleGetProviderDisk(w http.ResponseWriter, r *http.Request) {
	provider := r.PathValue("provider")
	if provider == "" {
		helpers.WriteJSONError(w, "Provider is required", http.StatusBadRequest)
		return
	}
	homedir, err := os.UserHomeDir()
	if err != nil {
		helpers.WriteJSONError(w, "Cannot resolve home dir", http.StatusInternalServerError)
		return
	}
	providerDir := filepath.Join(homedir, "."+provider)

	type SubDir struct {
		Name string `json:"name"`
		Size int64  `json:"size"`
	}
	type FileType struct {
		Extension string `json:"extension"`
		Count     int    `json:"count"`
		Size      int64  `json:"size"`
	}
	type Conversation struct {
		Name     string `json:"name"`
		Size     int64  `json:"size"`
		Modified string `json:"modified"`
	}

	// Total size
	totalSize := int64(0)
	filepath.Walk(providerDir, func(path string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			totalSize += info.Size()
		}
		return nil
	})

	// Subdirectories
	subdirs := []SubDir{}
	if entries, err := os.ReadDir(providerDir); err == nil {
		for _, e := range entries {
			if e.IsDir() {
				subPath := filepath.Join(providerDir, e.Name())
				dirSize := int64(0)
				filepath.Walk(subPath, func(p string, fi os.FileInfo, err error) error {
					if err == nil && !fi.IsDir() {
						dirSize += fi.Size()
					}
					return nil
				})
				subdirs = append(subdirs, SubDir{Name: e.Name(), Size: dirSize})
			}
		}
	}

	// File type breakdown
	mediaExts := []string{"webp", "png", "jpg", "jpeg", "webm", "mp4", "jsonl", "md", "json", "log"}
	fileTypes := []FileType{}
	for _, ext := range mediaExts {
		count := 0
		size := int64(0)
		filepath.Walk(providerDir, func(path string, info os.FileInfo, err error) error {
			if err == nil && !info.IsDir() && strings.ToLower(filepath.Ext(path)) == "."+ext {
				count++
				size += info.Size()
			}
			return nil
		})
		fileTypes = append(fileTypes, FileType{Extension: ext, Count: count, Size: size})
	}

	// Top conversations from brain dir
	conversations := []Conversation{}
	brainDir := filepath.Join(providerDir, "antigravity-ide", "brain")
	if entries, err := os.ReadDir(brainDir); err == nil {
		for _, e := range entries {
			if e.IsDir() {
				convPath := filepath.Join(brainDir, e.Name())
				convSize := int64(0)
				var lastMod time.Time
				filepath.Walk(convPath, func(p string, fi os.FileInfo, err error) error {
					if err == nil && !fi.IsDir() {
						convSize += fi.Size()
						if fi.ModTime().After(lastMod) {
							lastMod = fi.ModTime()
						}
					}
					return nil
				})
				modStr := ""
				if !lastMod.IsZero() {
					modStr = lastMod.Format("2006-01-02 15:04:05")
				}
				conversations = append(conversations, Conversation{Name: e.Name(), Size: convSize, Modified: modStr})
			}
		}
	}

	// Sort conversations by size desc, keep top 10
	for i := 0; i < len(conversations); i++ {
		for j := i + 1; j < len(conversations); j++ {
			if conversations[j].Size > conversations[i].Size {
				conversations[i], conversations[j] = conversations[j], conversations[i]
			}
		}
	}
	if len(conversations) > 10 {
		conversations = conversations[:10]
	}

	helpers.WriteJSONResponse(w, map[string]interface{}{
		"lastUpdated":      time.Now().Format("2006-01-02 15:04:05"),
		"totalSize":        totalSize,
		"subdirectories":   subdirs,
		"fileTypes":        fileTypes,
		"topConversations": conversations,
	})
}

// HandleDeleteProviderMedia deletes all browser recording/screenshot media files from ~/.<provider>.
func HandleDeleteProviderMedia(w http.ResponseWriter, r *http.Request) {
	provider := r.PathValue("provider")
	if provider == "" {
		helpers.WriteJSONError(w, "Provider is required", http.StatusBadRequest)
		return
	}
	homedir, err := os.UserHomeDir()
	if err != nil {
		helpers.WriteJSONError(w, "Cannot resolve home dir", http.StatusInternalServerError)
		return
	}
	providerDir := filepath.Join(homedir, "."+provider)
	mediaExts := map[string]bool{
		".webp": true, ".png": true, ".jpg": true,
		".jpeg": true, ".webm": true, ".mp4": true,
	}

	deleted := 0
	freedBytes := int64(0)
	filepath.Walk(providerDir, func(path string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			if mediaExts[strings.ToLower(filepath.Ext(path))] {
				freedBytes += info.Size()
				if removeErr := os.Remove(path); removeErr == nil {
					deleted++
				}
			}
		}
		return nil
	})

	helpers.WriteJSONResponse(w, map[string]interface{}{
		"success":    true,
		"deleted":    deleted,
		"freedBytes": freedBytes,
	})
}
