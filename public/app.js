document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const energyBtns = document.querySelectorAll('.energy-btn');
  const menuItems = document.querySelectorAll('.menu-item');
  const sections = document.querySelectorAll('.section-content');
  const localRepoList = document.getElementById('localRepoList');
  const webRepoList = document.getElementById('webRepoList');
  const addRepoForm = document.getElementById('addRepoForm');
  const newRepoPathInput = document.getElementById('newRepoPath');
  
  // Dropdown Selectors
  const prRepoSelector = document.getElementById('prRepoSelector');
  const issueRepoSelector = document.getElementById('issueRepoSelector');
  const buildRepoSelector = document.getElementById('buildRepoSelector');
  const buildScriptSelector = document.getElementById('buildScriptSelector');
  const focusProjectSelector = document.getElementById('focusProjectSelector');
  
  // Containers
  const releasesContainer = document.getElementById('releasesContainer');
  const prListContainer = document.getElementById('prListContainer');
  const issueListContainer = document.getElementById('issueListContainer');
  const majorProjectsContainer = document.getElementById('majorProjectsContainer');
  const focusWorkspaceContainer = document.getElementById('focusWorkspaceContainer');
  const terminalConsole = document.getElementById('terminalConsole');
  const terminalStatus = document.getElementById('terminalStatus');
  const runBuildBtn = document.getElementById('runBuildBtn');
  
  // Modal Elements
  const releaseModal = document.getElementById('releaseModal');
  const releaseForm = document.getElementById('releaseForm');
  const modalRepoPath = document.getElementById('modalRepoPath');
  const modalRepoOwner = document.createElement('input');
  modalRepoOwner.type = 'hidden';
  modalRepoOwner.id = 'modalRepoOwner';
  const modalRepoName = document.createElement('input');
  modalRepoName.type = 'hidden';
  modalRepoName.id = 'modalRepoName';
  releaseForm.appendChild(modalRepoOwner);
  releaseForm.appendChild(modalRepoName);

  const modalTagName = document.getElementById('modalTagName');
  const modalReleaseNotes = document.getElementById('modalReleaseNotes');
  const closeModalBtn = document.getElementById('closeModalBtn');

  // App State
  let repos = [];
  let focusProject = '';
  let currentEventSource = null;

  // 1. Navigation & Energy Selection
  energyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      energyBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const selectedEnergy = btn.dataset.energy;
      filterSidebarByEnergy(selectedEnergy);
    });
  });

  function filterSidebarByEnergy(energy) {
    let firstVisibleTab = null;
    
    menuItems.forEach(item => {
      const itemEnergy = item.dataset.energyLevel;
      if (energy === 'all' || itemEnergy === energy) {
        item.style.display = 'flex';
        if (!firstVisibleTab) firstVisibleTab = item;
      } else {
        item.style.display = 'none';
      }
    });

    const activeItem = document.querySelector('.menu-item.active');
    if (activeItem && activeItem.style.display === 'none' && firstVisibleTab) {
      switchTab(firstVisibleTab.dataset.tab);
    }
  }

  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      switchTab(item.dataset.tab);
    });
  });

  function switchTab(tabId) {
    menuItems.forEach(item => {
      if (item.dataset.tab === tabId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    sections.forEach(section => {
      if (section.id === `${tabId}-section`) {
        section.classList.add('active');
      } else {
        section.classList.remove('active');
      }
    });

    // Trigger tab-specific loaders
    if (tabId === 'releases') loadReleases();
    if (tabId === 'pr-reviews') loadPrReviews();
    if (tabId === 'issues') loadIssues();
    if (tabId === 'builds') updateBuildScripts();
    if (tabId === 'projects') loadMajorProjects();
    if (tabId === 'focus') loadFocusWorkspace();
  }

  // 2. Fetch Config & Repositories
  async function loadRepos() {
    try {
      const response = await fetch('/api/repos');
      const data = await response.json();
      repos = data.repos;
      focusProject = data.focusProject;
      
      renderRepoList();
      populateDropdowns();
      
      const activeTab = document.querySelector('.menu-item.active');
      if (activeTab) switchTab(activeTab.dataset.tab);
    } catch (err) {
      console.error('Error loading repos:', err);
    }
  }

  function renderRepoList() {
    localRepoList.innerHTML = '';
    webRepoList.innerHTML = '';

    repos.forEach(repo => {
      const div = document.createElement('div');
      div.className = `repo-mini-card ${repo.exists ? '' : 'broken'}`;
      
      const typeIcon = repo.type === 'local' ? '💻' : '🌐';
      const secondaryText = repo.type === 'local' ? repo.path : `${repo.owner}/${repo.name}`;
      
      div.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:2px; max-width:70%">
          <span style="font-weight:600; text-overflow:ellipsis; overflow:hidden;">${typeIcon} ${repo.name}</span>
          <span style="font-size:0.7rem; color:var(--text-muted); text-overflow:ellipsis; overflow:hidden;">${secondaryText}</span>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="major-toggle-btn" data-path="${repo.path || ''}" data-owner="${repo.owner || ''}" data-name="${repo.name || ''}" style="background:transparent; border:none; cursor:pointer; font-size:1rem; color:${repo.isMajorProject ? 'var(--energy-medium)' : 'var(--text-muted)'}">
            ${repo.isMajorProject ? '★' : '☆'}
          </button>
          <button class="delete-btn" data-path="${repo.path || ''}" data-owner="${repo.owner || ''}" data-name="${repo.name || ''}">×</button>
        </div>
      `;

      if (repo.type === 'local') {
        localRepoList.appendChild(div);
      } else {
        webRepoList.appendChild(div);
      }
    });

    // Wire delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const repoPath = btn.dataset.path;
        const owner = btn.dataset.owner;
        const name = btn.dataset.name;
        if (confirm(`Remove repository: ${name}?`)) {
          await deleteRepo({ path: repoPath, owner, name });
        }
      });
    });

    // Wire major toggle buttons
    document.querySelectorAll('.major-toggle-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await toggleMajorProject({ path: btn.dataset.path, owner: btn.dataset.owner, name: btn.dataset.name });
      });
    });
  }

  async function toggleMajorProject(params) {
    try {
      await fetch('/api/repos/toggle-major', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      await loadRepos();
    } catch (err) {
      console.error(err);
    }
  }

  function populateDropdowns() {
    const reposWithRemotes = repos.filter(r => r.owner && r.name);
    
    prRepoSelector.innerHTML = '<option value="">All Repositories (Recent 10)</option>';
    issueRepoSelector.innerHTML = '<option value="">All Repositories (Recent 10)</option>';
    buildRepoSelector.innerHTML = '';
    focusProjectSelector.innerHTML = '<option value="">-- Select Active Project --</option>';

    reposWithRemotes.forEach(repo => {
      const slug = `${repo.owner}/${repo.name}`;
      const optionPr = new Option(slug, repo.path || slug);
      optionPr.dataset.owner = repo.owner;
      optionPr.dataset.name = repo.name;
      prRepoSelector.add(optionPr);

      const optionIssue = new Option(slug, repo.path || slug);
      optionIssue.dataset.owner = repo.owner;
      optionIssue.dataset.name = repo.name;
      issueRepoSelector.add(optionIssue);
    });

    // For builds, only local repositories can execute commands
    repos.filter(r => r.exists && r.type === 'local').forEach(repo => {
      const optionBuild = new Option(repo.name, repo.path);
      buildRepoSelector.add(optionBuild);
    });

    repos.forEach(repo => {
      const value = repo.path || `${repo.owner}/${repo.name}`;
      const optionFocus = new Option(`${repo.type === 'local' ? '💻' : '🌐'} ${repo.name}`, value);
      focusProjectSelector.add(optionFocus);
    });

    if (focusProject) {
      focusProjectSelector.value = focusProject;
    }
  }

  addRepoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const repoPath = newRepoPathInput.value.trim();
    if (!repoPath) return;

    try {
      const response = await fetch('/api/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: repoPath })
      });
      const result = await response.json();
      if (response.ok) {
        newRepoPathInput.value = '';
        await loadRepos();
      } else {
        alert(result.error || 'Failed to add repository.');
      }
    } catch (err) {
      alert('Error connecting to local server.');
    }
  });

  async function deleteRepo(params) {
    try {
      await fetch('/api/repos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      await loadRepos();
    } catch (err) {
      console.error(err);
    }
  }

  // 3. Focus Area Workspace
  focusProjectSelector.addEventListener('change', async () => {
    const selectedValue = focusProjectSelector.value;
    const selectedOption = focusProjectSelector.options[focusProjectSelector.selectedIndex];
    
    let params = { path: '', owner: '', name: '' };
    if (selectedValue.includes('/')) {
      const [owner, name] = selectedValue.split('/');
      params.owner = owner;
      params.name = name;
    } else {
      params.path = selectedValue;
    }

    try {
      await fetch('/api/repos/set-focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      focusProject = selectedValue;
      loadFocusWorkspace();
    } catch (err) {
      console.error(err);
    }
  });

  async function loadFocusWorkspace() {
    if (!focusProject) {
      focusWorkspaceContainer.innerHTML = `
        <div style="text-align:center; padding:3rem; color:var(--text-muted);">
          <h2>No Active Project in Focus</h2>
          <p style="margin-top:10px;">Select a repository from the header dropdown to start working in the Focus Workspace.</p>
        </div>
      `;
      return;
    }

    focusWorkspaceContainer.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <span>Retrieving Workspace Context...</span>
      </div>
    `;

    try {
      const res = await fetch('/api/focus/info');
      const data = await res.json();
      
      if (!data.active) {
        focusWorkspaceContainer.innerHTML = `<div style="color:var(--text-muted)">Workspace directory not found or unavailable.</div>`;
        return;
      }

      const isLocal = data.type === 'local';

      // Filter features
      const features = data.issues.filter(issue => 
        issue.labels.some(l => {
          const name = l.name.toLowerCase();
          return name.includes('feature') || name.includes('enhancement');
        })
      );

      const featuresHtml = features.length > 0
        ? features.map(f => `
            <div class="list-item" style="margin-bottom:8px;">
              <div class="item-left">
                <a href="${f.url}" target="_blank" class="item-title">#${f.number} ${f.title}</a>
                <span class="item-subtitle">Created by @${f.author.login}</span>
              </div>
              <div>
                <span class="badge badge-purple">Feature</span>
              </div>
            </div>
          `).join('')
        : `<div style="font-size:0.9rem; color:var(--text-muted)">No active feature issues. Open a github issue with a 'feature' tag to track it here.</div>`;

      // PR Reviews
      const prsHtml = data.prs.length > 0
        ? data.prs.map(pr => `
            <div class="list-item" style="margin-bottom:8px;">
              <div class="item-left">
                <a href="${pr.url}" target="_blank" class="item-title">#${pr.number} ${pr.title}</a>
                <span class="item-subtitle">Requested by @${pr.author.login}</span>
              </div>
            </div>
          `).join('')
        : `<div style="font-size:0.9rem; color:var(--text-muted)">No active pull request reviews.</div>`;

      // Local / Web context panel
      let sidePanelHtml = '';
      if (isLocal) {
        const gitHtml = data.localStatus.length > 0
          ? `<div class="git-status-box">${data.localStatus.map(s => `<div>${escapeHtml(s)}</div>`).join('')}</div>`
          : `<div style="font-size:0.9rem; color:var(--text-muted)">Working directory clean. No uncommitted modifications.</div>`;

        sidePanelHtml = `
          <!-- Git Context -->
          <div class="focus-card">
            <h3><span>🌱</span> Local Git State</h3>
            <div style="font-size:0.85rem; margin-bottom:12px; color:var(--text-muted)">
              Active Branch: <strong style="color:var(--text-color)">${data.repo.branch}</strong>
            </div>
            ${gitHtml}
          </div>

          <!-- Bot Reviews / Diagnostics -->
          <div class="focus-card bot-review-card">
            <h3><span>🤖</span> Bot Review Diagnostics</h3>
            <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:12px;">Run a local validation script to audit build health.</p>
            <button class="btn" id="triggerBotReviewBtn" style="width:100%;">Run Build Audit</button>
            <div id="botReviewResult" style="margin-top:12px; display:none; background:#070810; padding:10px; border-radius:8px; font-family:monospace; font-size:0.75rem; border:1px solid rgba(168,85,247,0.3); max-height:200px; overflow-y:auto; white-space:pre-wrap;"></div>
          </div>
        `;
      } else {
        sidePanelHtml = `
          <!-- Web Only Context -->
          <div class="focus-card">
            <h3><span>🌐</span> Remote Repository Context</h3>
            <p style="font-size:0.85rem; color:var(--text-muted); line-height:1.4;">
              This is a remote GitHub repository tracking configuration. Local commands and file-system status tracking are disabled for web projects.
            </p>
            <div style="margin-top:12px;">
              <a href="https://github.com/${data.repo.owner}/${data.repo.name}" target="_blank" class="btn" style="width:100%; display:inline-flex; justify-content:center;">
                View on GitHub 🔗
              </a>
            </div>
          </div>

          <!-- Remote File Explorer -->
          <div class="focus-card" style="margin-top: 1.5rem;">
            <h3><span>📁</span> Remote File Explorer</h3>
            <div id="breadcrumbPath" style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 4px;"></div>
            <div id="remoteExplorerList" style="display: flex; flex-direction: column; gap: 6px; max-height: 250px; overflow-y: auto; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 0.85rem;"></div>
          </div>
        `;
      }

      focusWorkspaceContainer.innerHTML = `
        <div class="focus-grid">
          <div class="focus-main">
            <!-- Features to Work On -->
            <div class="focus-card">
              <h3><span>💡</span> Features to Work On</h3>
              <div style="margin-top:10px;">
                ${featuresHtml}
              </div>
            </div>

            <!-- PR Reviews -->
            <div class="focus-card">
              <h3><span>👀</span> Pull Request Reviews</h3>
              <div style="margin-top:10px;">
                ${prsHtml}
              </div>
            </div>

            <!-- Remote File Viewer -->
            <div id="remoteFileViewerCard" class="focus-card" style="display:none; margin-top:1.5rem;">
              <h3 style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:8px; margin-bottom:10px;">
                <span id="remoteFileName">📄 File Content</span>
                <button class="btn btn-secondary" id="closeFileViewerBtn" style="padding:4px 8px; font-size:0.75rem;">Close Viewer</button>
              </h3>
              <pre style="margin:0; background:#05070c; padding:12px; border-radius:8px; border:1px solid var(--border-color); overflow-x:auto; font-family:monospace; font-size:0.8rem; max-height:400px; color:#a9b1d6; white-space:pre-wrap;"><code id="remoteFileCode"></code></pre>
            </div>
          </div>

          <div class="focus-side">
            ${sidePanelHtml}
          </div>
        </div>
      `;

      if (isLocal) {
        const botBtn = document.getElementById('triggerBotReviewBtn');
        const botOutput = document.getElementById('botReviewResult');
        botBtn.addEventListener('click', () => {
          botOutput.style.display = 'block';
          botOutput.innerHTML = 'Analyzing repository build... [SSE Log Stream Started]\n';
          
          const buildScript = data.repo.buildScripts.includes('lint') ? 'lint' : (data.repo.buildScripts.includes('build') ? 'build' : '');
          const sseUrl = `/api/build/run?path=${encodeURIComponent(data.repo.path)}&script=${encodeURIComponent(buildScript)}`;
          const es = new EventSource(sseUrl);

          es.onmessage = (event) => {
            const sseData = JSON.parse(event.data);
            if (sseData.log) {
              botOutput.innerHTML += escapeHtml(sseData.log);
              botOutput.scrollTop = botOutput.scrollHeight;
            }
            if (sseData.done) {
              es.close();
              botOutput.innerHTML += `\n[SYSTEM] Check completed with exit code ${sseData.exitCode}.\n`;
            }
          };

          es.onerror = () => {
            es.close();
            botOutput.innerHTML += `\n[SYSTEM ERROR] Connection failed.\n`;
          };
        });
      } else {
        loadRemoteDirectory('', data.repo.owner, data.repo.name);
      }

    } catch (err) {
      focusWorkspaceContainer.innerHTML = `<div class="error-message">Failed to load focus workspace: ${err.message}</div>`;
    }
  }

  // 4. Major Projects Tracking
  async function loadMajorProjects() {
    majorProjectsContainer.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <span>Loading Major Projects...</span>
      </div>
    `;

    try {
      const majorRepos = repos.filter(r => r.isMajorProject);

      if (majorRepos.length === 0) {
        majorProjectsContainer.innerHTML = `
          <div style="color:var(--text-muted); text-align:center; padding:3rem;">
            <div style="font-size:2rem; margin-bottom:12px;">🎯</div>
            <div style="font-weight:600; margin-bottom:8px;">No Major Projects yet</div>
            <div style="font-size:0.85rem;">Click the ☆ star icon next to any repository in the sidebar to track it as a Major Project.</div>
          </div>
        `;
        return;
      }

      // Render cards grid
      majorProjectsContainer.innerHTML = '';
      const grid = document.createElement('div');
      grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.25rem;';
      majorProjectsContainer.appendChild(grid);

      for (const repo of majorRepos) {
        const card = document.createElement('div');
        card.className = 'major-project-card';
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div>
              <div style="font-size:1.15rem; font-weight:700; display:flex; align-items:center; gap:8px;">
                <span>${repo.type === 'local' ? '💻' : '🌐'}</span> ${repo.name}
              </div>
              <div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">${repo.owner || 'local'}/${repo.name}</div>
            </div>
            <span class="badge badge-green">⭐ Major</span>
          </div>
          <div class="project-stats" id="stats-${repo.owner}-${repo.name}">
            <div class="stat-pill"><div class="stat-val">—</div><div class="stat-label">Features</div></div>
            <div class="stat-pill"><div class="stat-val">—</div><div class="stat-label">Bugs</div></div>
            <div class="stat-pill"><div class="stat-val">—</div><div class="stat-label">PRs</div></div>
            <div class="stat-pill"><div class="stat-val">—</div><div class="stat-label">Issues</div></div>
          </div>
          <div class="open-hint">Click to open project workspace →</div>
        `;

        card.addEventListener('click', () => openProjectDetail(repo));
        grid.appendChild(card);

        // Async-load stats for each card (non-blocking)
        if (repo.owner && repo.name) {
          fetch(`/api/projects/details?owner=${repo.owner}&name=${repo.name}`)
            .then(r => r.json())
            .then(d => {
              const el = document.getElementById(`stats-${repo.owner}-${repo.name}`);
              if (!el) return;
              el.innerHTML = `
                <div class="stat-pill"><div class="stat-val" style="color:#c084fc;">${d.features.length}</div><div class="stat-label">Features</div></div>
                <div class="stat-pill"><div class="stat-val" style="color:var(--error);">${d.bugs.length}</div><div class="stat-label">Bugs</div></div>
                <div class="stat-pill"><div class="stat-val" style="color:var(--energy-low);">${d.prs.length}</div><div class="stat-label">PRs</div></div>
                <div class="stat-pill"><div class="stat-val" style="color:var(--text-muted);">${d.general.length}</div><div class="stat-label">Issues</div></div>
              `;
            })
            .catch(() => {});
        }
      }

    } catch (err) {
      majorProjectsContainer.innerHTML = `<div class="error-message">Failed to load major projects: ${err.message}</div>`;
    }
  }

  // ── Project Detail Deep-Dive ───────────────────────────────────────────────

  async function openProjectDetail(repo) {
    majorProjectsContainer.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <span>Loading ${repo.name} workspace...</span>
      </div>
    `;

    try {
      const [detailsRes, roadmapRes] = await Promise.all([
        fetch(`/api/projects/details?owner=${repo.owner}&name=${repo.name}`),
        repo.owner && repo.name ? fetch(`/api/roadmap?owner=${repo.owner}&name=${repo.name}`) : Promise.resolve({ json: () => ({ tasks: [], issue: null }) })
      ]);

      const details = await detailsRes.json();
      const roadmap = await roadmapRes.json();

      const renderIssueList = (items, emptyMsg) => items.length > 0
        ? items.map(issue => `
            <div class="list-item" style="margin-bottom:8px;">
              <div class="item-left">
                <a href="${issue.url}" target="_blank" class="item-title">#${issue.number} ${escapeHtml(issue.title)}</a>
                <div class="item-subtitle">
                  by @${issue.author?.login || '?'} · ${new Date(issue.createdAt).toLocaleDateString()}
                  ${issue.labels.map(l => `<span class="badge" style="margin-left:4px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); text-transform:none;">${l.name}</span>`).join('')}
                </div>
              </div>
            </div>`).join('')
        : `<div style="color:var(--text-muted); padding:1rem 0; font-size:0.9rem;">${emptyMsg}</div>`;

      const renderPrList = (prs) => prs.length > 0
        ? prs.map(pr => `
            <div class="list-item" style="margin-bottom:8px;">
              <div class="item-left">
                <a href="${pr.url}" target="_blank" class="item-title">#${pr.number} ${escapeHtml(pr.title)}</a>
                <div class="item-subtitle">by @${pr.author?.login || '?'} · ${new Date(pr.createdAt).toLocaleDateString()}</div>
              </div>
              ${pr.reviewRequests?.length > 0 ? '<span class="badge badge-orange">Review Requested</span>' : '<span class="badge badge-blue">Open</span>'}
            </div>`).join('')
        : `<div style="color:var(--text-muted); padding:1rem 0; font-size:0.9rem;">No open pull requests.</div>`;

      const roadmapTasksHtml = roadmap.tasks.length > 0
        ? roadmap.tasks.map((t, i) => `
            <div class="roadmap-task ${t.done ? 'done' : ''}">
              <input type="checkbox" class="task-checkbox" ${t.done ? 'checked' : ''} disabled>
              <span class="task-text">${escapeHtml(t.text)}</span>
            </div>`).join('')
        : `<div style="color:var(--text-muted); font-size:0.9rem; padding: 0.5rem 0;">No roadmap tasks yet. Add the first item below.</div>`;

      const roadmapLinkHtml = roadmap.issue
        ? `<a href="${roadmap.issue.url}" target="_blank" style="font-size:0.8rem; color:var(--primary); text-decoration:none;">View on GitHub #${roadmap.issue.number} ↗</a>`
        : `<span style="font-size:0.8rem; color:var(--text-muted);">Roadmap issue will be created automatically on GitHub when you add the first task.</span>`;

      majorProjectsContainer.innerHTML = `
        <div class="project-detail-header">
          <button class="back-btn" id="backToProjectsBtn">← Back</button>
          <div>
            <div class="project-detail-title">${repo.type === 'local' ? '💻' : '🌐'} ${repo.name}</div>
            <div class="project-detail-meta">
              <span>${repo.owner}/${repo.name}</span>
              <span>·</span>
              <span>Last release: <strong style="color:var(--energy-medium);">${details.lastTag}</strong></span>
            </div>
          </div>
          <a href="https://github.com/${repo.owner}/${repo.name}" target="_blank" class="btn btn-secondary" style="margin-left:auto;">View on GitHub 🔗</a>
        </div>

        <div class="inner-tabs">
          <button class="inner-tab active" data-panel="features">💡 Features <span class="tab-count">${details.features.length}</span></button>
          <button class="inner-tab" data-panel="bugs">🐛 Bugs <span class="tab-count">${details.bugs.length}</span></button>
          <button class="inner-tab" data-panel="reviews">👀 Reviews <span class="tab-count">${details.prs.length}</span></button>
          <button class="inner-tab" data-panel="issues">📋 Issues <span class="tab-count">${details.general.length}</span></button>
          <button class="inner-tab" data-panel="roadmap">🗺️ Roadmap <span class="tab-count">${roadmap.tasks.length}</span></button>
        </div>

        <div class="inner-tab-panel active" id="panel-features">
          ${renderIssueList(details.features, 'No feature issues found. Label a GitHub issue with "feature" or "enhancement" to see it here.')}
        </div>
        <div class="inner-tab-panel" id="panel-bugs">
          ${renderIssueList(details.bugs, 'No bug issues found. Great news!')}
        </div>
        <div class="inner-tab-panel" id="panel-reviews">
          ${renderPrList(details.prs)}
        </div>
        <div class="inner-tab-panel" id="panel-issues">
          ${renderIssueList(details.general, 'No general open issues.')}
        </div>
        <div class="inner-tab-panel" id="panel-roadmap">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <div style="font-size:0.85rem; color:var(--text-muted);">Tasks are synced to a GitHub issue labeled <code style="background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px;">roadmap</code>.</div>
            ${roadmapLinkHtml}
          </div>
          <div class="roadmap-list" id="roadmapList">${roadmapTasksHtml}</div>
          <div class="roadmap-add-form">
            <input type="text" class="roadmap-input" id="roadmapInput" placeholder="Add a new roadmap task (e.g. 'Implement dark mode toggle')...">
            <button class="btn" id="addRoadmapBtn">Add Task</button>
          </div>
          <div id="roadmapMsg" style="margin-top:10px; font-size:0.85rem; display:none;"></div>
        </div>
      `;

      // Back button
      document.getElementById('backToProjectsBtn').addEventListener('click', loadMajorProjects);

      // Inner tabs
      document.querySelectorAll('.inner-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.inner-tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.inner-tab-panel').forEach(p => p.classList.remove('active'));
          tab.classList.add('active');
          document.getElementById(`panel-${tab.dataset.panel}`)?.classList.add('active');
        });
      });

      // Add roadmap task
      document.getElementById('addRoadmapBtn').addEventListener('click', async () => {
        const input = document.getElementById('roadmapInput');
        const msg = document.getElementById('roadmapMsg');
        const task = input.value.trim();
        if (!task) return;

        const btn = document.getElementById('addRoadmapBtn');
        btn.disabled = true;
        btn.innerText = 'Saving...';
        msg.style.display = 'none';

        try {
          const res = await fetch('/api/roadmap/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ owner: repo.owner, name: repo.name, task })
          });
          const result = await res.json();

          if (res.ok) {
            // Append task visually
            const list = document.getElementById('roadmapList');
            const noTasks = list.querySelector('div');
            if (noTasks && noTasks.style.color) list.innerHTML = '';
            const div = document.createElement('div');
            div.className = 'roadmap-task';
            div.innerHTML = `<input type="checkbox" class="task-checkbox" disabled><span class="task-text">${escapeHtml(task)}</span>`;
            list.appendChild(div);
            input.value = '';
            msg.style.display = 'block';
            msg.style.color = 'var(--success)';
            msg.innerText = `✓ ${result.message}`;
          } else {
            msg.style.display = 'block';
            msg.style.color = 'var(--error)';
            msg.innerText = `Error: ${result.error}`;
          }
        } catch (err) {
          msg.style.display = 'block';
          msg.style.color = 'var(--error)';
          msg.innerText = `Failed: ${err.message}`;
        } finally {
          btn.disabled = false;
          btn.innerText = 'Add Task';
        }
      });

      // Allow Enter key on roadmap input
      document.getElementById('roadmapInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('addRoadmapBtn').click();
      });

    } catch (err) {
      majorProjectsContainer.innerHTML = `<div class="error-message">Failed to load project details: ${err.message}</div>`;
    }
  }


  // 5. Cut Release Functionality
  async function loadReleases() {
    releasesContainer.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <span>Evaluating tag history & remote states...</span>
      </div>
    `;
    
    try {
      const res = await fetch('/api/releases');
      const data = await res.json();
      releasesContainer.innerHTML = '';

      if (data.releases.length === 0) {
        releasesContainer.innerHTML = '<div style="color:var(--text-muted)">No repositories configured yet.</div>';
        return;
      }

      data.releases.forEach(release => {
        const card = document.createElement('div');
        card.className = 'card';
        
        let commitsHtml = '';
        if (release.commits.length > 0) {
          commitsHtml = `
            <div class="commit-list">
              ${release.commits.map(c => {
                return `<div class="commit-item">${escapeHtml(c)}</div>`;
              }).join('')}
            </div>
          `;
        } else {
          commitsHtml = '<div style="font-size:0.8rem; color:var(--text-muted)">All commits are tagged and fully released.</div>';
        }

        const tagBadge = release.requiresRelease 
          ? `<span class="badge badge-orange">Pending Tag</span>` 
          : `<span class="badge badge-green">Up to Date</span>`;

        card.innerHTML = `
          <div class="card-header">
            <div>
              <div class="card-title">${release.name}</div>
              <div class="card-meta">
                <span>Tag: <strong>${release.lastTag}</strong></span>
                <span>•</span>
                <span>Type: <strong>${release.type}</strong></span>
              </div>
            </div>
            ${tagBadge}
          </div>
          ${commitsHtml}
          ${release.requiresRelease ? `
            <div class="release-action">
              <button class="btn trigger-release-btn" data-path="${release.path}" data-owner="${release.owner}" data-name="${release.name}">
                🏷️ Cut Release
              </button>
            </div>
          ` : ''}
        `;
        releasesContainer.appendChild(card);
      });

      document.querySelectorAll('.trigger-release-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          openReleaseModal(btn.dataset.path, btn.dataset.owner, btn.dataset.name);
        });
      });

    } catch (err) {
      releasesContainer.innerHTML = `
        <div class="error-message">
          <strong>Error loading release data:</strong>
          <span>${err.message}</span>
        </div>
      `;
    }
  }

  function openReleaseModal(path, owner, name) {
    modalRepoPath.value = path || '';
    modalRepoOwner.value = owner || '';
    modalRepoName.value = name || '';
    modalTagName.value = '';
    modalReleaseNotes.value = '';
    releaseModal.classList.add('active');
  }

  closeModalBtn.addEventListener('click', () => {
    releaseModal.classList.remove('active');
  });

  releaseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const path = modalRepoPath.value;
    const owner = modalRepoOwner.value;
    const name = modalRepoName.value;
    const tag = modalTagName.value.trim();
    const notes = modalReleaseNotes.value.trim();

    releaseModal.classList.remove('active');

    try {
      const response = await fetch('/api/release/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, owner, name, tag, notes })
      });
      const result = await response.json();
      if (response.ok) {
        alert(result.message || 'Release tag created!');
        loadReleases();
      } else {
        alert(`Error: ${result.error || 'Failed to create release'}`);
      }
    } catch (err) {
      alert('Error communicating with server.');
    }
  });

  // 6. PR Reviews Functionality
  prRepoSelector.addEventListener('change', loadPrReviews);

  async function loadPrReviews() {
    const selectedOption = prRepoSelector.options[prRepoSelector.selectedIndex];
    
    if (!selectedOption || !selectedOption.value) {
      loadRecentOverview();
      return;
    }

    const owner = selectedOption.dataset.owner;
    const name = selectedOption.dataset.name;

    prListContainer.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <span>Retrieving Pull Requests from GitHub...</span>
      </div>
    `;

    try {
      const res = await fetch(`/api/prs?owner=${owner}&name=${name}`);
      const data = await res.json();
      prListContainer.innerHTML = '';

      if (data.error) throw new Error(data.details || data.error);

      if (data.prs.length === 0) {
        prListContainer.innerHTML = '<div style="color:var(--text-muted); padding: 1.5rem 0;">No open Pull Requests found.</div>';
        return;
      }

      data.prs.forEach(pr => {
        const item = document.createElement('div');
        item.className = 'list-item';
        const reviewRequested = pr.reviewRequests && pr.reviewRequests.length > 0;
        const statusBadge = reviewRequested
          ? `<span class="badge badge-orange">Review Requested</span>`
          : `<span class="badge badge-blue">Open</span>`;

        item.innerHTML = `
          <div class="item-left">
            <a href="${pr.url}" target="_blank" class="item-title">#${pr.number} ${pr.title} 🔗</a>
            <div class="item-subtitle">Created by @${pr.author.login} • ${new Date(pr.createdAt).toLocaleDateString()}</div>
          </div>
          ${statusBadge}
        `;
        prListContainer.appendChild(item);
      });

    } catch (err) {
      prListContainer.innerHTML = `<div class="error-message"><strong>GitHub PRs Fetch Failed:</strong><span>${err.message}</span></div>`;
    }
  }

  // 7. Issues Functionality
  issueRepoSelector.addEventListener('change', loadIssues);

  async function loadIssues() {
    const selectedOption = issueRepoSelector.options[issueRepoSelector.selectedIndex];
    
    if (!selectedOption || !selectedOption.value) {
      loadRecentOverview();
      return;
    }

    const owner = selectedOption.dataset.owner;
    const name = selectedOption.dataset.name;

    issueListContainer.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <span>Retrieving GitHub issues list...</span>
      </div>
    `;

    try {
      const res = await fetch(`/api/issues?owner=${owner}&name=${name}`);
      const data = await res.json();
      issueListContainer.innerHTML = '';

      if (data.error) throw new Error(data.details || data.error);

      if (data.issues.length === 0) {
        issueListContainer.innerHTML = '<div style="color:var(--text-muted); padding: 1.5rem 0;">No open issues found.</div>';
        return;
      }

      data.issues.forEach(issue => {
        const item = document.createElement('div');
        item.className = 'list-item';
        const labelsHtml = issue.labels.map(l => 
          `<span class="badge" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); text-transform:none; margin-left:5px;">${l.name}</span>`
        ).join('');

        item.innerHTML = `
          <div class="item-left">
            <a href="${issue.url}" target="_blank" class="item-title">#${issue.number} ${issue.title} 🔗</a>
            <div class="item-subtitle">Opened by @${issue.author.login} • ${new Date(issue.createdAt).toLocaleDateString()}</div>
          </div>
          <div>${labelsHtml}</div>
        `;
        issueListContainer.appendChild(item);
      });

    } catch (err) {
      issueListContainer.innerHTML = `<div class="error-message"><strong>GitHub Issues Fetch Failed:</strong><span>${err.message}</span></div>`;
    }
  }

  // Fetch and display global recents
  async function loadRecentOverview() {
    const onPrTab = document.querySelector('.menu-item[data-tab="pr-reviews"]').classList.contains('active');
    const onIssueTab = document.querySelector('.menu-item[data-tab="issues"]').classList.contains('active');

    if (onPrTab) {
      prListContainer.innerHTML = `
        <div class="loading-spinner">
          <div class="spinner"></div>
          <span>Retrieving recent pull requests across all repositories...</span>
        </div>
      `;
    }
    if (onIssueTab) {
      issueListContainer.innerHTML = `
        <div class="loading-spinner">
          <div class="spinner"></div>
          <span>Retrieving recent issues across all repositories...</span>
        </div>
      `;
    }

    try {
      const res = await fetch('/api/recents');
      const data = await res.json();

      if (onPrTab) {
        prListContainer.innerHTML = '';
        if (data.prs.length === 0) {
          prListContainer.innerHTML = '<div style="color:var(--text-muted); padding: 1.5rem 0;">No active recent PR reviews found.</div>';
        } else {
          data.prs.forEach(pr => {
            const item = document.createElement('div');
            item.className = 'list-item';
            const repoName = pr.repository ? pr.repository.name : 'Unknown';
            item.innerHTML = `
              <div class="item-left">
                <a href="${pr.url}" target="_blank" class="item-title">[${repoName}] #${pr.number} ${pr.title} 🔗</a>
                <div class="item-subtitle">Created by @${pr.author.login} • ${new Date(pr.createdAt).toLocaleDateString()}</div>
              </div>
              <span class="badge badge-blue">Recent Review</span>
            `;
            prListContainer.appendChild(item);
          });
        }
      }

      if (onIssueTab) {
        issueListContainer.innerHTML = '';
        if (data.issues.length === 0) {
          issueListContainer.innerHTML = '<div style="color:var(--text-muted); padding: 1.5rem 0;">No open recent issues found.</div>';
        } else {
          data.issues.forEach(issue => {
            const item = document.createElement('div');
            item.className = 'list-item';
            const repoName = issue.repository ? issue.repository.name : 'Unknown';
            item.innerHTML = `
              <div class="item-left">
                <a href="${issue.url}" target="_blank" class="item-title">[${repoName}] #${issue.number} ${issue.title} 🔗</a>
                <div class="item-subtitle">Opened • ${new Date(issue.createdAt).toLocaleDateString()}</div>
              </div>
            `;
            issueListContainer.appendChild(item);
          });
        }
      }

    } catch (err) {
      const errorHtml = `<div class="error-message"><strong>Global Recents Load Failed:</strong><span>${err.message}</span></div>`;
      if (onPrTab) prListContainer.innerHTML = errorHtml;
      if (onIssueTab) issueListContainer.innerHTML = errorHtml;
    }
  }

  // 8. Fix Builds
  buildRepoSelector.addEventListener('change', updateBuildScripts);

  function updateBuildScripts() {
    const selectedPath = buildRepoSelector.value;
    const repo = repos.find(r => r.path === selectedPath);
    
    buildScriptSelector.innerHTML = '';
    
    if (repo && repo.buildScripts && repo.buildScripts.length > 0) {
      repo.buildScripts.forEach(script => {
        buildScriptSelector.add(new Option(script, script));
      });
    } else {
      buildScriptSelector.add(new Option('build', 'build'));
    }
  }

  runBuildBtn.addEventListener('click', () => {
    if (currentEventSource) {
      currentEventSource.close();
      currentEventSource = null;
      runBuildBtn.innerText = '🚀 Run Task';
      runBuildBtn.classList.remove('btn-secondary');
      terminalStatus.innerText = 'Task Aborted';
      terminalConsole.innerHTML += '\n\n[SYSTEM] Task execution terminated by user.\n';
      return;
    }

    const path = buildRepoSelector.value;
    const script = buildScriptSelector.value;

    if (!path) {
      alert('Please select a local repository.');
      return;
    }

    terminalConsole.innerHTML = '';
    terminalStatus.innerText = 'Running...';
    runBuildBtn.innerText = '🛑 Stop Task';
    runBuildBtn.classList.add('btn-secondary');

    const sseUrl = `/api/build/run?path=${encodeURIComponent(path)}&script=${encodeURIComponent(script)}`;
    currentEventSource = new EventSource(sseUrl);

    currentEventSource.onmessage = (event) => {
      const sseData = JSON.parse(event.data);
      
      if (sseData.log) {
        terminalConsole.innerHTML += escapeHtml(sseData.log);
        terminalConsole.scrollTop = terminalConsole.scrollHeight;
      }
      
      if (sseData.done) {
        currentEventSource.close();
        currentEventSource = null;
        runBuildBtn.innerText = '🚀 Run Task';
        runBuildBtn.classList.remove('btn-secondary');
        terminalStatus.innerText = `Finished (Code: ${sseData.exitCode})`;
        terminalConsole.innerHTML += `\n\n[SYSTEM] Build process exited with code ${sseData.exitCode}\n`;
      }
    };

    currentEventSource.onerror = (err) => {
      console.error(err);
      terminalConsole.innerHTML += '\n[SYSTEM ERROR] Connection to server lost.\n';
      terminalStatus.innerText = 'Connection Error';
      if (currentEventSource) {
        currentEventSource.close();
        currentEventSource = null;
      }
      runBuildBtn.innerText = '🚀 Run Task';
      runBuildBtn.classList.remove('btn-secondary');
    };
  });

  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  async function loadRemoteDirectory(dirPath, owner, name) {
    const explorerList = document.getElementById('remoteExplorerList');
    const breadcrumb = document.getElementById('breadcrumbPath');
    if (!explorerList) return;

    explorerList.innerHTML = '<div style="color:var(--text-muted); padding:8px;">Loading files...</div>';
    
    // Update breadcrumbs
    const parts = dirPath.split('/').filter(Boolean);
    let breadcrumbHtml = `<span class="breadcrumb-link" data-path="" style="cursor:pointer; color:var(--primary); font-weight:600;">root</span>`;
    let currentAccumulated = '';
    parts.forEach((p, idx) => {
      currentAccumulated += (idx === 0 ? '' : '/') + p;
      breadcrumbHtml += `<span>/</span><span class="breadcrumb-link" data-path="${currentAccumulated}" style="cursor:pointer; color:var(--primary); font-weight:600;">${p}</span>`;
    });
    breadcrumb.innerHTML = breadcrumbHtml;

    // Wire breadcrumb clicks
    document.querySelectorAll('.breadcrumb-link').forEach(link => {
      link.addEventListener('click', () => {
        loadRemoteDirectory(link.dataset.path, owner, name);
      });
    });

    try {
      const res = await fetch(`/api/focus/contents?owner=${owner}&name=${name}&path=${encodeURIComponent(dirPath)}`);
      const items = await res.json();
      explorerList.innerHTML = '';

      if (items.error) {
        explorerList.innerHTML = `<div style="color:var(--error); padding:8px;">Error: ${items.error}</div>`;
        return;
      }

      if (Array.isArray(items)) {
        // Sort: directories first, then files
        items.sort((a, b) => (b.type === 'dir') - (a.type === 'dir'));

        items.forEach(item => {
          const div = document.createElement('div');
          div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:6px; cursor:pointer; border-radius:4px; transition: background 0.2s;';
          div.addEventListener('mouseenter', () => div.style.background = 'rgba(255,255,255,0.03)');
          div.addEventListener('mouseleave', () => div.style.background = 'transparent');

          const icon = item.type === 'dir' ? '📁' : '📄';
          div.innerHTML = `<span style="text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${icon} ${item.name}</span>`;

          div.addEventListener('click', () => {
            if (item.type === 'dir') {
              loadRemoteDirectory(item.path, owner, name);
            } else {
              loadRemoteFile(item.path, owner, name);
            }
          });

          explorerList.appendChild(div);
        });
      }
    } catch (err) {
      explorerList.innerHTML = `<div style="color:var(--error); padding:8px;">Fetch failed.</div>`;
    }
  }

  async function loadRemoteFile(filePath, owner, name) {
    const fileViewerCard = document.getElementById('remoteFileViewerCard');
    const fileNameEl = document.getElementById('remoteFileName');
    const fileCodeEl = document.getElementById('remoteFileCode');
    
    if (!fileViewerCard) return;
    
    fileViewerCard.style.display = 'block';
    fileNameEl.innerText = `📄 ${filePath.split('/').pop()}`;
    fileCodeEl.innerText = 'Loading file contents...';

    try {
      const res = await fetch(`/api/focus/contents?owner=${owner}&name=${name}&path=${encodeURIComponent(filePath)}`);
      const fileData = await res.json();

      if (fileData.error) {
        fileCodeEl.innerText = `Error: ${fileData.error}`;
        return;
      }

      if (fileData.decodedContent !== undefined) {
        fileCodeEl.innerText = fileData.decodedContent;
      } else {
        fileCodeEl.innerText = 'File content cannot be displayed (binary or too large).';
      }

      // Wire close button
      document.getElementById('closeFileViewerBtn').onclick = () => {
        fileViewerCard.style.display = 'none';
      };

    } catch (err) {
      fileCodeEl.innerText = 'Failed to fetch file contents.';
    }
  }

  // Load everything initial
  loadRepos();
});
