package monitor

import (
	"os"
	"syscall"
	"time"
)

// createdAt returns the file's creation (birth) time, falling back to its modification time.
func createdAt(info os.FileInfo) time.Time {
	if st, ok := info.Sys().(*syscall.Stat_t); ok && st.Birthtimespec.Sec > 0 {
		return time.Unix(st.Birthtimespec.Sec, st.Birthtimespec.Nsec)
	}
	return info.ModTime()
}
