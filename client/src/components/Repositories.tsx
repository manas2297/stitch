import { useState } from 'react';
import useAppStore from '../store/useAppStore';
import { useToast } from './Toast';
import { ConfirmAlertDialog } from './ui/AlertDialog';
import { Trash2, Star, Crosshair, FolderGit2, Globe } from 'lucide-react';

export default function Repositories() {
  const toast = useToast();
  const repos = useAppStore((s) => s.repos);
  const currentUser = useAppStore((s) => s.currentUser);
  const [repoToDelete, setRepoToDelete] = useState<any | null>(null);

  // Group by owner matches the logged in user
  const myRepos = repos.filter(
    (r) => r.owner && currentUser && r.owner.toLowerCase() === currentUser.toLowerCase()
  );
  const clonedRepos = repos.filter(
    (r) => !r.owner || !currentUser || r.owner.toLowerCase() !== currentUser.toLowerCase()
  );

  return (
    <div className="section-content active" id="repositories-section">
      <div className="section-header" style={{ marginBottom: '1.5rem' }}>
        <div className="section-title">
          <h2>Repositories Manager</h2>
          <div className="section-desc">Add, configure, and manage your tracked local and web projects.</div>
        </div>
      </div>

      {/* Grid of Repository Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {/* Add Repository Tool Card */}
        <div className="overview-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px dashed var(--border-hover)', background: 'transparent', minHeight: 160 }}>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '8px' }}>
              + Add Repository
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1rem' }}>
              Add local folder paths (e.g. <code>/Users/name/repo</code>) or remote targets (e.g. <code>owner/name</code>) to start managing.
            </p>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const input = (e.target as any).elements.repoPathInput;
              const pathVal = input.value.trim();
              if (!pathVal) return;
              try {
                await useAppStore.getState().addRepo(pathVal);
                input.value = '';
                toast('Repository added successfully', 'success');
              } catch (err) {
                toast(err.message, 'error');
              }
            }}
            style={{ display: 'flex', gap: 8 }}
          >
            <input
              name="repoPathInput"
              type="text"
              className="roadmap-input"
              style={{ fontSize: '0.8rem', padding: '8px 12px' }}
              placeholder="Path or owner/repo..."
              required
            />
            <button type="submit" className="btn" style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
              Add
            </button>
          </form>
        </div>

        {/* Owned Repositories */}
        {repos.map((repo, i) => {
          const isLocal = repo.type === 'local';
          const isForkOrCloned = !repo.owner || !currentUser || repo.owner.toLowerCase() !== currentUser.toLowerCase();

          return (
            <div key={i} className="overview-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 160 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: 7, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                    {isLocal ? <FolderGit2 size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} /> : <Globe size={16} style={{ color: '#38bdf8', flexShrink: 0 }} />}
                    <span>{repo.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <span className={`badge ${isForkOrCloned ? 'badge-orange' : 'badge-purple'}`} style={{ fontSize: '0.65rem', textTransform: 'none' }}>
                      {isForkOrCloned ? 'External' : 'My Repo'}
                    </span>
                    {isLocal && !repo.exists && (
                      <span className="badge badge-red" style={{ fontSize: '0.65rem' }}>Missing</span>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: '8px' }}>
                  {isLocal ? repo.path : `${repo.owner}/${repo.name}`}
                </div>

                {isLocal && repo.exists && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Active Branch: <strong style={{ color: 'var(--text-color)' }}>{repo.branch || 'main'}</strong>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyItems: 'space-between', borderTop: '1px solid var(--border-color)', marginTop: 12, paddingTop: 12, gap: 8 }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '6px 10px', fontSize: '0.72rem', flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                  onClick={() => {
                    const value = repo.path || `${repo.owner}/${repo.name}`;
                    useAppStore.getState().setFocusProject(value);
                    useAppStore.getState().setActiveTab('focus');
                    toast(`Focused workspace set to ${repo.name}`, 'info');
                  }}
                >
                  <Crosshair size={12} /> Focus
                </button>

                <button
                  className="btn btn-secondary"
                  style={{
                    padding: '6px 10px', fontSize: '0.72rem',
                    color: repo.isMajorProject ? 'var(--energy-medium)' : 'var(--text-muted)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
                  }}
                  onClick={() => {
                    useAppStore.getState().toggleMajor({ path: repo.path || '', owner: repo.owner || '', name: repo.name || '' });
                    toast(
                      repo.isMajorProject ? `${repo.name} removed from Major Projects` : `${repo.name} added to Major Projects ⭐`,
                      repo.isMajorProject ? 'info' : 'success'
                    );
                  }}
                >
                  <Star size={12} fill={repo.isMajorProject ? 'currentColor' : 'none'} />
                  {repo.isMajorProject ? 'Starred' : 'Star'}
                </button>

                <button
                  className="delete-btn"
                  title="Remove repository"
                  aria-label="Remove repository"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRepoToDelete(repo);
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmAlertDialog
        open={Boolean(repoToDelete)}
        title="Remove Repository"
        description={repoToDelete ? `Are you sure you want to remove "${repoToDelete.name}" from your workspace?` : ''}
        confirmText="Yes, Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={async () => {
          if (!repoToDelete) return;
          const target = repoToDelete;
          setRepoToDelete(null);
          try {
            await useAppStore.getState().deleteRepo({
              path: target.path || '',
              owner: target.owner || '',
              name: target.name || '',
            });
            toast(`Removed ${target.name}`, 'info');
          } catch (err: any) {
            toast(err.message || 'Failed to remove repository', 'error');
          }
        }}
        onCancel={() => setRepoToDelete(null)}
      />
    </div>
  );
}
