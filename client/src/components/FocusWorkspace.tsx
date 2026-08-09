import { useState, useEffect } from 'react';
import useAppStore, { apiFetch } from '../store/useAppStore';

export default function FocusWorkspace() {
  const { repos, focusProject, setFocusProject } = useAppStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [explorerPath, setExplorerPath] = useState('');
  const [explorerItems, setExplorerItems] = useState([]);
  const [fileViewer, setFileViewer] = useState(null);
  const [botOutput, setBotOutput] = useState('');
  const [botRunning, setBotRunning] = useState(false);

  // Pomodoro Focus Timer State
  const [timerMode, setTimerMode] = useState('work'); // 'work' | 'shortBreak' | 'longBreak'
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [durations, setDurations] = useState({ work: 25, shortBreak: 5, longBreak: 15 });
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [completedSessions, setCompletedSessions] = useState(() => {
    const saved = localStorage.getItem('stitch_focus_completed_sessions');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Scratchpad State
  const [scratchpadText, setScratchpadText] = useState('');

  // Sub-task Checklist State
  const [tasks, setTasks] = useState<{ id: string; text: string; completed: boolean }[]>([]);
  const [newTaskText, setNewTaskText] = useState('');

  // Load scratchpad & tasks per active project
  useEffect(() => {
    if (!focusProject) return;
    const savedText = localStorage.getItem(`stitch_scratchpad_${focusProject}`);
    setScratchpadText(savedText || '');

    const savedTasks = localStorage.getItem(`stitch_tasks_${focusProject}`);
    if (savedTasks) {
      try { setTasks(JSON.parse(savedTasks)); } catch (e) { setTasks([]); }
    } else {
      setTasks([]);
    }
  }, [focusProject]);

  const saveTasks = (updated: { id: string; text: string; completed: boolean }[]) => {
    setTasks(updated);
    if (focusProject) {
      localStorage.setItem(`stitch_tasks_${focusProject}`, JSON.stringify(updated));
    }
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const item = { id: Date.now().toString(), text: newTaskText.trim(), completed: false };
    const next = [...tasks, item];
    saveTasks(next);
    setNewTaskText('');
  };

  const handleToggleTask = (id: string) => {
    const next = tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
    saveTasks(next);
  };

  const handleDeleteTask = (id: string) => {
    const next = tasks.filter((t) => t.id !== id);
    saveTasks(next);
  };

  const handleClearCompletedTasks = () => {
    const next = tasks.filter((t) => !t.completed);
    saveTasks(next);
  };

  const handleScratchpadChange = (text: string) => {
    setScratchpadText(text);
    if (focusProject) {
      localStorage.setItem(`stitch_scratchpad_${focusProject}`, text);
    }
  };

  // Sound Chime helper
  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      // Audio play blocked
    }
  };

  // Timer Tick Effect
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            playChime();
            if (timerMode === 'work') {
              setCompletedSessions((c) => {
                const next = c + 1;
                localStorage.setItem('stitch_focus_completed_sessions', next.toString());
                return next;
              });
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerMode]);

  // Mode switch
  const switchTimerMode = (mode: 'work' | 'shortBreak' | 'longBreak') => {
    setIsTimerRunning(false);
    setTimerMode(mode);
    setTimeLeft(durations[mode] * 60);
  };

  const toggleTimer = () => setIsTimerRunning(!isTimerRunning);

  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimeLeft(durations[timerMode] * 60);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!focusProject) { setData(null); return; }
    setLoading(true);
    setError('');
    setExplorerPath('');
    setFileViewer(null);
    apiFetch('/api/focus/info')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [focusProject]);

  useEffect(() => {
    if (data && data.active && data.type !== 'local') {
      loadDir('');
    }
  }, [data]);

  const loadDir = async (path) => {
    if (!data) return;
    setExplorerPath(path);
    setFileViewer(null);
    const res = await apiFetch(`/api/focus/contents?owner=${data.repo.owner}&name=${data.repo.name}&path=${encodeURIComponent(path)}`);
    const items = await res.json();
    if (Array.isArray(items)) {
      items.sort((a, b) => (b.type === 'dir' ? 1 : 0) - (a.type === 'dir' ? 1 : 0));
      setExplorerItems(items);
    }
  };

  const loadFile = async (path) => {
    setFileViewer({ path, content: 'Loading…' });
    const res = await apiFetch(`/api/focus/contents?owner=${data.repo.owner}&name=${data.repo.name}&path=${encodeURIComponent(path)}`);
    const fd = await res.json();
    setFileViewer({ path, content: fd.decodedContent ?? 'Binary or too large to display.' });
  };

  const runBotAudit = () => {
    setBotOutput('Analyzing repository build… [SSE stream started]\n');
    setBotRunning(true);
    const script = data.repo.buildScripts?.includes('lint') ? 'lint' : (data.repo.buildScripts?.includes('build') ? 'build' : '');
    
    // Resolve base path for EventSource SSE channel
    const isDesktop = window.go !== undefined || import.meta.env.PROD;
    const baseUrl = isDesktop ? 'http://127.0.0.1:4000' : '';

    const es = new EventSource(`${baseUrl}/api/build/run?path=${encodeURIComponent(data.repo.path)}&script=${encodeURIComponent(script)}`);
    es.onmessage = (ev) => {
      const d = JSON.parse(ev.data);
      if (d.log) setBotOutput((prev) => prev + d.log);
      if (d.done) { es.close(); setBotRunning(false); setBotOutput((prev) => prev + `\n[SYSTEM] Exit code ${d.exitCode}\n`); }
    };
    es.onerror = () => { es.close(); setBotRunning(false); setBotOutput((prev) => prev + '\n[ERROR] Connection failed.\n'); };
  };

  // Breadcrumb parts
  const breadcrumbParts = explorerPath.split('/').filter(Boolean);

  const reposWithRemotes = repos.filter((r) => r.owner && r.name);

  if (!focusProject) {
    return (
      <div className="section-content active" id="focus-section">
        <div className="section-header">
          <div className="section-title"><h2>Focus Area Workspace</h2><div className="section-desc">Zero in on your active repository context.</div></div>
        </div>
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <h2>No Active Project in Focus</h2>
          <p style={{ marginTop: 10 }}>Select a repository from the dropdown above to start working in the Focus Workspace.</p>
        </div>
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
            onChange={(e) => { setFocusProject(e.target.value); }}
          >
            <option value="">-- Select Active Project --</option>
            {repos.map((repo, i) => {
              const value = repo.path || `${repo.owner}/${repo.name}`;
              return <option key={i} value={value}>{repo.type === 'local' ? '💻' : '🌐'} {repo.name}</option>;
            })}
          </select>
        </div>
      </div>

      {loading && <div className="loading-spinner"><div className="spinner"></div><span>Retrieving Workspace Context…</span></div>}
      {error && <div className="error-message">Failed to load focus workspace: {error}</div>}

      {data && data.active && !loading && (() => {
        const isLocal = data.type === 'local';
        const features = data.issues.filter((i) => i.labels.some((l) => /feature|enhancement/i.test(l.name)));
        const prs = data.prs;
        const completedTaskCount = tasks.filter((t) => t.completed).length;
        const taskProgressPct = tasks.length > 0 ? Math.round((completedTaskCount / tasks.length) * 100) : 0;

        return (
          <div className="focus-grid">
            <div className="focus-main">
              {/* Features */}
              <div className="focus-card">
                <h3><span>💡</span> Features to Work On</h3>
                <div style={{ marginTop: 10 }}>
                  {features.length > 0 ? features.map((f) => (
                    <div key={f.number} className="list-item" style={{ marginBottom: 8 }}>
                      <div className="item-left">
                        <a href={f.url} target="_blank" rel="noreferrer" className="item-title">#{f.number} {f.title}</a>
                        <span className="item-subtitle">by @{f.author?.login}</span>
                      </div>
                      <span className="badge badge-purple">Feature</span>
                    </div>
                  )) : <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>No active feature issues.</div>}
                </div>
              </div>

              {/* Sub-Task Checklist */}
              <div className="focus-card checklist-card">
                <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🎯 Focus Sub-Task Checklist ({completedTaskCount}/{tasks.length})</span>
                  {completedTaskCount > 0 && (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                      onClick={handleClearCompletedTasks}
                    >
                      Clear Done ({completedTaskCount})
                    </button>
                  )}
                </h3>

                <div className="checklist-progress-bar-bg">
                  <div className="checklist-progress-bar-fill" style={{ width: `${taskProgressPct}%` }} />
                </div>

                <form onSubmit={handleAddTask} className="checklist-input-group">
                  <input
                    type="text"
                    className="checklist-input"
                    placeholder="Add a micro-task (e.g., Implement backend endpoint, write test)..."
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                    + Add
                  </button>
                </form>

                <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
                  {tasks.length > 0 ? (
                    tasks.map((task) => (
                      <div key={task.id} className={`checklist-item ${task.completed ? 'completed' : ''}`}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <input
                            type="checkbox"
                            className="checklist-checkbox"
                            checked={task.completed}
                            onChange={() => handleToggleTask(task.id)}
                          />
                          <span style={{ fontSize: '0.88rem' }}>{task.text}</span>
                        </div>
                        <button
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
                          onClick={() => handleDeleteTask(task.id)}
                          title="Delete task"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '8px 0', textAlign: 'center' }}>
                      No sub-tasks yet. Break down your active work into actionable steps!
                    </div>
                  )}
                </div>
              </div>

              {/* PR Reviews */}
              <div className="focus-card">
                <h3><span>👀</span> Pull Request Reviews</h3>
                <div style={{ marginTop: 10 }}>
                  {prs.length > 0 ? prs.map((pr) => (
                    <div key={pr.number} className="list-item" style={{ marginBottom: 8 }}>
                      <div className="item-left">
                        <a href={pr.url} target="_blank" rel="noreferrer" className="item-title">#{pr.number} {pr.title}</a>
                        <span className="item-subtitle">by @{pr.author?.login}</span>
                      </div>
                    </div>
                  )) : <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>No active pull request reviews.</div>}
                </div>
              </div>

              {/* Remote file viewer */}
              {fileViewer && (
                <div className="focus-card" style={{ marginTop: '1.5rem' }}>
                  <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: 8, marginBottom: 10 }}>
                    <span>📄 {fileViewer.path.split('/').pop()}</span>
                    <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => setFileViewer(null)}>Close Viewer</button>
                  </h3>
                  <pre style={{ margin: 0, background: '#05070c', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)', overflowX: 'auto', fontFamily: 'monospace', fontSize: '0.8rem', maxHeight: 400, color: '#a9b1d6', whiteSpace: 'pre-wrap' }}>
                    <code>{fileViewer.content}</code>
                  </pre>
                </div>
              )}
            </div>

            <div className="focus-side">
              {/* Pomodoro Focus Timer Card */}
              <div className="focus-card pomodoro-card">
                <h3><span>⏱️</span> Focus Timer</h3>
                <div className="pomodoro-modes">
                  <button className={`pomodoro-mode-btn ${timerMode === 'work' ? 'active' : ''}`} onClick={() => switchTimerMode('work')}>Focus (25m)</button>
                  <button className={`pomodoro-mode-btn ${timerMode === 'shortBreak' ? 'active' : ''}`} onClick={() => switchTimerMode('shortBreak')}>Short Break (5m)</button>
                  <button className={`pomodoro-mode-btn ${timerMode === 'longBreak' ? 'active' : ''}`} onClick={() => switchTimerMode('longBreak')}>Long Break (15m)</button>
                </div>
                <div className="pomodoro-display">
                  <div className="pomodoro-time">{formatTime(timeLeft)}</div>
                </div>
                <div className="pomodoro-controls">
                  <button className="pomodoro-btn-main" onClick={toggleTimer}>
                    {isTimerRunning ? '⏸ Pause' : '▶ Start'}
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={resetTimer}>
                    🔄 Reset
                  </button>
                </div>
                <div className="pomodoro-stats">
                  <span>Sessions Completed: <strong style={{ color: '#c084fc' }}>{completedSessions}</strong> 🏆</span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{timerMode === 'work' ? 'Stay Focused!' : 'Take a Break!'}</span>
                </div>
              </div>

              {/* Quick Scratchpad Card */}
              <div className="focus-card scratchpad-card">
                <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>📝 Focus Scratchpad</span>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                    onClick={() => handleScratchpadChange('')}
                    title="Clear notes"
                  >
                    Clear
                  </button>
                </h3>
                <textarea
                  className="scratchpad-textarea"
                  placeholder="Jot down quick thoughts, snippets, or todo items for this workspace..."
                  value={scratchpadText}
                  onChange={(e) => handleScratchpadChange(e.target.value)}
                />
                <div className="scratchpad-meta">
                  <span>{scratchpadText.trim() ? scratchpadText.trim().split(/\s+/).length : 0} words • {scratchpadText.length} chars</span>
                  <span style={{ color: '#a78bfa' }}>Auto-saved per project</span>
                </div>
              </div>

              {isLocal ? (
                <>
                  <div className="focus-card">
                    <h3><span>🌱</span> Local Git State</h3>
                    <div style={{ fontSize: '0.85rem', marginBottom: 12, color: 'var(--text-muted)' }}>
                      Branch: <strong style={{ color: 'var(--text-color)' }}>{data.repo.branch}</strong>
                    </div>
                    {data.localStatus.length > 0
                      ? <div className="git-status-box">{data.localStatus.map((s, i) => <div key={i}>{s}</div>)}</div>
                      : <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Working directory clean.</div>}
                  </div>
                  <div className="focus-card bot-review-card">
                    <h3><span>🤖</span> Bot Review Diagnostics</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 12 }}>Run a local validation script to audit build health.</p>
                    <button className="btn" style={{ width: '100%' }} onClick={runBotAudit} disabled={botRunning}>
                      {botRunning ? 'Running…' : 'Run Build Audit'}
                    </button>
                    {botOutput && (
                      <div style={{ marginTop: 12, background: '#070810', padding: 10, borderRadius: 8, fontFamily: 'monospace', fontSize: '0.75rem', border: '1px solid rgba(168,85,247,0.3)', maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                        {botOutput}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="focus-card">
                    <h3><span>🌐</span> Remote Repository Context</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      Remote GitHub repository. Local commands are disabled for web projects.
                    </p>
                    <div style={{ marginTop: 12 }}>
                      <a href={`https://github.com/${data.repo.owner}/${data.repo.name}`} target="_blank" rel="noreferrer" className="btn" style={{ width: '100%', display: 'inline-flex', justifyContent: 'center' }}>
                        View on GitHub 🔗
                      </a>
                    </div>
                  </div>

                  <div className="focus-card" style={{ marginTop: '1.5rem' }}>
                    <h3><span>📁</span> Remote File Explorer</h3>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      <span style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: 600 }} onClick={() => loadDir('')}>root</span>
                      {breadcrumbParts.map((p, i) => {
                        const accumulated = breadcrumbParts.slice(0, i + 1).join('/');
                        return (
                          <span key={i}>
                            <span>/</span>
                            <span style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: 600 }} onClick={() => loadDir(accumulated)}>{p}</span>
                          </span>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 250, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 8, border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                      {explorerItems.map((item, i) => (
                        <div key={i}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 6, cursor: 'pointer', borderRadius: 4, transition: 'background 0.2s' }}
                          onClick={() => item.type === 'dir' ? loadDir(item.path) : loadFile(item.path)}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {item.type === 'dir' ? '📁' : '📄'} {item.name}
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
