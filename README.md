# Stitch 🧵

Stitch is a productivity-first developer dashboard that groups and manages your GitHub repositories (both local clones and web-only remotes) by your active energy levels (Low, Medium, High). 

It aggregates issues, PR reviews, tag releases, and build states into a single workspace, utilizing the official GitHub CLI (`gh`) under the hood to ensure credentials are kept secure and local.

---

## Architecture

```
stitch/
  server.js                 ← Express API Orchestrator (gh CLI wrapper)
  config.json               ← Local database of tracked repos (gitignored)
  client/                   ← Vite + React frontend app
    src/
      store/useAppStore.js  ← Zustand global state
      components/           ← Tab panels & UI elements (Overview, Focus, Roadmap...)
```

## Features

- **🏠 Home Overview**: Aggregates all repos, showing total counts, active PRs, issues, and local vs web breakdown.
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
npm install
```

### 3. Initialize Configuration
Copy the template configuration file:
```bash
cp config.example.json config.json
```

### 4. Start Development Server
```bash
npm run dev
```
This runs the nodemon Express backend on `http://127.0.0.1:4000` and the Vite/React dev server on `http://127.0.0.1:5173/`. 
Open `http://127.0.0.1:5173/` in your browser.

### 5. Production Build
To build and serve the application as a single production bundle:
```bash
npm run build
npm start
```
Go to `http://127.0.0.1:4000` to access the production app.
