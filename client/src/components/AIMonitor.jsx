import React, { useState, useEffect } from 'react';
import { apiFetch } from '../store/useAppStore';

const PROVIDERS = [
  { id: 'gemini', label: 'Gemini' },
  { id: 'claude', label: 'Claude' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'cursor', label: 'Cursor' },
];

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default function AIMonitor() {
  const [provider, setProvider] = useState('gemini');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState(null);

  const loadData = async (selectedProvider) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/provider/${selectedProvider}/disk`);
      if (!response.ok) {
        throw new Error(`Failed to load data for ${selectedProvider}`);
      }
      const json = await response.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(provider);
  }, [provider]);

  const handleCleanup = async () => {
    if (!window.confirm(`Are you sure you want to delete all screenshots and recordings in ~/.${provider}?`)) {
      return;
    }
    setCleaning(true);
    try {
      const response = await apiFetch(`/api/provider/${provider}/media`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`Failed to clean up media for ${provider}`);
      }
      const result = await response.json();
      alert(`Cleanup successful! Deleted ${result.deleted} files and freed ${formatBytes(result.freedBytes)}.`);
      // Refresh data
      loadData(provider);
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="ai-monitor-container">
      <header className="monitor-header">
        <div>
          <h1 className="monitor-title">📁 Provider Disk Monitor</h1>
          <p className="monitor-subtitle">
            Monitor and manage disk space usage in your local AI provider directories
          </p>
        </div>
        <div className="monitor-header-actions">
          {data && (
            <div className="update-badge">
              Last scanned: {data.lastUpdated}
            </div>
          )}
          <button 
            className="refresh-btn" 
            onClick={() => loadData(provider)}
            disabled={loading}
          >
            {loading ? '🔄 Scanning...' : '🔄 Update Scan'}
          </button>
        </div>
      </header>

      {/* Provider Selector */}
      <div className="provider-tabs">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            className={`provider-tab ${provider === p.id ? 'active' : ''}`}
            onClick={() => setProvider(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="monitor-error-card">
          <p>⚠️ {error}</p>
          <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', opacity: 0.8 }}>
            (The ~/.{provider} directory might not exist yet)
          </p>
        </div>
      )}

      {data && (
        <div className="dashboard-grid">
          {/* Total Size Stats Card */}
          <div className="monitor-card stats-hero">
            <div>
              <span className="stats-hero-label">Total Folder Size</span>
              <div className="stat-value-large">{formatBytes(data.totalSize)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Target Directory</div>
              <div className="monitor-mono" style={{ marginTop: '0.35rem', display: 'inline-block' }}>
                ~/.{provider}
              </div>
            </div>
          </div>

          {/* Subdirectory Size Breakdown */}
          <div className="monitor-card">
            <h3 className="card-title">📂 Subdirectories</h3>
            <div className="list-container">
              {data.subdirectories.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No subdirectories found.</div>
              )}
              {data.subdirectories
                .sort((a, b) => b.size - a.size)
                .map((subdir) => {
                  const maxSubdirSize = Math.max(...data.subdirectories.map((s) => s.size), 1);
                  const pct = (subdir.size / maxSubdirSize) * 100;
                  return (
                    <div className="monitor-list-item" key={subdir.name}>
                      <div className="monitor-list-item-header">
                        <span className="item-name">{subdir.name}</span>
                        <span className="item-meta">{formatBytes(subdir.size)}</span>
                      </div>
                      <div className="progress-bar-bg">
                        <div className="progress-bar-fill" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* File Types Breakdown */}
          <div className="monitor-card">
            <h3 className="card-title">📄 Media & File Types</h3>
            <div className="list-container">
              {data.fileTypes.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No tracked file types found.</div>
              )}
              {data.fileTypes
                .sort((a, b) => b.size - a.size)
                .filter((type) => type.count > 0 || type.size > 0)
                .map((type) => {
                  const maxTypeSize = Math.max(...data.fileTypes.map((t) => t.size), 1);
                  const pct = (type.size / maxTypeSize) * 100;
                  return (
                    <div className="monitor-list-item" key={type.extension}>
                      <div className="monitor-list-item-header">
                        <span className="item-name">
                          <span className="monitor-mono">.{type.extension}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            ({type.count} files)
                          </span>
                        </span>
                        <span className="item-meta">{formatBytes(type.size)}</span>
                      </div>
                      <div className="progress-bar-bg">
                        <div className="progress-bar-fill accent" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Top Conversations list */}
          <div className="monitor-card table-card">
            <h3 className="card-title">💬 Largest Brain Conversations (Top 10)</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="monitor-table">
                <thead>
                  <tr>
                    <th>Conversation ID</th>
                    <th>Last Active</th>
                    <th style={{ textAlign: 'right' }}>Disk Space</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topConversations && data.topConversations.length > 0 ? (
                    data.topConversations.map((conv) => (
                      <tr key={conv.name}>
                        <td>
                          <span className="monitor-mono" style={{ fontSize: '0.85rem' }}>
                            {conv.name}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {conv.modified || 'Unknown'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 500 }}>
                          {formatBytes(conv.size)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No active conversation directories detected.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cleanup Guide & Shell Commands */}
          <div className="monitor-card table-card">
            <h3 className="card-title">⚡ Quick Storage Actions</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Browser automation recording frames (.webp / .png) and video clips consume the majority of disk space.
            </p>

            <div className="cleanup-box">
              <h4>⚠️ Delete All Screenshots and Recordings</h4>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Removes all WebP, PNG, JPG, WebM, and MP4 files across all saved workspaces for ~/.{provider}. Safe to run at any time.
              </p>
              
              <button 
                className="cleanup-btn" 
                onClick={handleCleanup}
                disabled={cleaning}
              >
                {cleaning ? '🗑️ Cleaning...' : '🗑️ Clean up Media Files'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
