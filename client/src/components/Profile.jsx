import { useState, useEffect } from 'react';
import { useToast } from './Toast';
import useAppStore, { apiFetch } from '../store/useAppStore';

const TABS = [
  { id: 'overview',     label: 'Overview' },
  { id: 'repositories', label: 'Repositories' },
  { id: 'focus',        label: 'Focus Area' },
  { id: 'projects',     label: 'Major Projects' },
  { id: 'releases',     label: 'Cut Release' },
  { id: 'pr-reviews',   label: 'PR Reviews' },
  { id: 'issues',       label: 'Issues' },
  { id: 'builds',       label: 'Fix Builds' },
  { id: 'profile',      label: 'Profile' },
];

const MISSING_INFO_MAP = {
  go: {
    cmd: "brew install go",
    path: 'export PATH="/opt/homebrew/opt/go/bin:$PATH"\n# Load changes:\nsource ~/.zshrc',
  },
  node: {
    cmd: "brew install node",
    path: 'export PATH="/opt/homebrew/opt/node/bin:$PATH"\n# Load changes:\nsource ~/.zshrc',
  },
  npm: {
    cmd: "brew install node # npm is bundled with Node.js",
    path: 'export PATH="/opt/homebrew/opt/node/bin:$PATH"\n# Load changes:\nsource ~/.zshrc',
  },
  python: {
    cmd: "brew install python",
    path: 'export PATH="/opt/homebrew/opt/python/bin:$PATH"\n# Load changes:\nsource ~/.zshrc',
  },
  postgres: {
    cmd: "brew install postgresql@14\nbrew services start postgresql@14",
    path: 'export PATH="/opt/homebrew/opt/postgresql@14/bin:$PATH"\n# Load changes:\nsource ~/.zshrc',
  },
  mongo: {
    cmd: "brew tap mongodb/brew\nbrew install mongodb-community@6.0\nbrew services start mongodb-community@6.0",
    path: 'export PATH="/opt/homebrew/opt/mongodb-community@6.0/bin:$PATH"\n# Load changes:\nsource ~/.zshrc',
  },
  redis: {
    cmd: "brew install redis\nbrew services start redis",
    path: 'export PATH="/opt/homebrew/opt/redis/bin:$PATH"\n# Load changes:\nsource ~/.zshrc',
  },
  docker: {
    cmd: "brew install --cask docker",
    path: '# Docker Desktop is installed as a GUI app — no PATH changes needed.\n# Launch Docker.app from Applications after install.',
  },
  brew: {
    cmd: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
    path: 'export PATH="/opt/homebrew/bin:$PATH"\n# Load changes:\nsource ~/.zshrc',
  },
  bun: {
    cmd: "curl -fsSL https://bun.sh/install | bash",
    path: 'export BUN_INSTALL="$HOME/.bun"\nexport PATH="$BUN_INSTALL/bin:$PATH"\n# Load changes:\nsource ~/.zshrc',
  },
  rust: {
    cmd: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh",
    path: 'export PATH="$HOME/.cargo/bin:$PATH"\n# Load changes:\nsource ~/.zshrc',
  },
};

/** Format a GitHub ISO date string to a friendly "Member since YYYY" label. */
function memberSince(isoStr) {
  if (!isoStr) return null;
  const year = new Date(isoStr).getFullYear();
  return isNaN(year) ? null : `Member since ${year}`;
}

