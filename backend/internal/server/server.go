package server

import (
	"fmt"
	"net/http"
	"os"
)

// Run starts the HTTP API server (used by dev mode and production web builds).
func Run() {
	port := "4000"
	if envPort := os.Getenv("PORT"); envPort != "" {
		port = envPort
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: Routes(),
	}

	fmt.Printf("Stitch GitHub Manager Server running in Go on http://localhost:%s\n", port)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		fmt.Printf("Server failed: %v\n", err)
	}
}
