const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 4000;
const CONFIG_FILE = path.join(__dirname, 'config.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper: Read configuration
function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return { repos: [], focusProject: '' };
    }
    const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    if (!data.repos) data.repos = [];
    if (!data.focusProject) data.focusProject = '';
    return data;
  } catch (err) {
    console.error('Error reading config:', err);
    return { repos: [], focusProject: '' };
  }
}

// Helper: Write configuration
function writeConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing config:', err);
    return false;
  }
}

// Helper: Run command async
function runCmd(command, cwd) {
  return new Promise((resolve) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      resolve({
        success: !error,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code: error ? error.code : 0
      });
    });
  });
}

// Auto-detect GitHub Owner and Repo name from local git remote origin
async function getRepoInfoFromGit(repoPath) {
  const remoteResult = await runCmd('git remote get-url origin', repoPath);
  if (remoteResult.success) {
    const url = remoteResult.stdout;
    const match = url.match(/github\.com[:/]([^/]+)\/([^.]+)(?:\.git)?/);
    if (match) {
      return { owner: match[1], name: match[2] };
    }
  }
  return { owner: '', name: path.basename(repoPath) };
}

// 1. Get Configured Repositories
app.get('/api/repos', async (req, res) => {
  const config = readConfig();
  const updatedRepos = [];

  for (const repo of config.repos) {
    const isLocal = !!repo.path;
    let exists = true;
    let branch = 'main';
    let owner = repo.owner;
    let name = repo.name;
    let buildScripts = [];

    if (isLocal) {
      const absolutePath = path.resolve(repo.path);
      exists = fs.existsSync(absolutePath);
      
      if (exists) {
        const branchResult = await runCmd('git branch --show-current', absolutePath);
        if (branchResult.success) {
          branch = branchResult.stdout;
        }
        
        if (!owner) {
          const info = await getRepoInfoFromGit(absolutePath);
          owner = info.owner;
          name = info.name;
        }

        const pkgPath = path.join(absolutePath, 'package.json');
        if (fs.existsSync(pkgPath)) {
          try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            if (pkg.scripts) {
              buildScripts = Object.keys(pkg.scripts);
            }
          } catch (e) {}
        }
      }
    }

    updatedRepos.push({
      ...repo,
      name,
      owner,
      type: isLocal ? 'local' : 'web',
      exists,
      branch,
      buildScripts,
      isMajorProject: !!repo.isMajorProject
    });
  }

  res.json({ repos: updatedRepos, focusProject: config.focusProject || '' });
});

// Add/Update Repository
app.post('/api/repos', async (req, res) => {
  const { path: repoPath, owner, name, isMajorProject } = req.body;
  if (!repoPath) {
    return res.status(400).json({ error: 'Repository path or owner/repo string is required.' });
  }

  const config = readConfig();
  let repoData = {};

  // Check if it's a web repo (e.g. owner/name format)
  const isWebFormat = repoPath.includes('/') && !repoPath.startsWith('/') && !repoPath.includes('\\') && !repoPath.includes(':');
  
  if (isWebFormat) {
    const [wOwner, wName] = repoPath.split('/');
    if (!wOwner || !wName) {
      return res.status(400).json({ error: 'Invalid web repository format. Use owner/name' });
    }
    
    // Check if duplicate web repo exists
    let existingIndex = config.repos.findIndex(r => !r.path && r.owner.toLowerCase() === wOwner.toLowerCase() && r.name.toLowerCase() === wName.toLowerCase());
    
    repoData = {
      name: wName,
      owner: wOwner,
      path: '',
      isMajorProject: isMajorProject !== undefined ? !!isMajorProject : false
    };

    if (existingIndex > -1) {
      config.repos[existingIndex] = { ...config.repos[existingIndex], ...repoData };
    } else {
      config.repos.push(repoData);
    }
  } else {
    // Local directory repo
    const absolutePath = path.resolve(repoPath);
    if (!fs.existsSync(absolutePath)) {
      return res.status(400).json({ error: `Path does not exist: ${absolutePath}` });
    }

    let existingIndex = config.repos.findIndex(r => r.path && path.resolve(r.path) === absolutePath);
    let detectedInfo = { owner: owner || '', name: name || '' };
    if (!owner || !name) {
      detectedInfo = await getRepoInfoFromGit(absolutePath);
    }

    repoData = {
      name: name || detectedInfo.name || path.basename(absolutePath),
      owner: owner || detectedInfo.owner || '',
      path: absolutePath,
      isMajorProject: isMajorProject !== undefined ? !!isMajorProject : false
    };

    if (existingIndex > -1) {
      config.repos[existingIndex] = { ...config.repos[existingIndex], ...repoData };
    } else {
      config.repos.push(repoData);
    }
  }

  if (writeConfig(config)) {
    res.json({ success: true, repo: repoData });
  } else {
    res.status(500).json({ error: 'Failed to save config.' });
  }
});

