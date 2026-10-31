package main

import (
	"embed"

	"stitch/internal/desktop"
)

//go:embed all:dist
var assets embed.FS

func main() {
	desktop.Run(assets)
}
