package config

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"

	"stitch/internal/models"
)

var (
	mutex sync.RWMutex
	file  = "config.json"
)

// Read loads the workspace config from disk.
func Read() models.Config {
	mutex.RLock()
	defer mutex.RUnlock()

	var cfg models.Config
	if _, err := os.Stat(file); os.IsNotExist(err) {
		cfg.Repos = []models.Repo{}
		return cfg
	}

	data, err := os.ReadFile(file)
	if err != nil {
		fmt.Printf("Error reading config: %v\n", err)
		return models.Config{Repos: []models.Repo{}}
	}

	if err := json.Unmarshal(data, &cfg); err != nil {
		fmt.Printf("Error parsing config: %v\n", err)
		return models.Config{Repos: []models.Repo{}}
	}

	if cfg.Repos == nil {
		cfg.Repos = []models.Repo{}
	}
	return cfg
}

// Write persists the workspace config to disk.
func Write(cfg models.Config) bool {
	mutex.Lock()
	defer mutex.Unlock()

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		fmt.Printf("Error marshaling config: %v\n", err)
		return false
	}

	if err := os.WriteFile(file, data, 0644); err != nil {
		fmt.Printf("Error writing config: %v\n", err)
		return false
	}
	return true
}