// Toggle Major Project Status
app.post('/api/repos/toggle-major', (req, res) => {
  const { path: repoPath, owner, name } = req.body;
  const config = readConfig();
  
  let index = -1;
  if (repoPath && repoPath.trim() !== '') {
    const absolutePath = path.resolve(repoPath);
    index = config.repos.findIndex(r => r.path && path.resolve(r.path) === absolutePath);
  } else if (owner && name) {
    index = config.repos.findIndex(r => !r.path && r.owner.toLowerCase() === owner.toLowerCase() && r.name.toLowerCase() === name.toLowerCase());
  }

  if (index === -1) return res.status(404).json({ error: 'Repo not found' });

  config.repos[index].isMajorProject = !config.repos[index].isMajorProject;
  writeConfig(config);
  res.json({ success: true, repo: config.repos[index] });
});

// Set Focus Project
app.post('/api/repos/set-focus', (req, res) => {
  const { path: repoPath, owner, name } = req.body;
  const config = readConfig();
  
  if (repoPath && repoPath.trim() !== '') {
    config.focusProject = path.resolve(repoPath);
  } else if (owner && name) {
    config.focusProject = `${owner}/${name}`;
  } else {
    config.focusProject = '';
  }
  
  writeConfig(config);
  res.json({ success: true, focusProject: config.focusProject });
});

// Delete Repository
app.delete('/api/repos', (req, res) => {
  const { path: repoPath, owner, name } = req.body;
  const config = readConfig();
  let filtered = [];

  if (repoPath && repoPath.trim() !== '') {
    const absolutePath = path.resolve(repoPath);
    filtered = config.repos.filter(r => !r.path || path.resolve(r.path) !== absolutePath);
    if (config.focusProject === absolutePath) {
      config.focusProject = '';
    }
  } else if (owner && name) {
    filtered = config.repos.filter(r => r.path || r.owner.toLowerCase() !== owner.toLowerCase() || r.name.toLowerCase() !== name.toLowerCase());
    if (config.focusProject === `${owner}/${name}`) {
      config.focusProject = '';
    }
  }

  if (config.repos.length === filtered.length) {
    return res.status(404).json({ error: 'Repository not found in config.' });
  }

  config.repos = filtered;
  if (writeConfig(config)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to update config.' });
  }
});

