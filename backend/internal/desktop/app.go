package desktop

import (
	"context"
	"os"

	"stitch/internal/build"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App manages desktop operations and Wails lifecycle hooks.
type App struct {
	ctx context.Context
}

// NewApp creates a new App instance for Wails binding.
func NewApp() *App {
	return &App{}
}

// Startup is called when the desktop app starts.
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
}

// OpenURL opens a URL in the system default browser.
func (a *App) OpenURL(url string) {
	runtime.BrowserOpenURL(a.ctx, url)
}

// PickFolder opens a native folder chooser and returns the chosen path, or "" if cancelled.
func (a *App) PickFolder(title string) string {
	home, _ := os.UserHomeDir()
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:            title,
		DefaultDirectory: home,
	})
	if err != nil {
		return ""
	}
	return dir
}

// SaveFile asks where to save content via a native dialog. It returns false if the user cancelled.
func (a *App) SaveFile(defaultName, content string) (bool, error) {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{DefaultFilename: defaultName})
	if err != nil || path == "" {
		return false, err
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		return false, err
	}
	return true, nil
}

// RunBuild starts a build in a tracked repo. Output arrives as "build:<runID>" events,
// {log} per chunk then {done, exitCode}; the caller subscribes before calling so no
// output is missed. (The webview can't stream HTTP responses on Windows, hence events.)
func (a *App) RunBuild(runID, path, script string) error {
	dir, command, err := build.Prepare(path, script)
	if err != nil {
		return err
	}
	event := "build:" + runID
	go func() {
		code := build.Run(dir, command, func(log string) {
			runtime.EventsEmit(a.ctx, event, map[string]any{"log": log})
		})
		runtime.EventsEmit(a.ctx, event, map[string]any{"done": true, "exitCode": code})
	}()
	return nil
}
