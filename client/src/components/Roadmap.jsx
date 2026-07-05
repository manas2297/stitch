import { useState } from 'react';
import { useToast } from './Toast';

export default function Roadmap({ owner, name, initialTasks, issue }) {
  const [tasks, setTasks] = useState(initialTasks || []);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const addTask = async () => {
    const task = input.trim();
    if (!task) return;
    setSaving(true);
    try {
      const res = await fetch('/api/roadmap/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, name, task }),
      });
      const result = await res.json();
      if (res.ok) {
        setTasks((prev) => [...prev, { done: false, text: task }]);
        setInput('');
        toast(`✓ ${result.message}`, 'success');
      } else {
        toast(`Error: ${result.error}`, 'error');
      }
    } catch (err) {
      toast(`Failed: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Tasks sync to a GitHub issue labeled{' '}
          <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: 4, fontSize: '0.8rem' }}>roadmap</code>.
        </div>
        {issue ? (
          <a href={issue.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            GitHub #{issue.number} ↗
          </a>
        ) : (
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Issue auto-created on first task.
          </span>
        )}
      </div>

      <div className="roadmap-list">
        {tasks.length === 0 ? (
          <div className="empty-state" style={{ padding: '1.5rem' }}>
            <div className="empty-state-icon">🗺️</div>
            <div className="empty-state-title">No roadmap items yet</div>
            <div className="empty-state-desc">Add your first task below — it'll be synced to GitHub as an issue.</div>
          </div>
        ) : (
          tasks.map((t, i) => (
            <div key={i} className={`roadmap-task ${t.done ? 'done' : ''}`}>
              <input type="checkbox" className="task-checkbox" defaultChecked={t.done} disabled />
              <span className="task-text">{t.text}</span>
              {t.done && <span style={{ fontSize: '0.72rem', color: 'var(--success)', marginLeft: 'auto' }}>Done ✓</span>}
            </div>
          ))
        )}
      </div>

      <div className="roadmap-add-form">
        <input
          type="text"
          className="roadmap-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !saving && addTask()}
          placeholder="New task — press Enter or click Add…"
          disabled={saving}
        />
        <button className="btn" onClick={addTask} disabled={saving}>
          {saving ? 'Saving…' : '+ Add Task'}
        </button>
      </div>
    </div>
  );
}
