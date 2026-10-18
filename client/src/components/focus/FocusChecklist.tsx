import { useEffect, useState } from 'react';
import { CheckSquare, ListChecks, Plus, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import FocusCard from './FocusCard';

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
    const saved = localStorage.getItem(`stitch_tasks_${focusProject}`);
    try {
      setTasks(saved ? JSON.parse(saved) : []);
    } catch {
      setTasks([]);
    }
  }, [focusProject]);

  const saveTasks = (updated: Task[]) => {
    setTasks(updated);
    if (focusProject) localStorage.setItem(`stitch_tasks_${focusProject}`, JSON.stringify(updated));
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    saveTasks([...tasks, { id: Date.now().toString(), text: newTaskText.trim(), completed: false }]);
    setNewTaskText('');
  };

  const completed = tasks.filter((t) => t.completed).length;
  const pct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

  return (
    <FocusCard
      icon={CheckSquare}
      title="Focus Sub-Task Checklist"
      badge={
        tasks.length > 0 && (
          <Badge variant={completed === tasks.length ? 'green' : 'blue'}>
            {completed}/{tasks.length}
          </Badge>
        )
      }
      action={
        completed > 0 && (
          <Button variant="secondary" size="xs" onClick={() => saveTasks(tasks.filter((t) => !t.completed))}>
            <Trash2 /> Clear Done ({completed})
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-3">
        <Progress value={pct} aria-label="Checklist progress" />

        <form onSubmit={handleAddTask} className="flex gap-2">
          <Input
            placeholder="Add a micro-task (e.g., Implement backend endpoint, write test)..."
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
          />
          <Button type="submit">
            <Plus /> Add
          </Button>
        </form>

        {tasks.length > 0 ? (
          <ul className="flex flex-col divide-y">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-3 py-2">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <Checkbox
                    checked={task.completed}
                    onCheckedChange={() =>
                      saveTasks(tasks.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t)))
                    }
                  />
                  <span className={cn('text-sm break-words', task.completed && 'text-muted-foreground line-through')}>
                    {task.text}
                  </span>
                </label>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => saveTasks(tasks.filter((t) => t.id !== task.id))}
                  aria-label={`Delete task ${task.text}`}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={ListChecks} title="No sub-tasks yet" description="Break down your active work into actionable steps!" />
        )}
      </div>
    </FocusCard>
  );
}