// Project Details — partitions issues into features, bugs, general, and fetches PRs
app.get('/api/projects/details', async (req, res) => {
  const { owner, name } = req.query;
  if (!owner || !name) {
    return res.status(400).json({ error: 'owner and name are required.' });
  }

  let issues = [], prs = [], lastTag = 'N/A';

  const issuesRes = await runCmd(`gh issue list --repo "${owner}/${name}" --json number,title,author,url,createdAt,labels --limit 50`);
  if (issuesRes.success && issuesRes.stdout) {
    try { issues = JSON.parse(issuesRes.stdout); } catch (e) {}
  }

  const prsRes = await runCmd(`gh pr list --repo "${owner}/${name}" --json number,title,author,url,createdAt,reviewRequests,reviewDecision --limit 30`);
  if (prsRes.success && prsRes.stdout) {
    try { prs = JSON.parse(prsRes.stdout); } catch (e) {}
  }

  const tagRes = await runCmd(`gh api repos/${owner}/${name}/releases/latest --jq .tag_name`);
  if (tagRes.success && tagRes.stdout) lastTag = tagRes.stdout;

  const features = issues.filter(i => i.labels.some(l => /feature|enhancement/i.test(l.name)));
  const bugs     = issues.filter(i => i.labels.some(l => /bug|error|defect/i.test(l.name)));
  const roadmapIssues = issues.filter(i => i.labels.some(l => /roadmap/i.test(l.name)));
  const general  = issues.filter(i =>
    !i.labels.some(l => /feature|enhancement|bug|error|defect|roadmap/i.test(l.name))
  );

  res.json({ features, bugs, general, prs, lastTag, roadmapIssues });
});

// Get Roadmap — find the roadmap issue and parse its body as a task list
app.get('/api/roadmap', async (req, res) => {
  const { owner, name } = req.query;
  if (!owner || !name) return res.status(400).json({ error: 'owner and name are required.' });

  const result = await runCmd(`gh issue list --repo "${owner}/${name}" --label "roadmap" --json number,title,body --limit 1`);
  if (!result.success || !result.stdout) {
    return res.json({ issue: null, tasks: [] });
  }

  let issues = [];
  try { issues = JSON.parse(result.stdout); } catch (e) {}

  if (issues.length === 0) return res.json({ issue: null, tasks: [] });

  const issue = issues[0];
  const body = issue.body || '';

  // Parse markdown task list items: - [ ] text or - [x] text
  const tasks = [];
  const regex = /^- \[([ xX])\] (.+)$/gm;
  let match;
  while ((match = regex.exec(body)) !== null) {
    tasks.push({ done: match[1].toLowerCase() === 'x', text: match[2].trim() });
  }

  res.json({ issue: { number: issue.number, title: issue.title, url: `https://github.com/${owner}/${name}/issues/${issue.number}` }, tasks });
});

// Add Roadmap item — append a new task to the roadmap issue (creating it if needed)
app.post('/api/roadmap/add', async (req, res) => {
  const { owner, name, task } = req.body;
  if (!owner || !name || !task) return res.status(400).json({ error: 'owner, name, and task are required.' });

  // Find existing roadmap issue
  const listRes = await runCmd(`gh issue list --repo "${owner}/${name}" --label "roadmap" --json number,body --limit 1`);
  let issueNumber = null;
  let currentBody = `## 🗺️ Project Roadmap\n\n`;

  if (listRes.success && listRes.stdout) {
    try {
      const existing = JSON.parse(listRes.stdout);
      if (existing.length > 0) {
        issueNumber = existing[0].number;
        currentBody = existing[0].body || currentBody;
      }
    } catch (e) {}
  }

  const newBody = currentBody.trimEnd() + `\n- [ ] ${task}`;

  if (issueNumber) {
    // Edit existing issue
    const editRes = await runCmd(`gh issue edit ${issueNumber} --repo "${owner}/${name}" --body ${JSON.stringify(newBody)}`);
    if (!editRes.success) return res.status(500).json({ error: 'Failed to update roadmap issue.', details: editRes.stderr });
    res.json({ success: true, issueNumber, message: 'Task appended to roadmap issue.' });
  } else {
    // Ensure the 'roadmap' label exists on the repo before creating the issue
    const labelCheck = await runCmd(`gh label list --repo "${owner}/${name}" --json name`);
    let labelExists = false;
    if (labelCheck.success && labelCheck.stdout) {
      try {
        const labels = JSON.parse(labelCheck.stdout);
        labelExists = labels.some(l => l.name.toLowerCase() === 'roadmap');
      } catch (e) {}
    }

    if (!labelExists) {
      await runCmd(`gh label create "roadmap" --repo "${owner}/${name}" --description "Project roadmap tracking" --color "0075ca"`);
    }

    // Create new roadmap issue
    const createRes = await runCmd(`gh issue create --repo "${owner}/${name}" --title "Project Roadmap" --body ${JSON.stringify(newBody)} --label "roadmap"`);
    if (!createRes.success) return res.status(500).json({ error: 'Failed to create roadmap issue.', details: createRes.stderr });
    res.json({ success: true, message: 'Roadmap issue created with first task.' });
  }
});

