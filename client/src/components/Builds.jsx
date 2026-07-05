import { useState, useRef } from 'react';
import useAppStore from '../store/useAppStore';

function escapeHtml(t = '') {
  return t.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}

export default function Builds() {
  const repos = useAppStore((s) => s.repos);
  const localRepos = repos.filter((r) => r.exists && r.type === 'local');

  const [selectedPath, setSelectedPath] = useState('');
  const [scripts, setScripts] = useState(['build']);
  const [selectedScript, setSelectedScript] = useState('build');
  const [output, setOutput] = useState('Console is idle. Select a repository and task to run.');
  const [status, setStatus] = useState('Terminal Offline');
  const [running, setRunning] = useState(false);
  const esRef = useRef(null);

  const handleRepoChange = (e) => {
    const path = e.target.value;
    setSelectedPath(path);
    const repo = repos.find((r) => r.path === path);
    const buildScripts = repo?.buildScripts?.length > 0 ? repo.buildScripts : ['build'];
    setScripts(buildScripts);
    setSelectedScript(buildScripts[0]);
  };

  const runTask = () => {
    if (running) {
      esRef.current?.close();
      esRef.current = null;
      setRunning(false);
      setStatus('Task Aborted');
      setOutput((prev) => prev + '\n\n[SYSTEM] Task execution terminated by user.\n');
      return;
    }
    if (!selectedPath) { alert('Please select a local repository.'); return; }

    setOutput('');
    setStatus('Running…');
    setRunning(true);

    const es = new EventSource(`/api/build/run?path=${encodeURIComponent(selectedPath)}&script=${encodeURIComponent(selectedScript)}`);
    esRef.current = es;

    es.onmessage = (event) => {
      const d = JSON.parse(event.data);
      if (d.log) setOutput((prev) => prev + escapeHtml(d.log));
      if (d.done) {
        es.close();
        esRef.current = null;
        setRunning(false);
        setStatus(`Finished (Code: ${d.exitCode})`);
        setOutput((prev) => prev + `\n\n[SYSTEM] Build process exited with code ${d.exitCode}\n`);
      }
    };
    es.onerror = () => {
      es.close();
      esRef.current = null;
      setRunning(false);
      setStatus('Connection Error');
      setOutput((prev) => prev + '\n[SYSTEM ERROR] Connection to server lost.\n');
    };
  };

  return (
    <div className="section-content active" id="builds-section">
      <div className="section-header">
        <div className="section-title">
          <h2>Fix Builds</h2>
          <div className="section-desc">Select a repository to run build commands and view diagnostic outputs.</div>
        </div>
        <div className="select-wrapper">
          <select className="custom-select" value={selectedPath} onChange={handleRepoChange}>
            <option value="">Select a local repository…</option>
            {localRepos.map((r, i) => <option key={i} value={r.path}>{r.name}</option>)}
          </select>
        </div>
      </div>

      <div className="build-section-layout">
        <div className="build-controls">
          <select className="custom-select" style={{ minWidth: 150 }} value={selectedScript} onChange={(e) => setSelectedScript(e.target.value)}>
            {scripts.map((s, i) => <option key={i} value={s}>{s}</option>)}
          </select>
          <button className={`btn ${running ? 'btn-secondary' : ''}`} onClick={runTask}>
            {running ? '🛑 Stop Task' : '🚀 Run Task'}
          </button>
        </div>

        <div className="terminal-container">
          <div className="terminal-header">
            <div className="terminal-dots"><span></span><span></span><span></span></div>
            <span>{status}</span>
          </div>
          <div className="terminal-output" style={{ whiteSpace: 'pre-wrap' }}>{output}</div>
        </div>
      </div>
    </div>
  );
}
