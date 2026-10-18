//go:build !darwin && !windows

package monitor

import (
	"os"
	"time"
)

// createdAt falls back to modification time where birth time is not exposed by the syscall package.
func createdAt(info os.FileInfo) time.Time {
	return info.ModTime()
}
