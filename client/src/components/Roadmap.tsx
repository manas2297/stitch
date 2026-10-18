import { useState } from 'react';
import { ExternalLink, Map, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { apiFetch } from '../store/useAppStore';
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
      const res = await apiFetch('/api/roadmap/add', {
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
    <div className="flex flex-col gap-4">
      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-sm">
        <div>
          Tasks sync to a GitHub issue labeled <code className="bg-muted rounded px-1.5 py-0.5 text-xs">roadmap</code>.
        </div>
        {issue ? (
          <a
            href={issue.url}
            target="_blank"
            rel="noreferrer"
            className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
          >
            GitHub #{issue.number} <ExternalLink className="size-3" />
          </a>
        ) : (
          <span className="text-xs">Issue auto-created on first task.</span>
        )}
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={Map}
          title="No roadmap items yet"
          description="Add your first task below — it'll be synced to GitHub as an issue."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((t, i) => (
            <li key={i} className="bg-card flex items-center gap-3 rounded-lg border px-4 py-3">
              <Checkbox checked={t.done} disabled aria-label={t.text} />
              <span className={cn('flex-1 text-sm break-words', t.done && 'text-muted-foreground line-through')}>
                {t.text}
              </span>
              {t.done && <span className="text-success text-xs">Done ✓</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !saving && addTask()}
          placeholder="New task — press Enter or click Add…"
          disabled={saving}
        />
        <Button onClick={addTask} disabled={saving}>
          <Plus /> {saving ? 'Saving…' : 'Add Task'}
        </Button>
      </div>
    </div>
  );
}
