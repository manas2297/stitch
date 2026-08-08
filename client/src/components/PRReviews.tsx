import { useState, useEffect, useMemo } from 'react';
import useAppStore, { apiFetch } from '../store/useAppStore';

function ageBadge(dateStr) {
  const days = (Date.now() - new Date(dateStr)) / 86400000;
  if (days < 2)  return { cls: 'age-fresh',  label: 'Today' };
  if (days < 7)  return { cls: 'age-recent', label: `${Math.floor(days)}d ago` };
  if (days < 30) return { cls: 'age-aging',  label: `${Math.floor(days)}d ago` };
  return           { cls: 'age-stale',  label: `${Math.floor(days / 30)}mo ago` };
}

function SkeletonList() {
  return (
    <div className="skeleton-row">
      {[1,2,3,4,5].map((i) => (
        <div key={i} className="skeleton-item">
          <div className="skeleton skeleton-avatar" />
          <div className="skeleton-lines">
            <div className="skeleton skeleton-line full" />
            <div className="skeleton skeleton-line medium" />
          </div>
          <div className="skeleton skeleton-line short" style={{ width: 60, flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

export default function PRReviews() {
  const repos = useAppStore((s) => s.repos);
  const reposWithRemotes = repos.filter((r) => r.owner && r.name);

  const [selectedRepo, setSelectedRepo] = useState('');
  const [prs, setPrs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  const load = async (value) => {
    setLoading(true);
    setError('');
    setFilter('');
    try {
      let result;
      if (!value) {
        const res = await apiFetch('/api/recents');
        const d = await res.json();
        result = d.prs.map((pr) => ({ ...pr, repoName: pr.repository?.name }));
      } else {
        const [owner, name] = value.split('/');
        const res = await apiFetch(`/api/prs?owner=${owner}&name=${name}`);
        const d = await res.json();
        if (d.error) throw new Error(d.details || d.error);
        result = d.prs;
      }
      setPrs(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(''); }, []);

  const filtered = useMemo(() =>
    filter.trim()
      ? prs.filter((pr) => pr.title.toLowerCase().includes(filter.toLowerCase()) || String(pr.number).includes(filter))
      : prs,
    [prs, filter]
  );

  return (
    <div className="section-content active" id="pr-reviews-section">
      <div className="section-header">
        <div className="section-title">
          <h2>PR Reviews</h2>
          <div className="section-desc">Pull requests requesting attention across your repositories.</div>
        </div>
        <div className="select-wrapper">
          <select className="custom-select" value={selectedRepo} onChange={(e) => { setSelectedRepo(e.target.value); load(e.target.value); }}>
            <option value="">All Repositories (Recent 10)</option>
            {reposWithRemotes.map((r, i) => (
              <option key={i} value={`${r.owner}/${r.name}`}>{r.owner}/{r.name}</option>
            ))}
          </select>
        </div>
      </div>

      {!loading && prs.length > 0 && (
        <div className="filter-bar">
          <div className="filter-input-wrap">
            <span className="filter-icon">🔍</span>
            <input
              type="text"
              className="filter-input"
              placeholder="Filter by title or PR number…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <span className="result-count">{filtered.length} of {prs.length}</span>
        </div>
      )}

      <div className="card-grid">
        {loading && <SkeletonList />}
        {!loading && error && <div className="error-message"><strong>GitHub PRs Fetch Failed:</strong> {error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🎉</div>
            <div className="empty-state-title">{filter ? 'No matching PRs' : 'All clear!'}</div>
            <div className="empty-state-desc">{filter ? 'Try a different search term.' : 'No open pull requests found.'}</div>
          </div>
        )}
        {!loading && filtered.map((pr, i) => {
          const age = ageBadge(pr.createdAt);
          return (
            <div key={i} className="list-item">
              <div className="item-left">
                <a href={pr.url} target="_blank" rel="noreferrer" className="item-title">
                  {pr.repoName && <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>[{pr.repoName}]</span>}
                  #{pr.number} {pr.title} 🔗
                </a>
                <div className="pr-item-meta">
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>@{pr.author?.login}</span>
                  <span className={`age-badge ${age.cls}`}>{age.label}</span>
                </div>
              </div>
              {pr.reviewRequests?.length > 0
                ? <span className="badge badge-orange">Review Requested</span>
                : <span className="badge badge-blue">{pr.repoName ? 'Open' : 'Open'}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
