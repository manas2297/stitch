package desktop

import (
	"io/fs"
	"net/http"

	"stitch/internal/server"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

// Run starts the Wails desktop application with embedded frontend assets.
func Run(assets fs.FS) {
	go func() {
		srv := &http.Server{
			Addr:    ":4000",
			Handler: server.Routes(),
		}
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			println("Server error:", err.Error())
		}
	}()

	app := NewApp()

	err := wails.Run(&options.App{
		Title:         "Stitch",
		Width:         1280,
		Height:        800,
		DisableResize: false,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 9, G: 10, B: 16, A: 255},
		OnStartup:        app.Startup,
		Bind: []interface{}{
			app,
		},
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
