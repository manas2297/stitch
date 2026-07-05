import { useState, useEffect } from 'react';
import { useToast } from './Toast';
import { apiFetch } from '../store/useAppStore';

const MISSING_INFO_MAP = {
  go: {
    cmd: "brew install go",
    path: 'export PATH="/opt/homebrew/opt/go/bin:$PATH"\n# Load changes:\nsource ~/.zshrc'
  },
  node: {
    cmd: "brew install node",
    path: 'export PATH="/opt/homebrew/opt/node/bin:$PATH"\n# Load changes:\nsource ~/.zshrc'
  },
  npm: {
    cmd: "brew install node # npm is bundled with Node.js",
    path: 'export PATH="/opt/homebrew/opt/node/bin:$PATH"\n# Load changes:\nsource ~/.zshrc'
  },
  python: {
    cmd: "brew install python",
    path: 'export PATH="/opt/homebrew/opt/python/bin:$PATH"\n# Load changes:\nsource ~/.zshrc'
  },
  postgres: {
    cmd: "brew install postgresql@14\nbrew services start postgresql@14",
    path: 'export PATH="/opt/homebrew/opt/postgresql@14/bin:$PATH"\n# Load changes:\nsource ~/.zshrc'
  },
  mongo: {
    cmd: "brew tap mongodb/brew\nbrew install mongodb-community@6.0\nbrew services start mongodb-community@6.0",
    path: 'export PATH="/opt/homebrew/opt/mongodb-community@6.0/bin:$PATH"\n# Load changes:\nsource ~/.zshrc'
  },
  redis: {
    cmd: "brew install redis\nbrew services start redis",
    path: 'export PATH="/opt/homebrew/opt/redis/bin:$PATH"\n# Load changes:\nsource ~/.zshrc'
  }
};

