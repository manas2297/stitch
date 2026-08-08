import { useState, useEffect } from 'react';
import { apiFetch } from '../store/useAppStore';
import Roadmap from './Roadmap';
import IdeasEditor from './IdeasEditor';

const escapeHtml = (text = '') =>
  text.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));

const TABS = [
  { id: 'features', label: '💡 Features' },
  { id: 'bugs', label: '🐛 Bugs' },
  { id: 'reviews', label: '👀 Reviews' },
  { id: 'closed-prs', label: '✅ Closed PRs' },
  { id: 'ideas', label: '🧠 Ideas' },
  { id: 'issues', label: '📋 Issues' },
  { id: 'roadmap', label: '🗺️ Roadmap' },
];

function IssueList({ items, emptyMsg }) {
  if (!items || items.length === 0) {
    return <div style={{ color: 'var(--text-muted)', padding: '1rem 0', fontSize: '0.9rem' }}>{emptyMsg}</div>;
  }
  return items.map((issue) => (
    <div key={issue.number} className="list-item" style={{ marginBottom: 8 }}>
      <div className="item-left">
        <a href={issue.url} target="_blank" rel="noreferrer" className="item-title">
          <span className="pr-number">#{issue.number}</span> <span className="pr-title-text">{issue.title}</span>
        </a>
        <div className="item-subtitle">
          by @{issue.author?.login || '?'} · {new Date(issue.createdAt).toLocaleDateString()}
          {issue.labels.map((l) => (
            <span key={l.name} className="badge" style={{ marginLeft: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', textTransform: 'none' }}>
              {l.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  ));
}

function PRList({ prs }) {
  if (!prs || prs.length === 0) {
    return <div style={{ color: 'var(--text-muted)', padding: '1rem 0', fontSize: '0.9rem' }}>No pull requests found.</div>;
  }
  return prs.map((pr) => {
    let statusBadge = <span className="badge badge-blue">Open</span>;
    if (pr.state === 'MERGED') {
      statusBadge = <span className="badge badge-purple">Merged</span>;
    } else if (pr.state === 'CLOSED') {
      statusBadge = <span className="badge badge-red">Closed</span>;
    } else if (pr.reviewRequests?.length > 0) {
      statusBadge = <span className="badge badge-orange">Review Requested</span>;
    }

    return (
      <div key={pr.number} className="list-item" style={{ marginBottom: 8 }}>
        <div className="item-left">
          <a href={pr.url} target="_blank" rel="noreferrer" className="item-title">
            <span className="pr-number">#{pr.number}</span> <span className="pr-title-text">{pr.title}</span>
          </a>
          <div className="item-subtitle">by @{pr.author?.login || '?'} · {new Date(pr.createdAt).toLocaleDateString()}</div>
        </div>
        {statusBadge}
      </div>
    );
  });
}

export default function ProjectDetail({ repo, onBack }) {
  const [activeInnerTab, setActiveInnerTab] = useState('features');
  const [details, setDetails] = useState(null);
  const [roadmap, setRoadmap] = useState({ tasks: [], issue: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      apiFetch(`/api/projects/details?owner=${repo.owner}&name=${repo.name}`).then((r) => r.json()),
      apiFetch(`/api/roadmap?owner=${repo.owner}&name=${repo.name}`).then((r) => r.json()),
    ])
      .then(([d, rm]) => { setDetails(d); setRoadmap(rm); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [repo.owner, repo.name]);

  if (loading) {
    return (
      <div className="section-content active">
        <div className="loading-spinner"><div className="spinner"></div><span>Loading {repo.name} workspace…</span></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="section-content active">
        <div className="error-message">Failed to load project details: {error}</div>
        <button className="back-btn" onClick={onBack} style={{ marginTop: 16 }}>← Back</button>
      </div>
    );
  }

  const tabCounts = {
    features: details.features.length,
    bugs: details.bugs.length,
    reviews: (details.prs || []).filter((pr) => pr.state === 'OPEN').length,
    'closed-prs': (details.prs || []).filter((pr) => pr.state === 'CLOSED' || pr.state === 'MERGED').length,
    ideas: '✎',
    issues: details.general.length,
    roadmap: roadmap.tasks.length,
  };

  return (
    <div className="section-content active">
      <div className="project-detail-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div>
          <div className="project-detail-title">
            {repo.type === 'local' ? '💻' : '🌐'} {repo.name}
          </div>
          <div className="project-detail-meta">
            <span>{repo.owner}/{repo.name}</span>
            <span>·</span>
            <span>Last release: <strong style={{ color: 'var(--energy-medium)' }}>{details.lastTag}</strong></span>
          </div>
        </div>
        <a
          href={`https://github.com/${repo.owner}/${repo.name}`}
          target="_blank"
          rel="noreferrer"
          className="btn btn-secondary"
          style={{ marginLeft: 'auto' }}
        >
          View on GitHub 🔗
        </a>
      </div>

      <div className="inner-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`inner-tab ${activeInnerTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveInnerTab(tab.id)}
          >
            {tab.label} <span className="tab-count">{tabCounts[tab.id]}</span>
          </button>
        ))}
      </div>

      <div className="inner-tab-panel active">
        {activeInnerTab === 'features' && (
          <IssueList items={details.features} emptyMsg='No feature issues found. Label a GitHub issue with "feature" or "enhancement" to see it here.' />
        )}
        {activeInnerTab === 'bugs' && (
          <IssueList items={details.bugs} emptyMsg="No bug issues found. Great news! 🎉" />
        )}
        {activeInnerTab === 'reviews' && <PRList prs={(details.prs || []).filter((pr) => pr.state === 'OPEN')} />}
        {activeInnerTab === 'closed-prs' && <PRList prs={(details.prs || []).filter((pr) => pr.state === 'CLOSED' || pr.state === 'MERGED')} />}
        {activeInnerTab === 'ideas' && (
          <IdeasEditor owner={repo.owner} name={repo.name} />
        )}
        {activeInnerTab === 'issues' && (
          <IssueList items={details.general} emptyMsg="No general open issues." />
        )}
        {activeInnerTab === 'roadmap' && (
          <Roadmap
            owner={repo.owner}
            name={repo.name}
            initialTasks={roadmap.tasks}
            issue={roadmap.issue}
          />
        )}
      </div>
    </div>
  );
}
