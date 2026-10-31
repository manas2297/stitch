// Package build runs npm build/lint scripts inside tracked repos and streams their output.
package build

import (
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sync"

	"stitch/internal/config"
)

// Prepare validates a build request and returns the repo directory and npm command to run.
func Prepare(repoPath, script string) (string, string, error) {
	if repoPath == "" {
		return "", "", errors.New("Repository path is required.")
	}

	absPath, _ := filepath.Abs(repoPath)
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		return "", "", errors.New("Repository path does not exist.")
	}

	// Security: only allow running builds inside tracked repos.
	cfg := config.Read()
	allowed := false
	for _, repo := range cfg.Repos {
		if repo.Path == "" {
			continue
		}
		if rAbs, _ := filepath.Abs(repo.Path); rAbs == absPath {
			allowed = true
			break
		}
	}
	if !allowed {
		return "", "", errors.New("Path is not a tracked repository in your workspace.")
	}

	// Security: restrict script name to word characters only (no shell metacharacters).
	for _, ch := range script {
		if !((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') ||
			(ch >= '0' && ch <= '9') || ch == '-' || ch == '_' || ch == ':') {
			return "", "", errors.New("Invalid script name.")
		}
	}

	command := "npm run build"
	if script != "" {
		command = fmt.Sprintf("npm run %s", script)
	}
	return absPath, command, nil
}

// Run executes command in dir, passing output chunks to sendLog as they arrive, and returns the exit code.
func Run(dir, command string, sendLog func(string)) int {
	sendLog(fmt.Sprintf("Starting build task: %s in %s\n", command, dir))

	cmd := exec.Command("sh", "-c", command)
	cmd.Dir = dir

	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		sendLog(fmt.Sprintf("[ERROR] Failed to obtain stdout: %v\n", err))
		return 1
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		sendLog(fmt.Sprintf("[ERROR] Failed to obtain stderr: %v\n", err))
		return 1
	}

	if err := cmd.Start(); err != nil {
		sendLog(fmt.Sprintf("[ERROR] Failed to start command: %v\n", err))
		return 1
	}

	// Both pipes must be drained before Wait, which closes them.
	var wg sync.WaitGroup
	pipe := func(r io.Reader) {
		defer wg.Done()
		buf := make([]byte, 1024)
		for {
			n, err := r.Read(buf)
			if n > 0 {
				sendLog(string(buf[:n]))
			}
			if err != nil {
				return
			}
		}
	}
	wg.Add(2)
	go pipe(stdoutPipe)
	go pipe(stderrPipe)
	wg.Wait()

	err = cmd.Wait()
	if err != nil {
		sendLog(fmt.Sprintf("[ERROR] Command finished with error: %v\n", err))
	} else {
		sendLog("[SUCCESS] Build task completed successfully.\n")
	}
	return cmd.ProcessState.ExitCode()
}
