package main

import (
	"embed"
	"net/http"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

//go:embed all:dist
var assets embed.FS

func runDesktopApp() {
	// Start the Go HTTP server in the background on port 4000
	go func() {
		server := &http.Server{
			Addr:    ":4000",
			Handler: setupRoutes(),
		}
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			println("Server error:", err.Error())
		}
	}()

	// Create an instance of the app structure
	app := NewApp()

	// Create application with options
	err := wails.Run(&options.App{
		Title:         "Stitch",
		Width:         1280,
		Height:        800,
		DisableResize: false, // Ensure window is resizable
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 9, G: 10, B: 16, A: 255},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
		// macOS specific options to unlock the full-screen title button
		Mac: &mac.Options{
			TitleBar: &mac.TitleBar{
				TitlebarAppearsTransparent: false,
				HideTitle:                  false,
				HideTitleBar:               false,
				FullSizeContent:            false,
				UseToolbar:                 false,
				HideToolbarSeparator:       true,
			},
			About: &mac.AboutInfo{
				Title:   "Stitch",
				Message: "Stitch Desktop Developer Console",
			},
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