// 2. Cut Release info
app.get('/api/releases', async (req, res) => {
  const config = readConfig();
  const releaseInfo = [];

  for (const repo of config.repos) {
    const isLocal = !!repo.path;
    let lastTag = '';
    let commitsSince = [];
    let requiresRelease = false;

    if (isLocal) {
      const absolutePath = path.resolve(repo.path);
      if (!fs.existsSync(absolutePath)) continue;

      const tagResult = await runCmd('git describe --tags --abbrev=0', absolutePath);
      if (tagResult.success) {
        lastTag = tagResult.stdout;
        const logResult = await runCmd(`git log ${lastTag}..HEAD --oneline`, absolutePath);
        if (logResult.success && logResult.stdout) {
          commitsSince = logResult.stdout.split('\n').filter(Boolean);
          requiresRelease = commitsSince.length > 0;
        }
      } else {
        const logResult = await runCmd('git log -n 20 --oneline', absolutePath);
        if (logResult.success && logResult.stdout) {
          commitsSince = logResult.stdout.split('\n').filter(Boolean);
          requiresRelease = commitsSince.length > 0;
        }
      }
    } else {
      // Remote web-only repository tags check
      if (repo.owner && repo.name) {
        const tagResult = await runCmd(`gh api repos/${repo.owner}/${repo.name}/releases/latest --jq .tag_name`);
        if (tagResult.success && tagResult.stdout) {
          lastTag = tagResult.stdout;
          
          // Get recent commits remotely
          const commitsResult = await runCmd(`gh api repos/${repo.owner}/${repo.name}/commits --limit 10 --jq ".[].commit.message"`);
          if (commitsResult.success && commitsResult.stdout) {
            commitsSince = commitsResult.stdout.split('\n').filter(Boolean);
            requiresRelease = true; // Set release status check
          }
        } else {
          lastTag = 'No release tags';
          const commitsResult = await runCmd(`gh api repos/${repo.owner}/${repo.name}/commits --limit 10 --jq ".[].commit.message"`);
          if (commitsResult.success && commitsResult.stdout) {
            commitsSince = commitsResult.stdout.split('\n').filter(Boolean);
            requiresRelease = commitsSince.length > 0;
          }
        }
      }
    }

    releaseInfo.push({
      name: repo.name,
      owner: repo.owner,
      path: repo.path || '',
      type: isLocal ? 'local' : 'web',
      lastTag: lastTag || 'No release tags found',
      commitsCount: commitsSince.length,
      commits: commitsSince,
      requiresRelease
    });
  }

  res.json({ releases: releaseInfo });
});

