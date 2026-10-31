package config

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"

	"stitch/internal/models"
)

var (
	mutex    sync.RWMutex
	file     string
	fileOnce sync.Once
)

func configFile() string {
	fileOnce.Do(func() {
		if file == "" {
			file = DataFile("config.json")
		}
	})
	return file
}

// Read loads the workspace config from disk.
func Read() models.Config {
	mutex.RLock()
	defer mutex.RUnlock()

	var cfg models.Config
	if _, err := os.Stat(configFile()); os.IsNotExist(err) {
		cfg.Repos = []models.Repo{}
		return cfg
	}

	data, err := os.ReadFile(configFile())
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

	if err := os.WriteFile(configFile(), data, 0600); err != nil {
		fmt.Printf("Error writing config: %v\n", err)
		return false
	}
	return true
}
