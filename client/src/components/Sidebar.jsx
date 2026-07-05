import { useState } from 'react';
import useAppStore from '../store/useAppStore';
import { useToast } from './Toast';

export default function Sidebar({ tabs, visibleTabs }) {
  const { repos, activeTab, setActiveTab, toggleMajor, deleteRepo, addRepo } = useAppStore();
  const toast = useToast();
  const [newRepoPath, setNewRepoPath] = useState('');
  const [adding, setAdding] = useState(false);

  const localRepos = repos.filter((r) => r.type === 'local');
  const webRepos = repos.filter((r) => r.type !== 'local');

  const handleAddRepo = async (e) => {
    e.preventDefault();
    if (!newRepoPath.trim()) return;
    setAdding(true);
    try {
      await addRepo(newRepoPath.trim());
      setNewRepoPath('');
      toast('Repository added successfully', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (e, repo) => {
    e.stopPropagation();
    if (window.confirm(`Remove repository: ${repo.name}?`)) {
      await deleteRepo({ path: repo.path || '', owner: repo.owner || '', name: repo.name || '' });
      toast(`Removed ${repo.name}`, 'info');
    }
  };

  const handleToggleMajor = (e, repo) => {
    e.stopPropagation();
    toggleMajor({ path: repo.path || '', owner: repo.owner || '', name: repo.name || '' });
    toast(
      repo.isMajorProject ? `${repo.name} removed from Major Projects` : `${repo.name} added to Major Projects ⭐`,
      repo.isMajorProject ? 'info' : 'success'
    );
  };

  const RepoItem = ({ repo }) => (
    <div className={`repo-mini-card ${repo.exists ? '' : 'broken'}`} title={repo.type === 'local' ? repo.path : `${repo.owner}/${repo.name}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: '70%', overflow: 'hidden' }}>
        <span style={{ fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {repo.type === 'local' ? '💻' : '🌐'} {repo.name}
        </span>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {repo.type === 'local' ? repo.path : `${repo.owner}/${repo.name}`}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button
          onClick={(e) => handleToggleMajor(e, repo)}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontSize: '1rem',
            color: repo.isMajorProject ? 'var(--energy-medium)' : 'var(--text-muted)',
            transition: 'color 0.2s, transform 0.15s',
            padding: '2px 4px',
            borderRadius: 4,
          }}
          title={repo.isMajorProject ? 'Remove from Major Projects' : 'Add to Major Projects'}
        >
          {repo.isMajorProject ? '★' : '☆'}
        </button>
        <button className="delete-btn" onClick={(e) => handleDelete(e, repo)} title="Remove repo">×</button>
      </div>
    </div>
  );

  return (
    <div className="sidebar">
      {/* Navigation */}
      <ul className="menu-list">
        {visibleTabs.map((tab) => (
          <li
            key={tab.id}
            className={`menu-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="menu-label">
              <span>{tab.icon}</span> {tab.label}
            </span>
            <span className={`menu-badge badge-${tab.energy === 'all' ? 'low' : tab.energy}`}
              style={tab.energy === 'all' ? { background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' } : {}}>
              {tab.energy === 'all' ? 'Home' : tab.energy.charAt(0).toUpperCase() + tab.energy.slice(1)}
            </span>
          </li>
        ))}
      </ul>

      {/* Repo Widget */}
      <div className="repo-widget">
        {/* Local Repos */}
        <div className="repo-section-header">
          <span className="repo-section-title">Local (💻)</span>
          <span className="repo-section-count">{localRepos.length}</span>
        </div>
        <div className="repo-widget-list" style={{ marginBottom: 14 }}>
          {localRepos.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', padding: '4px 0', fontStyle: 'italic' }}>
              No local repos yet
            </div>
          ) : localRepos.map((r, i) => <RepoItem key={i} repo={r} />)}
        </div>

        {/* Web Repos */}
        <div className="repo-section-header">
          <span className="repo-section-title">Web (🌐)</span>
          <span className="repo-section-count">{webRepos.length}</span>
        </div>
        <div className="repo-widget-list" style={{ marginBottom: 14 }}>
          {webRepos.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', padding: '4px 0', fontStyle: 'italic' }}>
              No web repos yet
            </div>
          ) : webRepos.map((r, i) => <RepoItem key={i} repo={r} />)}
        </div>

        {/* Add Repo Form */}
        <form className="repo-form" onSubmit={handleAddRepo}>
          <input
            type="text"
            value={newRepoPath}
            onChange={(e) => setNewRepoPath(e.target.value)}
            placeholder="Local path or owner/repo…"
            disabled={adding}
          />
          <button type="submit" disabled={adding}>
            {adding ? '…' : 'Add'}
          </button>
        </form>
      </div>
    </div>
  );
}
