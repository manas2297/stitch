import { useState, useEffect } from 'react';
import useAppStore, { apiFetch } from '../store/useAppStore';
import PomodoroTimer from './focus/PomodoroTimer';
import FocusScratchpad from './focus/FocusScratchpad';
import FocusChecklist from './focus/FocusChecklist';
import ArchitectureDiagram from './focus/ArchitectureDiagram';
import { Badge } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';
import {
  Lightbulb,
  GitPullRequest,
  FileCode,
  GitBranch,
  Bot,
  Globe,
  ExternalLink,
  FolderTree,
  Folder,
  FileText,
  Play,
  Target,
} from 'lucide-react';

export default function FocusWorkspace() {
  const { repos, focusProject, setFocusProject } = useAppStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [explorerPath, setExplorerPath] = useState('');
  const [explorerItems, setExplorerItems] = useState<any[]>([]);
  const [fileViewer, setFileViewer] = useState<{ path: string; content: string } | null>(null);
  const [botOutput, setBotOutput] = useState('');
  const [botRunning, setBotRunning] = useState(false);

  useEffect(() => {
    if (!focusProject) {
      setData(null);
      return;
    }
    setLoading(true);
    setError('');
    setExplorerPath('');
    setFileViewer(null);
    apiFetch('/api/focus/info')
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [focusProject]);

  useEffect(() => {
    if (data && data.active && data.type !== 'local') {
      loadDir('');
    }
  }, [data]);

  const loadDir = async (path: string) => {
    if (!data) return;
    setExplorerPath(path);
    setFileViewer(null);
    const res = await apiFetch(
      `/api/focus/contents?owner=${data.repo.owner}&name=${data.repo.name}&path=${encodeURIComponent(path)}`
    );
    const items = await res.json();
    if (Array.isArray(items)) {
      items.sort((a, b) => (b.type === 'dir' ? 1 : 0) - (a.type === 'dir' ? 1 : 0));
      setExplorerItems(items);
    }
  };

  const loadFile = async (path: string) => {
    setFileViewer({ path, content: 'Loading…' });
    const res = await apiFetch(
      `/api/focus/contents?owner=${data.repo.owner}&name=${data.repo.name}&path=${encodeURIComponent(path)}`
    );
    const fd = await res.json();
    setFileViewer({ path, content: fd.decodedContent ?? 'Binary or too large to display.' });
  };

  const runBotAudit = () => {
    setBotOutput('Analyzing repository build… [SSE stream started]\n');
    setBotRunning(true);
    const script = data.repo.buildScripts?.includes('lint')
      ? 'lint'
      : data.repo.buildScripts?.includes('build')
      ? 'build'
      : '';

    const isDesktop = (window as any).go !== undefined || import.meta.env.PROD;
    const baseUrl = isDesktop ? 'http://127.0.0.1:4000' : '';

    const es = new EventSource(
      `${baseUrl}/api/build/run?path=${encodeURIComponent(data.repo.path)}&script=${encodeURIComponent(script)}`
    );
    es.onmessage = (ev) => {
      const d = JSON.parse(ev.data);
      if (d.log) setBotOutput((prev) => prev + d.log);
      if (d.done) {
        es.close();
        setBotRunning(false);
        setBotOutput((prev) => prev + `\n[SYSTEM] Exit code ${d.exitCode}\n`);
      }
    };
    es.onerror = () => {
      es.close();
      setBotRunning(false);
      setBotOutput((prev) => prev + '\n[ERROR] Connection failed.\n');
    };
  };

  const breadcrumbParts = explorerPath.split('/').filter(Boolean);

  if (!focusProject) {
    return (
      <div className="section-content active" id="focus-section">
        <div className="section-header">
          <div className="section-title">
            <h2>Focus Area Workspace</h2>
            <div className="section-desc">Zero in on your active repository context.</div>
          </div>
          <div className="select-wrapper">
            <select
              className="custom-select"
              value={focusProject}
              onChange={(e) => setFocusProject(e.target.value)}
            >
              <option value="">-- Select Active Project --</option>
              {repos.map((repo, i) => {
                const value = repo.path || `${repo.owner}/${repo.name}`;
                return (
                  <option key={i} value={value}>
                    [{repo.type === 'local' ? 'Local' : 'GitHub'}] {repo.name}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
        <EmptyState
          icon={Target}
          title="No Active Project in Focus"
          description="Select a repository from the dropdown above to start working in the Focus Workspace."
        />
      </div>
    );
  }

  return (
    <div className="section-content active" id="focus-section">
      <div className="section-header">
        <div className="section-title">
          <h2>Focus Area Workspace</h2>
          <div className="section-desc">Zero in on your active repository context.</div>
        </div>
        <div className="select-wrapper">
          <select
            className="custom-select"
            value={focusProject}
            onChange={(e) => setFocusProject(e.target.value)}
          >
            <option value="">-- Select Active Project --</option>
            {repos.map((repo, i) => {
              const value = repo.path || `${repo.owner}/${repo.name}`;
              return (
                <option key={i} value={value}>
                  [{repo.type === 'local' ? 'Local' : 'GitHub'}] {repo.name}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {loading && (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <span>Retrieving Workspace Context…</span>
        </div>
      )}
      {error && <div className="error-message">Failed to load focus workspace: {error}</div>}

      {data && data.active && !loading && (() => {
        const isLocal = data.type === 'local';
        const issuesList = Array.isArray(data.issues) ? data.issues : [];
        const features = issuesList.filter((i: any) =>
          i.labels?.some((l: any) => /feature|enhancement/i.test(l.name))
        );
        const prs = Array.isArray(data.prs) ? data.prs : [];

        return (
          <div className="focus-grid">
            <div className="focus-main">
              {/* Features to Work On */}
              <div className="focus-card">
                <h3>
                  <Lightbulb size={18} style={{ color: '#d97706' }} />
                  <span>Features to Work On</span>
                  {features.length > 0 && <Badge variant="orange">{features.length}</Badge>}
                </h3>
                <div style={{ marginTop: 12 }}>
                  {features.length > 0 ? (
                    features.map((f: any) => (
                      <div
                        key={f.number}
                        className="list-item"
                        style={{
                          marginBottom: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                          <span className="issue-number-badge">#{f.number}</span>
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="item-title"
                            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {f.title}
                          </a>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          <span className="item-subtitle" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            by @{f.author?.login}
                          </span>
                          <Badge variant="purple">Feature</Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      icon={Lightbulb}
                      title="No active feature issues"
                      description="Issues labeled 'feature' or 'enhancement' will appear here."
                    />
                  )}
                </div>
              </div>

              {/* Modular Sub-Task Checklist */}
              <FocusChecklist focusProject={focusProject} />

              {/* Modular Architecture Diagramming Canvas */}
              <ArchitectureDiagram focusProject={focusProject} />

              {/* PR Reviews */}
              <div className="focus-card">
                <h3>
                  <GitPullRequest size={18} style={{ color: 'var(--primary)' }} />
                  <span>Pull Request Reviews</span>
                  {prs.length > 0 && <Badge variant="blue">{prs.length}</Badge>}
                </h3>
                <div style={{ marginTop: 12 }}>
                  {prs.length > 0 ? (
                    prs.map((pr: any) => (
                      <div
                        key={pr.number}
                        className="list-item"
                        style={{
                          marginBottom: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                          <span className="pr-number-badge">#{pr.number}</span>
                          <a
                            href={pr.url}
                            target="_blank"
                            rel="noreferrer"
                            className="item-title"
                            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {pr.title}
                          </a>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          <span className="item-subtitle" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            by @{pr.author?.login}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      icon={GitPullRequest}
                      title="No active pull requests"
                      description="Open pull requests will be listed here for quick review."
                    />
                  )}
                </div>
              </div>

              {/* Remote file viewer */}
              {fileViewer && (
                <div className="focus-card" style={{ marginTop: '1.5rem' }}>
                  <h3
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--border-color)',
                      paddingBottom: 8,
                      marginBottom: 12,
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <FileCode size={18} style={{ color: 'var(--primary)' }} />
                      <span>{fileViewer.path.split('/').pop()}</span>
                    </span>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                      onClick={() => setFileViewer(null)}
                    >
                      Close Viewer
                    </button>
                  </h3>
                  <pre
                    style={{
                      margin: 0,
                      background: '#f8fafc',
                      padding: 14,
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                      overflowX: 'auto',
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      maxHeight: 400,
                      color: '#0f172a',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    <code>{fileViewer.content}</code>
                  </pre>
                </div>
              )}
            </div>

            <div className="focus-side">
              {/* Modular Pomodoro Focus Timer */}
              <PomodoroTimer />

              {/* Modular Quick Scratchpad */}
              <FocusScratchpad focusProject={focusProject} />

              {isLocal ? (
                <>
                  <div className="focus-card">
                    <h3>
                      <GitBranch size={18} style={{ color: 'var(--primary)' }} />
                      <span>Local Git State</span>
                    </h3>
                    <div style={{ fontSize: '0.85rem', marginBottom: 12, color: 'var(--text-muted)' }}>
                      Branch: <strong style={{ color: 'var(--text-color)' }}>{data.repo?.branch || 'main'}</strong>
                    </div>
                    {data.localStatus && data.localStatus.length > 0 ? (
                      <div className="git-status-box">
                        {data.localStatus.map((s: string, i: number) => (
                          <div key={i}>{s}</div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Working directory clean.</div>
                    )}
                  </div>
                  <div className="focus-card bot-review-card">
                    <h3>
                      <Bot size={18} style={{ color: 'var(--primary)' }} />
                      <span>Bot Review Diagnostics</span>
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                      Run a local validation script to audit build health.
                    </p>
                    <button
                      className="btn"
                      style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      onClick={runBotAudit}
                      disabled={botRunning}
                    >
                      <Play size={14} />
                      <span>{botRunning ? 'Running…' : 'Run Build Audit'}</span>
                    </button>
                    {botOutput && (
                      <div
                        style={{
                          marginTop: 12,
                          background: '#0f172a',
                          padding: 12,
                          borderRadius: 8,
                          fontFamily: 'monospace',
                          fontSize: '0.78rem',
                          border: '1px solid #1e293b',
                          maxHeight: 200,
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap',
                          color: '#38bdf8',
                        }}
                      >
                        {botOutput}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="focus-card">
                    <h3>
                      <Globe size={18} style={{ color: 'var(--primary)' }} />
                      <span>Remote Repository Context</span>
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      Remote GitHub repository. Local commands are disabled for web projects.
                    </p>
                    <div style={{ marginTop: 12 }}>
                      <a
                        href={`https://github.com/${data.repo.owner}/${data.repo.name}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn"
                        style={{ width: '100%', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                      >
                        <span>View on GitHub</span>
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>

                  <div className="focus-card" style={{ marginTop: '1.5rem' }}>
                    <h3>
                      <FolderTree size={18} style={{ color: 'var(--primary)' }} />
                      <span>Remote File Explorer</span>
                    </h3>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                        marginBottom: 10,
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span
                        style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: 600 }}
                        onClick={() => loadDir('')}
                      >
                        root
                      </span>
                      {breadcrumbParts.map((p, i) => {
                        const accumulated = breadcrumbParts.slice(0, i + 1).join('/');
                        return (
                          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ color: 'var(--border-color)' }}>/</span>
                            <span
                              style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: 600 }}
                              onClick={() => loadDir(accumulated)}
                            >
                              {p}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        maxHeight: 250,
                        overflowY: 'auto',
                        background: '#f8fafc',
                        padding: 8,
                        borderRadius: 8,
                        border: '1px solid var(--border-color)',
                        fontSize: '0.85rem',
                      }}
                    >
                      {explorerItems.map((item, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 10px',
                            cursor: 'pointer',
                            borderRadius: 6,
                            transition: 'background 0.15s ease',
                          }}
                          onClick={() => (item.type === 'dir' ? loadDir(item.path) : loadFile(item.path))}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          {item.type === 'dir' ? (
                            <Folder size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          ) : (
                            <FileText size={15} style={{ color: '#64748b', flexShrink: 0 }} />
                          )}
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {item.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
