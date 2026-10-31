package config

import (
	"fmt"
	"os"
	"path/filepath"
)

// DataDir returns Stitch's per-user data folder (~/.stitch), creating it if needed.
// An installed app's working directory is not writable (/ on macOS, System32 on
// Windows), so nothing may be stored relative to it.
func DataDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		home = os.TempDir()
	}
	dir := filepath.Join(home, ".stitch")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		fmt.Printf("Error creating data dir: %v\n", err)
	}
	return dir
}

// DataFile returns the path of name inside DataDir. On first use it copies over a
// file of the same name that older builds kept in the working directory (or the repo
// root, which is the parent of backend/ under `wails dev`).
func DataFile(name string) string {
	path := filepath.Join(DataDir(), name)
	if _, err := os.Stat(path); err == nil {
		return path
	}
	for _, legacy := range []string{name, filepath.Join("..", name)} {
		data, err := os.ReadFile(legacy)
		if err != nil {
			continue
		}
		if err := os.WriteFile(path, data, 0o600); err != nil {
			fmt.Printf("Error migrating %s: %v\n", legacy, err)
		}
		break
	}
	return path
}
