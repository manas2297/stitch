package monitor

// sessionRule describes where a provider stores its chat/agent sessions, relative to ~/.<provider>.
// Patterns use filepath.Match syntax, matched one path segment at a time.
type sessionRule struct {
	Pattern string
	// Dir: every directory matching Pattern is one session (all files beneath it belong to it).
	// Otherwise every file matching Pattern is one session.
	Dir bool
	// SiblingDir: for file sessions, a directory with the same stem next to the file (e.g. Claude's
	// <uuid>.jsonl + <uuid>/subagents) belongs to the same session.
	SiblingDir bool
	// GroupSegment is the path segment used to group sessions (e.g. the project folder); -1 uses GroupLabel.
	GroupSegment int
	GroupLabel   string
}

// category is a named storage bucket. Files are assigned to the first category whose prefix matches.
type category struct {
	ID          string
	Label       string
	Prefixes    []string
	Description string
	// Cleanable categories hold regenerable caches/logs that a cleanup action may clear.
	Cleanable bool
}

type providerProfile struct {
	ID         string
	Label      string
	Sessions   []sessionRule
	Categories []category
	// Protected patterns are never deleted by any cleanup action (config, credentials, memory, extensions).
	Protected []string
	// SessionData lists directories whose children are named after a session id (e.g. file-history/<uuid>).
	// They are deleted along with their session and reported as orphans once the session is gone.
	SessionData []string
}

var profiles = map[string]providerProfile{
	"claude": {
		ID:    "claude",
		Label: "Claude Code",
		Sessions: []sessionRule{
			{Pattern: "projects/*/*.jsonl", SiblingDir: true, GroupSegment: 1},
		},
		Categories: []category{
			{ID: "transcripts", Label: "Chat transcripts", Prefixes: []string{"projects"}, Description: "Conversation history per project. Needed for --resume."},
			{ID: "file-history", Label: "File edit history", Prefixes: []string{"file-history"}, Cleanable: true, Description: "Pre-edit file snapshots used to rewind a session."},
			{ID: "shell-snapshots", Label: "Shell snapshots", Prefixes: []string{"shell-snapshots"}, Cleanable: true, Description: "Captured shell environments, recreated on demand."},
			{ID: "todos", Label: "Todo lists", Prefixes: []string{"todos"}, Cleanable: true, Description: "Per-session task lists."},
			{ID: "debug", Label: "Debug logs", Prefixes: []string{"debug"}, Cleanable: true, Description: "Per-session debug output."},
			{ID: "telemetry", Label: "Telemetry cache", Prefixes: []string{"statsig", "telemetry"}, Cleanable: true, Description: "Feature-flag and telemetry caches."},
			{ID: "session-env", Label: "Session env", Prefixes: []string{"session-env", "paste-cache"}, Cleanable: true, Description: "Per-session environment and paste caches."},
			{ID: "plans", Label: "Plans", Prefixes: []string{"plans"}, Description: "Saved plan-mode documents."},
			{ID: "extensions", Label: "Plugins, skills & agents", Prefixes: []string{"plugins", "skills", "agents", "commands", "hooks"}, Description: "Installed customisations."},
		},
		Protected: []string{
			".credentials.json", "settings.json", "settings.local.json", "CLAUDE.md", "keybindings.json",
			"plugins", "skills", "agents", "commands", "hooks", "projects/*/memory",
		},
		SessionData: []string{"file-history", "todos", "session-env", "debug", "shell-snapshots"},
	},
	"codex": {
		ID:    "codex",
		Label: "Codex",
		Sessions: []sessionRule{
			{Pattern: "sessions/*/*/*/*.jsonl", GroupSegment: -1, GroupLabel: "Sessions"},
			{Pattern: "archived_sessions/*.jsonl", GroupSegment: -1, GroupLabel: "Archived"},
		},
		Categories: []category{
			{ID: "sessions", Label: "Sessions", Prefixes: []string{"sessions"}, Description: "Rollout transcripts. Needed for codex resume."},
			{ID: "archived", Label: "Archived sessions", Prefixes: []string{"archived_sessions"}, Description: "Sessions you archived."},
			{ID: "logs", Label: "Logs", Prefixes: []string{"log"}, Cleanable: true, Description: "CLI logs."},
		},
		Protected: []string{"auth.json", "config.toml", "AGENTS.md", "prompts", "rules"},
	},
	"gemini": {
		ID:    "gemini",
		Label: "Gemini / Antigravity",
		Sessions: []sessionRule{
			{Pattern: "antigravity-ide/brain/*", Dir: true, GroupSegment: -1, GroupLabel: "Antigravity brain"},
			{Pattern: "antigravity/conversations/*", GroupSegment: -1, GroupLabel: "Antigravity"},
			{Pattern: "tmp/*/chats/*", GroupSegment: 1},
		},
		Categories: []category{
			{ID: "brain", Label: "Agent brain", Prefixes: []string{"antigravity-ide/brain"}, Description: "Per-conversation artifacts, screenshots and recordings."},
			{ID: "antigravity", Label: "Antigravity", Prefixes: []string{"antigravity", "antigravity-ide"}, Description: "Conversations and IDE state."},
			{ID: "cli", Label: "Gemini CLI", Prefixes: []string{"tmp", "history"}, Description: "CLI chats, checkpoints and history per project."},
		},
		Protected: []string{"oauth_creds.json", "google_accounts.json", "settings.json", "GEMINI.md", "installation_id", "extensions", "antigravity/mcp_config.json"},
	},
	"cursor": {
		ID:    "cursor",
		Label: "Cursor",
		Sessions: []sessionRule{
			{Pattern: "projects/*/agent-transcripts/*", GroupSegment: 1},
		},
		Categories: []category{
			{ID: "extensions", Label: "Extensions", Prefixes: []string{"extensions"}, Description: "Installed editor extensions (never cleaned here)."},
			{ID: "projects", Label: "Projects", Prefixes: []string{"projects"}, Description: "Per-project agent transcripts and state."},
			{ID: "ai-tracking", Label: "AI tracking", Prefixes: []string{"ai-tracking"}, Cleanable: true, Description: "Local AI usage tracking database."},
		},
		Protected: []string{"extensions", "mcp.json", "argv.json", "cli-config.json", "ide_state.json", "rules"},
	},
	"openai":    {ID: "openai", Label: "OpenAI"},
	"anthropic": {ID: "anthropic", Label: "Anthropic"},
}

// providerOrder is the display order for the provider picker.
var providerOrder = []string{"claude", "codex", "gemini", "cursor", "openai", "anthropic"}

// protectedNames are basename patterns that are never deleted for any provider.
var protectedNames = []string{
	"*credential*", "*oauth*", "*token*", "auth.json", "*.pem", "*.key", ".env*",
	"settings*.json", "config.toml", "config.json", "mcp*.json",
}

var mediaExts = map[string]bool{
	".webp": true, ".png": true, ".jpg": true, ".jpeg": true, ".gif": true,
	".webm": true, ".mp4": true, ".mov": true,
}
