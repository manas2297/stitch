# Stitch 🧵

Stitch is a productivity-first developer dashboard that groups and manages your GitHub repositories (both local clones and web-only remotes) by your active energy levels (Low, Medium, High). 

It aggregates issues, PR reviews, tag releases, and build states into a single workspace, utilizing the official GitHub CLI (`gh`) under the hood to ensure credentials are kept secure and local.

---

## Architecture

```
stitch/
  backend/                  ← Go backend module (REST API + Wails desktop GUI)
    main.go                 ← Entrypoint routing server/desktop targets
    internal/
      desktop/              ← Wails app setup & browser runtime bindings
      server/               ← REST API server endpoints & Git logic
  config.json               ← Local database of tracked repos (gitignored)
  client/                   ← Vite + React frontend app
    src/
      store/useAppStore.js  ← Zustand global state + apiFetch routing wrapper
      components/           ← Tab panels & UI elements (Overview, Repositories, Profile...)
```

## Features

- **🏠 Home Overview**: Aggregates all repos, showing total counts, active PRs, issues, and local vs web breakdown.
- **📁 Repositories Workspace**: Dedicated workspace manager to add local repo directories, toggle focus tags, star primary major projects, and manage cloned files.
- **👤 Developer Profile**: Form interfaces for global Git configure properties, environment runtime checks (Go, Node, Python, Postgres, Redis), and macOS diagnostics.
- **⚡ Energy-Guided Navigation**:
  - **Low Energy**: PR Reviews & Issues (low overhead tasks).
  - **Medium Energy**: Cut Release (tag status & commit details) & Major Projects.
  - **High Energy**: Focus Workspace (files/Git status) & Fix Builds (running builds/lint tasks).
- **⭐ Major Projects Deep-Dive**: Clicking on starred projects displays a detail workspace partitioning features, bugs, reviews, issues, and a remote-synced roadmap.
- **🗺️ Remote Roadmap Sync**: Roadmap items are saved to, and read from, a GitHub issue tagged with the label `roadmap`. The label and issue are automatically set up on the remote.

---

## Setup & Running

### 1. Prerequisites
Ensure you have the GitHub CLI (`gh`) installed and authenticated:
```bash
# Verify installation
gh --version

# Authenticate with your GitHub account
gh auth login
```

### 2. Install Dependencies
```bash
# Install Node packages
npm install

# Download Go library dependencies
go mod tidy
```

### 3. Initialize Configuration
Copy the template configuration file:
```bash
cp config.example.json config.json
```

### 4. Running Development Servers (Hot Reload)

To start the Go backend server (managed by `air` for hot reloading) and the React frontend developer client:
```bash
npm run dev
```
Open `http://localhost:5173` to access the application.

---

## Desktop App Packaging (Wails)

Stitch can be bundled as a standalone desktop GUI application (`.app` for macOS) using **Wails**.

### 1. Install Wails CLI
```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

### 2. Wails Development Mode (Live-Reload GUI)
This boots the desktop app window directly with hot-reload enabled for both Go changes and React/CSS updates:
```bash
# Navigate to the backend directory
cd backend

# Start Wails dev mode
~/go/bin/wails dev
```

### 3. Packaging standalone Stitch.app
To build the final production-ready application bundle:
```bash
# 1. Compile frontend client assets
cd client && npm run build

# 2. Package the app bundle
cd .. && ~/go/bin/wails build -s
```
Your compiled native bundle is created under: **`build/bin/Stitch.app`**.
