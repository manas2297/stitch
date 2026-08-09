import { useState, useEffect } from 'react';

interface Task {
  id: string;
  text: string;
  completed: boolean;
}

interface FocusChecklistProps {
  focusProject: string;
}

export default function FocusChecklist({ focusProject }: FocusChecklistProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');

  useEffect(() => {
    if (!focusProject) return;
    const savedTasks = localStorage.getItem(`stitch_tasks_${focusProject}`);
    if (savedTasks) {
      try {
        setTasks(JSON.parse(savedTasks));
      } catch (e) {
        setTasks([]);
      }
    } else {
      setTasks([]);
    }
  }, [focusProject]);

  const saveTasks = (updated: Task[]) => {
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

  const completedTaskCount = tasks.filter((t) => t.completed).length;
  const taskProgressPct = tasks.length > 0 ? Math.round((completedTaskCount / tasks.length) * 100) : 0;

  return (
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
  );
}
