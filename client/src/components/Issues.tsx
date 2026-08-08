import { useState, useEffect, useMemo } from 'react';
import useAppStore, { apiFetch } from '../store/useAppStore';

function ageBadge(dateStr) {
  const days = (Date.now() - new Date(dateStr).getTime()) / 86400000;
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
        </div>
      ))}
    </div>
  );
}

export default function Issues() {
  const repos = useAppStore((s) => s.repos);
  const reposWithRemotes = repos.filter((r) => r.owner && r.name);

  const [selectedRepo, setSelectedRepo] = useState('');
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState('');

  const load = async (value) => {
    setLoading(true);
    setError('');
    setFilter('');
    setLabelFilter('');
    try {
      let result;
      if (!value) {
        const res = await apiFetch('/api/recents');
        const d = await res.json();
        result = d.issues.map((i) => ({ ...i, repoName: i.repository?.name }));
      } else {
        const [owner, name] = value.split('/');
        const res = await apiFetch(`/api/issues?owner=${owner}&name=${name}`);
        const d = await res.json();
        if (d.error) throw new Error(d.details || d.error);
        result = d.issues;
      }
      setIssues(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(''); }, []);

  // Collect unique labels across issues
  const allLabels = useMemo(() => {
    const set = new Set();
    issues.forEach((i) => i.labels?.forEach((l) => set.add(l.name)));
    return [...set].sort();
  }, [issues]);

  const filtered = useMemo(() => {
    let result = issues;
    if (filter.trim()) {
      result = result.filter((i) =>
        i.title.toLowerCase().includes(filter.toLowerCase()) || String(i.number).includes(filter)
      );
    }
    if (labelFilter) {
      result = result.filter((i) => i.labels?.some((l) => l.name === labelFilter));
    }
    return result;
  }, [issues, filter, labelFilter]);

  return (
    <div className="section-content active" id="issues-section">
      <div className="section-header">
        <div className="section-title">
          <h2>Open Issues</h2>
          <div className="section-desc">Find outstanding bugs and features to tackle.</div>
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

      {!loading && issues.length > 0 && (
        <div className="filter-bar">
          <div className="filter-input-wrap">
            <span className="filter-icon">🔍</span>
            <input
              type="text"
              className="filter-input"
              placeholder="Filter by title or issue number…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          {allLabels.length > 0 && (
            <select
              className="custom-select"
              style={{ minWidth: 140, fontSize: '0.85rem', padding: '8px 12px' }}
              value={labelFilter}
              onChange={(e) => setLabelFilter(e.target.value)}
            >
              <option value="">All Labels</option>
              {allLabels.map((l) => <option key={l as string} value={l as string}>{l as string}</option>)}
            </select>
          )}
          <span className="result-count">{filtered.length} of {issues.length}</span>
        </div>
      )}

      <div className="card-grid">
        {loading && <SkeletonList />}
        {!loading && error && <div className="error-message"><strong>GitHub Issues Fetch Failed:</strong> {error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <div className="empty-state-title">{filter || labelFilter ? 'No matching issues' : 'No open issues'}</div>
            <div className="empty-state-desc">{filter || labelFilter ? 'Try a different filter.' : 'Your repos are looking healthy!'}</div>
          </div>
        )}
        {!loading && filtered.map((issue, i) => {
          const age = ageBadge(issue.createdAt);
          return (
            <div key={i} className="list-item">
              <div className="item-left">
                <a href={issue.url} target="_blank" rel="noreferrer" className="item-title">
                  {issue.repoName && <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>[{issue.repoName}]</span>}
                  #{issue.number} {issue.title} 🔗
                </a>
                <div className="pr-item-meta">
                  {issue.author && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>@{issue.author.login}</span>}
                  <span className={`age-badge ${age.cls}`}>{age.label}</span>
                  {issue.labels?.map((l, j) => (
                    <span
                      key={String(l.name)}
                      className="badge"
                      style={{ fontSize: '0.68rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', textTransform: 'none', cursor: 'pointer' }}
                      onClick={() => setLabelFilter(l.name === labelFilter ? '' : l.name)}
                    >
                      {String(l.name)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
