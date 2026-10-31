package desktop

import (
	"io/fs"

	"stitch/internal/server"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

// Run starts the Wails desktop application with embedded frontend assets.
func Run(assets fs.FS) {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:         "Stitch",
		Width:         1280,
		Height:        800,
		DisableResize: false,
		// The webview serves the UI from assets and sends /api/* to the Go handlers
		// in-process, so no network port is opened.
		AssetServer: &assetserver.Options{
			Assets:  assets,
			Handler: server.Routes(),
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