// Trigger release creation
app.post('/api/release/create', async (req, res) => {
  const { path: repoPath, owner, name, tag, notes } = req.body;
  if (!tag) {
    return res.status(400).json({ error: 'Release tag name is required.' });
  }

  if (repoPath) {
    // Local flow
    const absolutePath = path.resolve(repoPath);
    const hasGhResult = await runCmd('which gh', absolutePath);
    if (hasGhResult.success) {
      const ghReleaseResult = await runCmd(`gh release create ${tag} --title "${tag}" --notes "${notes || 'Release ' + tag}"`, absolutePath);
      if (ghReleaseResult.success) {
        return res.json({ success: true, message: 'Release created successfully via GitHub CLI.', details: ghReleaseResult.stdout });
      }
    }

    const tagCmd = await runCmd(`git tag -a ${tag} -m "${notes || 'Release ' + tag}"`, absolutePath);
    if (!tagCmd.success) return res.status(500).json({ error: 'Failed to create tag', details: tagCmd.stderr });

    const pushCmd = await runCmd(`git push origin ${tag}`, absolutePath);
    return res.json({ success: pushCmd.success, message: 'Tag created and pushed', details: pushCmd.stdout || pushCmd.stderr });
  } else if (owner && name) {
    // Remote release flow
    const ghReleaseResult = await runCmd(`gh release create ${tag} --repo "${owner}/${name}" --title "${tag}" --notes "${notes || 'Release ' + tag}"`);
    if (ghReleaseResult.success) {
      return res.json({ success: true, message: 'Remote release created successfully via GitHub CLI.', details: ghReleaseResult.stdout });
    }
    return res.status(500).json({ error: 'Failed to create remote release', details: ghReleaseResult.stderr });
  }

  res.status(400).json({ error: 'Repository information missing.' });
});

// Get global recents
app.get('/api/recents', async (req, res) => {
  const prsCmd = `gh search prs --review-requested=@me --state=open --limit=10 --json number,title,repository,url,createdAt,author`;
  const fallbackPrsCmd = `gh search prs --author=@me --state=open --limit=10 --json number,title,repository,url,createdAt,author`;
  const issuesCmd = `gh search issues --assignee=@me --state=open --limit=10 --json number,title,repository,url,createdAt,labels,state`;
  const fallbackIssuesCmd = `gh search issues --author=@me --state=open --limit=10 --json number,title,repository,url,createdAt,labels,state`;

  let prs = [];
  let issues = [];

  let prResult = await runCmd(prsCmd);
  if (!prResult.success || prResult.stdout === '[]' || !prResult.stdout) {
    prResult = await runCmd(fallbackPrsCmd);
  }
  if (prResult.success && prResult.stdout) {
    try { prs = JSON.parse(prResult.stdout); } catch (e) {}
  }

  let issueResult = await runCmd(issuesCmd);
  if (!issueResult.success || issueResult.stdout === '[]' || !issueResult.stdout) {
    issueResult = await runCmd(fallbackIssuesCmd);
  }
  if (issueResult.success && issueResult.stdout) {
    try { issues = JSON.parse(issueResult.stdout); } catch (e) {}
  }

  res.json({ prs, issues });
});

// PR Reviews list
app.get('/api/prs', async (req, res) => {
  const { owner, name } = req.query;
  if (!owner || !name) {
    return res.status(400).json({ error: 'Repo owner and name are required.' });
  }

  const cmd = `gh pr list --repo "${owner}/${name}" --json number,title,author,url,createdAt,reviewRequests,reviewDecision,mergeable --limit 30`;
  const result = await runCmd(cmd);

  if (result.success) {
    try {
      const prs = JSON.parse(result.stdout);
      res.json({ prs });
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse GitHub CLI output.', details: result.stdout });
    }
  } else {
    res.status(500).json({ error: 'Failed to list pull requests.', details: result.stderr });
  }
});

// Issues list
app.get('/api/issues', async (req, res) => {
  const { owner, name } = req.query;
  if (!owner || !name) {
    return res.status(400).json({ error: 'Repo owner and name are required.' });
  }

  const cmd = `gh issue list --repo "${owner}/${name}" --json number,title,author,url,createdAt,labels,state --limit 30`;
  const result = await runCmd(cmd);

  if (result.success) {
    try {
      const issues = JSON.parse(result.stdout);
      res.json({ issues });
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse GitHub CLI output.', details: result.stdout });
    }
  } else {
    res.status(500).json({ error: 'Failed to list issues.', details: result.stderr });
  }
});

