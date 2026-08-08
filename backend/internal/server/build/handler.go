package build

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
)

func HandleBuildRun(w http.ResponseWriter, r *http.Request) {
	repoPath := r.URL.Query().Get("path")
	script := r.URL.Query().Get("script")
	if repoPath == "" {
		http.Error(w, `{"error":"Repository path is required."}`, http.StatusBadRequest)
		return
	}

	absPath, _ := filepath.Abs(repoPath)
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		http.Error(w, `{"error":"Repository path does not exist."}`, http.StatusNotFound)
		return
	}

	command := "npm run build"
	if script != "" {
		command = fmt.Sprintf("npm run %s", script)
	}

	// Prepare SSE response headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Transfer-Encoding", "chunked")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	sendLog := func(log string) {
		payload, _ := json.Marshal(map[string]string{"log": log})
		fmt.Fprintf(w, "data: %s\n\n", payload)
		flusher.Flush()
	}

	sendLog(fmt.Sprintf("Starting build task: %s in %s\n", command, absPath))

	cmd := exec.Command("sh", "-c", command)
	cmd.Dir = absPath

	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		sendLog(fmt.Sprintf("[ERROR] Failed to obtain stdout: %v\n", err))
		return
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		sendLog(fmt.Sprintf("[ERROR] Failed to obtain stderr: %v\n", err))
		return
	}

	if err := cmd.Start(); err != nil {
		sendLog(fmt.Sprintf("[ERROR] Failed to start command: %v\n", err))
		return
	}

	go func() {
		buf := make([]byte, 1024)
		for {
			n, err := stdoutPipe.Read(buf)
			if n > 0 {
				sendLog(string(buf[:n]))
			}
			if err != nil {
				break
			}
		}
	}()

	go func() {
		buf := make([]byte, 1024)
		for {
			n, err := stderrPipe.Read(buf)
			if n > 0 {
				sendLog(string(buf[:n]))
			}
			if err != nil {
				break
			}
		}
	}()

	err = cmd.Wait()
	if err != nil {
		sendLog(fmt.Sprintf("[ERROR] Command finished with error: %v\n", err))
	} else {
		sendLog("[SUCCESS] Build task completed successfully.\n")
	}
}
