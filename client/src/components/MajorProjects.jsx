import { useState, useEffect } from 'react';
import useAppStore from '../store/useAppStore';
import ProjectDetail from './ProjectDetail';

export default function MajorProjects() {
  const repos = useAppStore((s) => s.repos);
  const [selectedProject, setSelectedProject] = useState(null);
  const [stats, setStats] = useState({});

  const majorRepos = repos.filter((r) => r.isMajorProject);

  // Fetch stats for each major project whenever the list changes
  useEffect(() => {
    majorRepos.forEach((repo) => {
      if (!repo.owner || !repo.name) return;
      const key = `${repo.owner}/${repo.name}`;
      if (stats[key]) return; // already loaded
      fetch(`/api/projects/details?owner=${repo.owner}&name=${repo.name}`)
        .then((r) => r.json())
        .then((d) => setStats((prev) => ({ ...prev, [key]: d })))
        .catch(() => {});
    });
  }, [majorRepos.length]);

  if (selectedProject) {
    return <ProjectDetail repo={selectedProject} onBack={() => setSelectedProject(null)} />;
  }

  return (
    <div className="section-content active" id="projects-section">
      <div className="section-header">
        <div className="section-title">
          <h2>Major Projects</h2>
          <div className="section-desc">Track and prioritize key repositories you've designated as major projects.</div>
        </div>
      </div>

      {majorRepos.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🎯</div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>No Major Projects yet</div>
          <div style={{ fontSize: '0.85rem' }}>
            Click the ☆ star icon next to any repository in the sidebar to track it here.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
          {majorRepos.map((repo) => {
            const key = `${repo.owner}/${repo.name}`;
            const s = stats[key];

            return (
              <div
                key={key}
                className="major-project-card"
                onClick={() => setSelectedProject(repo)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{repo.type === 'local' ? '💻' : '🌐'}</span> {repo.name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      {repo.owner || 'local'}/{repo.name}
                    </div>
                  </div>
                  <span className="badge badge-green">⭐ Major</span>
                </div>

                <div className="project-stats">
                  <div className="stat-pill">
                    <div className="stat-val" style={{ color: '#c084fc' }}>{s ? s.features.length : '—'}</div>
                    <div className="stat-label">Features</div>
                  </div>
                  <div className="stat-pill">
                    <div className="stat-val" style={{ color: 'var(--error)' }}>{s ? s.bugs.length : '—'}</div>
                    <div className="stat-label">Bugs</div>
                  </div>
                  <div className="stat-pill">
                    <div className="stat-val" style={{ color: 'var(--energy-low)' }}>{s ? s.prs.length : '—'}</div>
                    <div className="stat-label">PRs</div>
                  </div>
                  <div className="stat-pill">
                    <div className="stat-val" style={{ color: 'var(--text-muted)' }}>{s ? s.general.length : '—'}</div>
                    <div className="stat-label">Issues</div>
                  </div>
                </div>

                <div className="open-hint">Click to open project workspace →</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