export default function Profile() {
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form inputs for Git configurations
  const [gitName, setGitName] = useState('');
  const [gitEmail, setGitEmail] = useState('');

  // Selected missing runtime hook at root level
  const [selectedMissing, setSelectedMissing] = useState(null);

  const loadProfile = async () => {
    try {
      const res = await apiFetch('/api/profile');
      const data = await res.json();
      setProfile(data);
      setGitName(data.git?.globalName || '');
      setGitEmail(data.git?.globalEmail || '');
    } catch (err) {
      toast('Failed to load profile details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleUpdateGit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch('/api/profile/git', {
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
        <div className="skeleton skeleton-line full" style={{ height: 24, marginBottom: 12 }} />
        <div className="skeleton skeleton-line medium" style={{ height: 16 }} />
      </div>
    );
  }

  return (
    <div className="section-content active" id="profile-section">
      <div className="section-header" style={{ marginBottom: '2rem' }}>
        <div className="section-title">
          <h2>Developer Profile</h2>
          <div className="section-desc">Manage your Git identity credentials and view system diagnostics.</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Left pane: Github Active Session */}
        <div className="overview-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>🌐 GitHub CLI Session</h3>
          
          {profile?.github?.username ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {profile.github.avatarUrl ? (
                <img 
                  src={profile.github.avatarUrl} 
                  alt="Avatar" 
                  style={{ width: 64, height: 64, borderRadius: '50%', border: '2px solid var(--border-color)' }}
                />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                  👤
                </div>
              )}
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem' }}>@{profile.github.username}</h4>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{profile.github.email || 'No public email configured'}</div>
                <a 
                  href={`https://github.com/${profile.github.username}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  style={{ fontSize: '0.78rem', color: 'var(--primary)', textDecoration: 'none', display: 'inline-block', marginTop: 6 }}
                >
                  View Profile ↗
                </a>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Not authenticated. Run <code>gh auth login</code> inside your terminal to link your GitHub account.
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginTop: 'auto' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Authentication Status
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: profile?.github?.username ? 'var(--success)' : 'var(--danger)' }} />
              <span>{profile?.github?.username ? 'Logged in via Keychain' : 'Logged out'}</span>
            </div>
          </div>
        </div>

        {/* Right pane: Git Global Configuration Configurer */}
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

            <button type="submit" className="btn" style={{ alignSelf: 'flex-start', marginTop: '8px' }} disabled={saving}>
              {saving ? 'Saving...' : 'Update Git Config'}
            </button>
          </form>
        </div>
      </div>

      {/* Diagnostics / Tech Specs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', marginTop: '2rem' }}>
        <div className="overview-panel">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem' }}>💻 Diagnostics</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Git Version</div>
              <strong style={{ fontSize: '0.85rem', color: 'var(--text-color)', marginTop: 2, display: 'block' }}>
                {profile?.diagnostics?.gitVersion || 'Unknown'}
              </strong>
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>GitHub CLI Version</div>
              <strong style={{ fontSize: '0.85rem', color: 'var(--text-color)', marginTop: 2, display: 'block' }}>
                {profile?.diagnostics?.ghVersion || 'Unknown'}
              </strong>
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Operating System</div>
              <strong style={{ fontSize: '0.85rem', color: 'var(--text-color)', marginTop: 2, display: 'block' }}>
                {profile?.diagnostics?.os || 'macOS'}
              </strong>
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Active Shell</div>
              <strong style={{ fontSize: '0.85rem', color: 'var(--text-color)', marginTop: 2, display: 'block' }}>
                {profile?.diagnostics?.shell || 'zsh'}
              </strong>
            </div>
          </div>
        </div>

        <div className="overview-panel">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem' }}>🛠️ Runtimes & Databases</h3>
          
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: selectedMissing ? '1.5rem' : 0 }}>
              {profile?.runtimes && Object.entries(profile.runtimes).map(([key, val]) => {
                const cleanedVal = val.trim();
                const installed = cleanedVal !== '' && cleanedVal !== 'Not Installed';
                const isSelected = selectedMissing === key;

                return (
                  <div 
                    key={key} 
                    style={{ 
                      padding: '10px 14px', 
                      borderRadius: 8, 
                      background: isSelected ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255,255,255,0.01)', 
                      border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: 4,
                      cursor: !installed ? 'pointer' : 'default',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => {
                      if (!installed) {
                        setSelectedMissing(isSelected ? null : key);
                      }
                    }}
                    title={!installed ? "Click to view install guide" : ""}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{key}</span>
                      <span className={`badge ${installed ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.6rem', padding: '1px 5px', textTransform: 'none' }}>
                        {installed ? 'Installed' : 'Missing (Click)'}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'block', marginTop: 2 }}>
                      {installed ? cleanedVal : 'Not Installed'}
                    </span>
                  </div>
                );
              })}
            </div>

            {selectedMissing && MISSING_INFO_MAP[selectedMissing] && (
              <div className="overview-panel" style={{ background: 'rgba(244, 63, 94, 0.03)', border: '1px solid rgba(244, 63, 94, 0.15)', animation: 'fadeIn 0.25s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ margin: 0, textTransform: 'uppercase', fontSize: '0.8rem', color: 'var(--energy-high)', fontWeight: 700 }}>
                    🛠️ Setup Guide: {selectedMissing}
                  </h4>
                  <button 
                    onClick={() => setSelectedMissing(null)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}
                  >
                    ×
                  </button>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>1. Install command (macOS Homebrew)</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <code style={{ flex: 1, background: '#07080d', border: '1px solid var(--border-color)', padding: '6px 10px', borderRadius: 6, fontSize: '0.78rem', color: 'var(--text-color)', fontFamily: 'monospace' }}>
                      {MISSING_INFO_MAP[selectedMissing].cmd}
                    </code>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '6px 10px', fontSize: '0.72rem' }}
                      onClick={() => {
                        navigator.clipboard.writeText(MISSING_INFO_MAP[selectedMissing].cmd);
                        toast('Command copied to clipboard!', 'success');
                      }}
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
                      onClick={() => {
                        navigator.clipboard.writeText(MISSING_INFO_MAP[selectedMissing].path);
                        toast('Path setup copied!', 'success');
                      }}
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
    </div>
  );
}
