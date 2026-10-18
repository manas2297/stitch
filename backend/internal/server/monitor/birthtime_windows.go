package monitor

import (
	"os"
	"syscall"
	"time"
)

// createdAt returns the file's creation time, falling back to its modification time.
func createdAt(info os.FileInfo) time.Time {
	if d, ok := info.Sys().(*syscall.Win32FileAttributeData); ok {
		return time.Unix(0, d.CreationTime.Nanoseconds())
	}
	return info.ModTime()
}
