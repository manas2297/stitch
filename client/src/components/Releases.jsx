import { useState, useEffect } from 'react';
import useAppStore, { apiFetch } from '../store/useAppStore';

function escapeHtml(t = '') {
  return t.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}

export default function Releases() {
  const repos = useAppStore((s) => s.repos);
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { path, owner, name, tag, notes }
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiFetch('/api/releases')
      .then((r) => r.json())
      .then((d) => { setReleases(d.releases); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  const handleRelease = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/release/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: modal.path, owner: modal.owner, name: modal.name, tag: modal.tag, notes: modal.notes }),
      });
      const result = await res.json();
      if (res.ok) {
        alert(result.message || 'Release tag created!');
        setModal(null);
        // reload
        apiFetch('/api/releases').then((r) => r.json()).then((d) => setReleases(d.releases));
      } else {
        alert(`Error: ${result.error || 'Failed to create release'}`);
      }
    } catch {
      alert('Error communicating with server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="section-content active" id="releases-section">
      <div className="section-header">
        <div className="section-title">
          <h2>Cut Releases</h2>
          <div className="section-desc">Manage repository releases, view recent tag states, and check for unreleased changes.</div>
        </div>
      </div>

      <div className="card-grid">
        {loading && <div className="loading-spinner"><div className="spinner"></div><span>Evaluating tag history…</span></div>}
        {error && <div className="error-message">{error}</div>}
        {!loading && releases.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No repositories configured yet.</div>}
        {releases.map((release, i) => {
          const tagBadge = release.requiresRelease
            ? <span className="badge badge-orange">Pending Tag</span>
            : <span className="badge badge-green">Up to Date</span>;
          return (
            <div key={i} className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">{release.name}</div>
                  <div className="card-meta">
                    <span>Tag: <strong>{release.lastTag}</strong></span>
                    <span>•</span>
                    <span>Type: <strong>{release.type}</strong></span>
                  </div>
                </div>
                {tagBadge}
              </div>
              {release.commits.length > 0
                ? <div className="commit-list">{release.commits.map((c, j) => <div key={j} className="commit-item">{escapeHtml(c)}</div>)}</div>
                : <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>All commits are tagged and fully released.</div>}
              {release.requiresRelease && (
                <div className="release-action">
                  <button className="btn" onClick={() => setModal({ path: release.path, owner: release.owner, name: release.name, tag: '', notes: '' })}>
                    🏷️ Cut Release
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Release Modal */}
      {modal && (
        <div className="modal-overlay active">
          <div className="modal">
            <h3>Create Release Tag</h3>
            <form className="modal-form" onSubmit={handleRelease}>
              <div>
                <label>Tag Name (e.g. v1.0.0)</label>
                <input type="text" placeholder="v1.0.0" required value={modal.tag} onChange={(e) => setModal({ ...modal, tag: e.target.value })} />
              </div>
              <div>
                <label>Release Notes</label>
                <textarea rows="6" placeholder="Describe the changes..." required value={modal.notes} onChange={(e) => setModal({ ...modal, notes: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn" disabled={submitting}>{submitting ? 'Publishing…' : 'Publish Release'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
