package main

import (
	"context"
	"embed"
	"fmt"
	"os"

	"stitch/internal/desktop"
	"stitch/internal/mcp"
)

//go:embed all:dist
var assets embed.FS

func main() {
	// `stitch mcp` serves the MCP tools over stdio for Claude Desktop / Claude Code.
	if len(os.Args) > 1 && os.Args[1] == "mcp" {
		if err := mcp.Run(context.Background()); err != nil {
			fmt.Fprintln(os.Stderr, "mcp:", err)
			os.Exit(1)
		}
		return
	}
	desktop.Run(assets)
}