// Focus Area Details API
app.get('/api/focus/info', async (req, res) => {
  const config = readConfig();
  if (!config.focusProject) {
    return res.json({ active: false });
  }

  // Find either by path or by owner/name slug
  const repo = config.repos.find(r => {
    if (r.path) {
      return path.resolve(r.path) === path.resolve(config.focusProject);
    } else {
      return `${r.owner}/${r.name}` === config.focusProject;
    }
  });

  if (!repo) {
    return res.json({ active: false });
  }

  const isLocal = !!repo.path;
  let exists = true;
  let owner = repo.owner;
  let name = repo.name;
  let gitBranch = 'main';
  let statusSummary = [];

  if (isLocal) {
    const absolutePath = path.resolve(repo.path);
    exists = fs.existsSync(absolutePath);
    if (exists) {
      const branchRes = await runCmd('git branch --show-current', absolutePath);
      if (branchRes.success) gitBranch = branchRes.stdout;

      if (!owner) {
        const info = await getRepoInfoFromGit(absolutePath);
        owner = info.owner;
        name = info.name;
      }

      const statusRes = await runCmd('git status --short', absolutePath);
      statusSummary = statusRes.success ? statusRes.stdout.split('\n').filter(Boolean) : [];
    }
  }

  let issues = [];
  let prs = [];

  if (owner && name) {
    const issuesRes = await runCmd(`gh issue list --repo "${owner}/${name}" --json number,title,author,url,createdAt,labels --limit 30`);
    if (issuesRes.success) {
      try { issues = JSON.parse(issuesRes.stdout); } catch(e){}
    }

    const prsRes = await runCmd(`gh pr list --repo "${owner}/${name}" --json number,title,author,url,createdAt,reviewRequests --limit 30`);
    if (prsRes.success) {
      try { prs = JSON.parse(prsRes.stdout); } catch(e){}
    }
  }

  res.json({
    active: true,
    exists,
    type: isLocal ? 'local' : 'web',
    repo: { ...repo, owner, name, branch: gitBranch },
    issues,
    prs,
    localStatus: statusSummary
  });
});

// Fetch directory listing or file content from remote repository
app.get('/api/focus/contents', async (req, res) => {
  const { owner, name, path: filePath } = req.query;
  if (!owner || !name) {
    return res.status(400).json({ error: 'Owner and name are required.' });
  }

  const cleanPath = filePath || '';
  const cmd = `gh api repos/${owner}/${name}/contents/${encodeURIComponent(cleanPath)}`;
  const result = await runCmd(cmd);

  if (result.success) {
    try {
      const data = JSON.parse(result.stdout);
      if (!Array.isArray(data) && data.content && data.encoding === 'base64') {
        data.decodedContent = Buffer.from(data.content, 'base64').toString('utf8');
      }
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse API response.', details: result.stdout });
    }
  } else {
    res.status(500).json({ error: 'Failed to fetch repository contents.', details: result.stderr });
  }
});

// Run build and stream logs
app.get('/api/build/run', (req, res) => {
  const { path: repoPath, script } = req.query;
  if (!repoPath) {
    return res.status(400).json({ error: 'Repository path is required.' });
  }

  const absolutePath = path.resolve(repoPath);
  if (!fs.existsSync(absolutePath)) {
    return res.status(404).json({ error: 'Repository path does not exist.' });
  }

  const command = script ? `npm run ${script}` : 'npm run build';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendLog = (data) => {
    res.write(`data: ${JSON.stringify({ log: data })}\n\n`);
  };

  sendLog(`Starting build command: ${command} in ${absolutePath}\n`);

  const [cmd, ...args] = command.split(' ');
  const buildProcess = spawn(cmd, args, { cwd: absolutePath, shell: true });

  buildProcess.stdout.on('data', (data) => {
    sendLog(data.toString());
  });

  buildProcess.stderr.on('data', (data) => {
    sendLog(`[STDERR] ${data.toString()}`);
  });

  buildProcess.on('close', (code) => {
    res.write(`data: ${JSON.stringify({ exitCode: code, done: true })}\n\n`);
    res.end();
  });

  req.on('close', () => {
    buildProcess.kill();
  });
});

app.listen(PORT, () => {
  console.log(`Stitch GitHub Manager Server running on http://localhost:${PORT}`);
});
