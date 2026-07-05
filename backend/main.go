package main

import (
	"embed"
	"os"

	"stitch/internal/desktop"
	"stitch/internal/server"
)

//go:embed all:dist
var assets embed.FS

func main() {
	runAsServer := false
	for _, arg := range os.Args {
		if arg == "--server" {
			runAsServer = true
			break
		}
	}

	if runAsServer {
		server.Run()
		return
	}

	desktop.Run(assets)
}