export default function Profile() {
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form inputs for Git configurations
  const [gitName, setGitName]   = useState('');
  const [gitEmail, setGitEmail] = useState('');

  // Selected missing runtime hook at root level
  const [selectedMissing, setSelectedMissing] = useState(null);

  // Mode configurations state & actions
  const { tabEnergies, saveTabEnergies } = useAppStore();
  const [localTabEnergies, setLocalTabEnergies] = useState({});
  const [savingModes, setSavingModes] = useState(false);

  useEffect(() => {
    if (tabEnergies) setLocalTabEnergies(tabEnergies);
  }, [tabEnergies]);

  const handleSaveModes = async () => {
    setSavingModes(true);
    const result = await saveTabEnergies(localTabEnergies);
    if (result?.success) {
      toast('Mode configuration saved successfully!', 'success');
    } else {
      toast(`Failed to save configuration: ${result?.error || 'Unknown error'}`, 'error');
    }
    setSavingModes(false);
  };

  const loadProfile = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res  = await apiFetch('/api/profile');
      const data = await res.json();
      setProfile(data);
      setGitName(data.git?.globalName  || '');
      setGitEmail(data.git?.globalEmail || '');
    } catch {
      toast('Failed to load profile details.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadProfile(); }, []);

  const handleUpdateGit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res  = await apiFetch('/api/profile/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: gitName, email: gitEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        toast(data.message || 'Git profile updated!', 'success');
        loadProfile();
      } else {
        toast(data.error || 'Failed to update configurations.', 'error');
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="section-content active">
        <div className="skeleton skeleton-line full"  style={{ height: 24, marginBottom: 12 }} />
        <div className="skeleton skeleton-line medium" style={{ height: 16 }} />
      </div>
    );
  }

  const gh = profile?.github ?? {};
  const since = memberSince(gh.createdAt);

  return (
    <div className="section-content active" id="profile-section">
      <div className="section-header" style={{ marginBottom: '2rem' }}>
        <div className="section-title">
          <h2>Developer Profile</h2>
          <div className="section-desc">Manage your Git identity credentials and view system diagnostics.</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>

        {/* ── GitHub CLI Session ────────────────────────────────────────── */}
        <div className="overview-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>🌐 GitHub CLI Session</h3>

          {gh.username ? (
            <>
              {/* Avatar + name row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                {gh.avatarUrl ? (
                  <img
                    src={gh.avatarUrl}
                    alt="Avatar"
                    style={{ width: 68, height: 68, borderRadius: '50%', border: '2px solid var(--border-color)', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                    👤
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h4 style={{ margin: '0 0 2px', fontSize: '1.05rem' }}>@{gh.username}</h4>
                    {gh.plan && gh.plan !== 'free' && (
                      <span className="badge badge-green" style={{ fontSize: '0.62rem', textTransform: 'capitalize' }}>
                        {gh.plan}
                      </span>
                    )}
                    {gh.sshKeyCount > 0 && (
                      <span className="badge" style={{ fontSize: '0.62rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)' }}>
                        🔑 {gh.sshKeyCount} SSH key{gh.sshKeyCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {gh.email && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 2 }}>{gh.email}</div>
                  )}

                  {gh.bio && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-color)', fontStyle: 'italic', margin: '4px 0', lineHeight: 1.4, maxWidth: 260, wordBreak: 'break-word' }}>
                      {gh.bio}
                    </div>
                  )}

                  {/* Followers / Following */}
                  {(gh.followers > 0 || gh.following > 0) && (
                    <div className="profile-stat-row">
                      <span className="profile-stat-chip">
                        <strong>{gh.followers.toLocaleString()}</strong> followers
                      </span>
                      <span className="profile-stat-chip">
                        <strong>{gh.following.toLocaleString()}</strong> following
                      </span>
                    </div>
                  )}

                  {/* Location / Company / Since */}
                  {(gh.location || gh.company || since) && (
                    <div className="profile-meta-row">
                      {gh.location && <span className="profile-meta-chip">📍 {gh.location}</span>}
                      {gh.company  && <span className="profile-meta-chip">🏢 {gh.company}</span>}
                      {since       && <span className="profile-meta-chip">📅 {since}</span>}
                    </div>
                  )}

                  <a
                    href={`https://github.com/${gh.username}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '0.78rem', color: 'var(--primary)', textDecoration: 'none', display: 'inline-block', marginTop: 8 }}
                  >
                    View Profile ↗
                  </a>
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Not authenticated. Run <code>gh auth login</code> inside your terminal to link your GitHub account.
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginTop: 'auto' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Authentication Status
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: gh.username ? 'var(--success)' : 'var(--error)', flexShrink: 0 }} />
              <span>{gh.username ? 'Logged in via Keychain' : 'Logged out'}</span>
            </div>
          </div>
        </div>

        {/* ── Global Git Identity ───────────────────────────────────────── */}
        <div className="overview-panel">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem' }}>⚙️ Global Git Identity</h3>

          <form onSubmit={handleUpdateGit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Global Username (`user.name`)</label>
              <input
                type="text"
                className="filter-input"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}
                value={gitName}
                onChange={(e) => setGitName(e.target.value)}
                placeholder="John Doe"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Global Email (`user.email`)</label>
              <input
                type="email"
                className="filter-input"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}
                value={gitEmail}
                onChange={(e) => setGitEmail(e.target.value)}
                placeholder="johndoe@example.com"
              />
            </div>

            <button type="submit" className="btn" style={{ alignSelf: 'flex-start', marginTop: 8 }} disabled={saving}>
              {saving ? 'Saving...' : 'Update Git Config'}
            </button>
          </form>

          {/* Email mismatch warning */}
          {profile?.git?.emailMismatch && (
            <div className="identity-warning">
              <span className="identity-warning-icon">⚠️</span>
              <div>
                <strong>Email mismatch detected.</strong> Your GitHub CLI email (<code>{gh.email}</code>) differs from
                your global git email (<code>{profile.git.globalEmail}</code>). Commits may be attributed to the wrong
                account or appear unsigned on GitHub.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Diagnostics / Runtimes ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', marginTop: '2rem' }}>

        {/* Diagnostics panel */}
        <div className="overview-panel">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem' }}>💻 Diagnostics</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { label: 'Git Version',        val: profile?.diagnostics?.gitVersion || 'Unknown' },
              { label: 'GitHub CLI Version', val: profile?.diagnostics?.ghVersion  || 'Unknown' },
              { label: 'Operating System',   val: profile?.diagnostics?.os         || 'Unknown' },
              { label: 'Active Shell',       val: profile?.diagnostics?.shell      || 'Unknown' },
            ].map(({ label, val }) => (
              <div key={label}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{label}</div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-color)', marginTop: 2, display: 'block' }}>
                  {val}
                </strong>
              </div>
            ))}
          </div>
        </div>

        {/* Runtimes & Databases panel */}
        <div className="overview-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>🛠️ Runtimes &amp; Tools</h3>
            <button
              className="btn btn-secondary"
              style={{ padding: '4px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => loadProfile(true)}
              disabled={refreshing}
            >
              {refreshing ? '↻ Refreshing…' : '↻ Refresh'}
            </button>
          </div>

          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: selectedMissing ? '1.5rem' : 0 }}>
              {profile?.runtimes && Object.entries(profile.runtimes).map(([key, val]) => {
                const cleanedVal = val.trim();
                const installed  = cleanedVal !== '' && cleanedVal !== 'Not Installed';
                const isSelected = selectedMissing === key;

                return (
                  <div
                    key={key}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: isSelected ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)',
                      border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      cursor: !installed ? 'pointer' : 'default',
                      transition: 'all 0.2s',
                    }}
                    onClick={() => { if (!installed) setSelectedMissing(isSelected ? null : key); }}
                    title={!installed ? 'Click to view install guide' : ''}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{key}</span>
                      <span className={`badge ${installed ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.6rem', padding: '1px 5px', textTransform: 'none' }}>
                        {installed ? 'Installed' : 'Missing'}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'block', marginTop: 2 }}>
                      {installed ? cleanedVal : 'Click to install →'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Install guide drawer */}
            {selectedMissing && MISSING_INFO_MAP[selectedMissing] && (
              <div className="overview-panel" style={{ background: 'rgba(244,63,94,0.03)', border: '1px solid rgba(244,63,94,0.15)', animation: 'fadeIn 0.25s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ margin: 0, textTransform: 'uppercase', fontSize: '0.8rem', color: 'var(--energy-high)', fontWeight: 700 }}>
                    🛠️ Setup Guide: {selectedMissing}
                  </h4>
                  <button onClick={() => setSelectedMissing(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}>
                    ×
                  </button>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>1. Install command (macOS Homebrew)</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <code style={{ flex: 1, background: '#07080d', border: '1px solid var(--border-color)', padding: '6px 10px', borderRadius: 6, fontSize: '0.78rem', color: 'var(--text-color)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                      {MISSING_INFO_MAP[selectedMissing].cmd}
                    </code>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '6px 10px', fontSize: '0.72rem' }}
                      onClick={() => { navigator.clipboard.writeText(MISSING_INFO_MAP[selectedMissing].cmd); toast('Command copied!', 'success'); }}
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>2. Append to Path (zsh)</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <code style={{ flex: 1, background: '#07080d', border: '1px solid var(--border-color)', padding: '6px 10px', borderRadius: 6, fontSize: '0.78rem', color: 'var(--text-color)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                      {MISSING_INFO_MAP[selectedMissing].path}
                    </code>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '6px 10px', fontSize: '0.72rem' }}
                      onClick={() => { navigator.clipboard.writeText(MISSING_INFO_MAP[selectedMissing].path); toast('Path setup copied!', 'success'); }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Mode Configurations ───────────────────────────────────────────── */}
      <div className="overview-panel" style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>🎯 Section Mode Configuration</h3>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Define which energy mode category each navigation section belongs to.
            </div>
          </div>
          <button onClick={handleSaveModes} className="btn" disabled={savingModes} style={{ padding: '8px 20px', fontSize: '0.85rem' }}>
            {savingModes ? 'Saving...' : 'Save Configurations'}
          </button>
        </div>

        <div className="mode-config-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {Object.entries(localTabEnergies).map(([tabId, currentEnergy]) => {
            const label = TABS.find(t => t.id === tabId)?.label || tabId.charAt(0).toUpperCase() + tabId.slice(1);
            return (
              <div
                key={tabId}
                className="mode-config-card"
                style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, transition: 'all 0.2s' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{label}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID: {tabId}</span>
                </div>
                <select
                  value={currentEnergy}
                  onChange={(e) => setLocalTabEnergies(prev => ({ ...prev, [tabId]: e.target.value }))}
                  className="mode-select-dropdown"
                  style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'var(--text-color)', borderRadius: 8, padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                >
                  <option value="all">All Modes</option>
                  <option value="low">Low Energy</option>
                  <option value="medium">Medium Energy</option>
                  <option value="high">High Energy</option>
                </select>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
