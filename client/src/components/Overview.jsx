import { useState, useEffect } from 'react';
import useAppStore from '../store/useAppStore';

function ageBadge(dateStr) {
  const days = (Date.now() - new Date(dateStr)) / 86400000;
  if (days < 2)  return { cls: 'age-fresh',  label: 'Today' };
  if (days < 7)  return { cls: 'age-recent', label: `${Math.floor(days)}d ago` };
  if (days < 30) return { cls: 'age-aging',  label: `${Math.floor(days)}d ago` };
  return           { cls: 'age-stale',  label: `${Math.floor(days / 30)}mo ago` };
}

function SkeletonList({ rows = 5 }) {
  return (
    <div className="skeleton-row">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-item">
          <div className="skeleton skeleton-avatar" />
          <div className="skeleton-lines">
            <div className="skeleton skeleton-line full" />
            <div className="skeleton skeleton-line medium" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Overview() {
  const repos = useAppStore((s) => s.repos);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/recents')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const majorRepos = repos.filter((r) => r.isMajorProject);
  const localRepos = repos.filter((r) => r.type === 'local');
  const webRepos   = repos.filter((r) => r.type !== 'local');

  return (
    <div className="section-content active" id="overview-section">
      <div className="section-header" style={{ marginBottom: '1.5rem' }}>
        <div className="section-title">
          <h2>Overview</h2>
          <div className="section-desc">Your repository workspace at a glance.</div>
        </div>
      </div>

      {/* Global Stats */}
      <div className="overview-grid">
        <div className="overview-stat-card purple">
          <div className="overview-stat-icon">📦</div>
          <div className="overview-stat-val">{repos.length}</div>
          <div className="overview-stat-label">Total Repos</div>
        </div>
        <div className="overview-stat-card green">
          <div className="overview-stat-icon">⭐</div>
          <div className="overview-stat-val">{majorRepos.length}</div>
          <div className="overview-stat-label">Major Projects</div>
        </div>
        <div className="overview-stat-card blue">
          <div className="overview-stat-icon">👀</div>
          <div className="overview-stat-val">{loading ? '—' : (data?.prs?.length ?? 0)}</div>
          <div className="overview-stat-label">Open PRs</div>
        </div>
        <div className="overview-stat-card orange">
          <div className="overview-stat-icon">🐛</div>
          <div className="overview-stat-val">{loading ? '—' : (data?.issues?.length ?? 0)}</div>
          <div className="overview-stat-label">Open Issues</div>
        </div>
      </div>

      {/* Two column: recent PRs + Issues */}
      <div className="overview-two-col">
        <div className="overview-panel">
          <div className="overview-panel-title">
            <span>👀</span> Recent Pull Requests
          </div>
          {loading ? <SkeletonList rows={4} /> : !data?.prs?.length ? (
            <div className="empty-state">
              <div className="empty-state-icon">🎉</div>
              <div className="empty-state-title">All clear!</div>
              <div className="empty-state-desc">No open pull requests across your repos.</div>
            </div>
          ) : data.prs.slice(0, 6).map((pr, i) => {
            const age = ageBadge(pr.createdAt);
            return (
              <div key={i} className="list-item" style={{ marginBottom: 8 }}>
                <div className="item-left">
                  <a href={pr.url} target="_blank" rel="noreferrer" className="item-title">
                    {pr.repository?.name && <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>[{pr.repository.name}]</span>}
                    #{pr.number} {pr.title}
                  </a>
                  <div className="pr-item-meta">
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>@{pr.author?.login}</span>
                    <span className={`age-badge ${age.cls}`}>{age.label}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="overview-panel">
          <div className="overview-panel-title">
            <span>🐛</span> Recent Issues
          </div>
          {loading ? <SkeletonList rows={4} /> : !data?.issues?.length ? (
            <div className="empty-state">
              <div className="empty-state-icon">✅</div>
              <div className="empty-state-title">No open issues</div>
              <div className="empty-state-desc">Your repos are looking healthy.</div>
            </div>
          ) : data.issues.slice(0, 6).map((issue, i) => {
            const age = ageBadge(issue.createdAt);
            return (
              <div key={i} className="list-item" style={{ marginBottom: 8 }}>
                <div className="item-left">
                  <a href={issue.url} target="_blank" rel="noreferrer" className="item-title">
                    {issue.repository?.name && <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>[{issue.repository.name}]</span>}
                    #{issue.number} {issue.title}
                  </a>
                  <div className="pr-item-meta">
                    <span className={`age-badge ${age.cls}`}>{age.label}</span>
                    {issue.labels?.slice(0, 2).map((l, j) => (
                      <span key={j} className="badge" style={{ fontSize: '0.68rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', textTransform: 'none' }}>{l.name}</span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Repo breakdown */}
      <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="overview-panel">
          <div className="overview-panel-title"><span>💻</span> Local Repos ({localRepos.length})</div>
          {localRepos.length === 0
            ? <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>None added yet.</div>
            : localRepos.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < localRepos.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{r.name}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {r.isMajorProject && <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>⭐</span>}
                  {!r.exists && <span className="badge badge-orange" style={{ fontSize: '0.65rem' }}>Missing</span>}
                </div>
              </div>
            ))}
        </div>
        <div className="overview-panel">
          <div className="overview-panel-title"><span>🌐</span> Web Repos ({webRepos.length})</div>
          {webRepos.length === 0
            ? <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>None added yet.</div>
            : webRepos.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < webRepos.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{r.owner}/{r.name}</span>
                {r.isMajorProject && <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>⭐</span>}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
