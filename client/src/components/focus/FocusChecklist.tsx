import { useState, useEffect } from 'react';
import { CheckSquare, Plus, Trash2, ListChecks } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';

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
    <div className="focus-card checklist-card" style={{ padding: '1.5rem' }}>
      <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <CheckSquare size={18} style={{ color: 'var(--primary)' }} />
          <span>Focus Sub-Task Checklist</span>
          {tasks.length > 0 && (
            <Badge variant={completedTaskCount === tasks.length ? 'green' : 'blue'}>
              {completedTaskCount}/{tasks.length}
            </Badge>
          )}
        </span>
        {completedTaskCount > 0 && (
          <button
            className="btn btn-secondary"
            style={{
              padding: '3px 8px',
              fontSize: '0.75rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
            onClick={handleClearCompletedTasks}
          >
            <Trash2 size={12} />
            <span>Clear Done ({completedTaskCount})</span>
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
        <button
          type="submit"
          className="btn btn-primary"
          style={{ padding: '6px 14px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}
        >
          <Plus size={15} />
          <span>Add</span>
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
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  transition: 'color 0.15s ease',
                }}
                className="hover-danger"
                onClick={() => handleDeleteTask(task.id)}
                title="Delete task"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        ) : (
          <EmptyState
            icon={ListChecks}
            title="No sub-tasks yet"
            description="Break down your active work into actionable steps!"
          />
        )}
      </div>
    </div>
  );
}
