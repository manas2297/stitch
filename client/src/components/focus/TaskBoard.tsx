import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronsLeftRight, ChevronsRightLeft, Kanban, List, Plus, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRIORITIES, PRIORITY_BY_ID, STATUSES, type Priority, type Status, type Task } from '@/lib/planner';
import type { Planner } from '@/lib/usePlanner';
import { cn } from '@/lib/utils';
import { SegmentedToggle } from '../overview/charts';
import { useToast } from '../Toast';
import QuickAdd from './QuickAdd';
import { StatusDot, TaskMeta } from './taskBits';

type View = 'board' | 'list';
const DONE_PREVIEW = 8;

function TaskCard({ task, onOpen, dragging, onDragStart }: { task: Task; onOpen: () => void; dragging: boolean; onDragStart: (e: React.DragEvent) => void }) {
  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      className={cn(
        'bg-card hover:border-primary/40 focus-visible:ring-ring/50 flex w-full cursor-grab flex-col gap-1.5 rounded-lg border p-3 text-left shadow-xs transition-colors outline-none focus-visible:ring-[3px] active:cursor-grabbing',
        dragging && 'opacity-40',
        task.status === 'done' && 'opacity-70',
      )}
    >
      <span className={cn('text-sm leading-snug font-medium', task.status === 'done' && 'text-muted-foreground line-through')}>{task.title}</span>
      <TaskMeta task={task} />
    </button>
  );
}

function BoardView({ tasks, planner, onOpen }: { tasks: Task[]; planner: Planner; onOpen: (t: Task) => void }) {
  const toast = useToast();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ status: Status; beforeId: string | null } | null>(null);
  const [addingIn, setAddingIn] = useState<Status | null>(null);
  const [showAllDone, setShowAllDone] = useState(false);
  // Collapsed columns shrink to a strip (still a drop target) so the rest fit without scrolling.
  const [collapsed, setCollapsed] = useState<Status[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('stitch.focus.collapsed') || '["backlog"]');
    } catch {
      return ['backlog'];
    }
  });
  const toggleCollapsed = (id: Status) =>
    setCollapsed((cur) => {
      const next = cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id];
      try {
        localStorage.setItem('stitch.focus.collapsed', JSON.stringify(next));
      } catch {
        /* preference only */
      }
      return next;
    });

  const columns = useMemo(
    () =>
      STATUSES.map((s) => {
        let list = tasks.filter((t) => t.status === s.id).sort((a, b) => a.order - b.order);
        if (s.id === 'done') list = list.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
        return { ...s, tasks: list };
      }),
    [tasks],
  );

  // Drop between neighbours by giving the task an order halfway between them.
  const drop = async (status: Status, beforeId: string | null) => {
    const id = dragId;
    setDragId(null);
    setOver(null);
    if (!id) return;
    const col = columns.find((c) => c.id === status)!.tasks.filter((t) => t.id !== id);
    const idx = beforeId ? col.findIndex((t) => t.id === beforeId) : col.length;
    const prev = col[idx - 1]?.order;
    const next = col[idx]?.order;
    const order = prev === undefined && next === undefined ? 1024 : prev === undefined ? next! - 1024 : next === undefined ? prev + 1024 : (prev + next) / 2;
    const task = tasks.find((t) => t.id === id);
    if (task && task.status === status && task.order === order) return;
    try {
      await planner.updateTask(id, { status, order });
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-2">
      <div className="flex min-w-max gap-3 xl:min-w-0">
        {columns.map((col) => {
          const visible = col.id === 'done' && !showAllDone ? col.tasks.slice(0, DONE_PREVIEW) : col.tasks;
          if (collapsed.includes(col.id)) {
            return (
              <button
                key={col.id}
                type="button"
                onClick={() => toggleCollapsed(col.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (over?.status !== col.id) setOver({ status: col.id, beforeId: null });
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  drop(col.id, null);
                }}
                aria-label={`Expand ${col.label} (${col.tasks.length})`}
                className={cn(
                  'bg-muted/40 hover:bg-muted/70 flex w-10 shrink-0 flex-col items-center gap-2 rounded-xl border py-3 transition-colors',
                  over?.status === col.id && dragId && 'border-primary/50 bg-primary/5',
                )}
              >
                <ChevronsLeftRight className="text-muted-foreground size-3.5" />
                <StatusDot status={col.id} />
                <span className="text-muted-foreground text-xs font-semibold tabular-nums">{col.tasks.length}</span>
                <span className="text-sm font-semibold [writing-mode:vertical-rl]">{col.label}</span>
              </button>
            );
          }
          return (
            <section
              key={col.id}
              aria-label={col.label}
              onDragOver={(e) => {
                e.preventDefault();
                if (over?.status !== col.id || over.beforeId !== null) setOver({ status: col.id, beforeId: null });
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(col.id, over?.status === col.id ? over.beforeId : null);
              }}
              className={cn(
                'bg-muted/40 flex max-h-[70vh] min-h-40 w-64 shrink-0 flex-col rounded-xl border p-2 transition-colors xl:w-auto xl:min-w-44 xl:flex-1',
                over?.status === col.id && dragId && 'border-primary/50 bg-primary/5',
              )}
            >
              <header className="flex items-center justify-between px-1.5 pt-0.5 pb-2">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <StatusDot status={col.id} /> {col.label}
                  <span className="text-muted-foreground text-xs font-medium tabular-nums">{col.tasks.length}</span>
                </span>
                <span className="flex">
                  <Button size="icon-xs" variant="ghost" aria-label={`Add task to ${col.label}`} onClick={() => setAddingIn(addingIn === col.id ? null : col.id)}>
                    <Plus />
                  </Button>
                  <Button size="icon-xs" variant="ghost" aria-label={`Collapse ${col.label}`} onClick={() => toggleCollapsed(col.id)}>
                    <ChevronsRightLeft />
                  </Button>
                </span>
              </header>
              {addingIn === col.id && <QuickAdd onCreate={planner.createTasks} status={col.id} placeholder="Task title…" className="mb-2" autoFocus />}
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                {visible.map((t) => (
                  <div
                    key={t.id}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (over?.beforeId !== t.id) setOver({ status: col.id, beforeId: t.id });
                    }}
                    className={cn(over?.beforeId === t.id && dragId !== t.id && 'border-primary border-t-2 pt-1')}
                  >
                    <TaskCard
                      task={t}
                      dragging={dragId === t.id}
                      onOpen={() => onOpen(t)}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', t.id);
                        setDragId(t.id);
                      }}
                    />
                  </div>
                ))}
                {col.tasks.length === 0 && <p className="text-muted-foreground px-2 py-4 text-center text-xs">Drop tasks here</p>}
                {col.id === 'done' && col.tasks.length > DONE_PREVIEW && (
                  <Button size="xs" variant="ghost" onClick={() => setShowAllDone((s) => !s)}>
                    {showAllDone ? 'Show recent only' : `Show all ${col.tasks.length}`}
                  </Button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ListView({ tasks, planner, onOpen }: { tasks: Task[]; planner: Planner; onOpen: (t: Task) => void }) {
  const toast = useToast();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ done: true, backlog: true });
  const groups = STATUSES.map((s) => ({
    ...s,
    tasks: tasks
      .filter((t) => t.status === s.id)
      .sort((a, b) => PRIORITY_BY_ID[a.priority].rank - PRIORITY_BY_ID[b.priority].rank || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.order - b.order),
  })).filter((g) => g.tasks.length > 0);

  if (groups.length === 0) return <p className="text-muted-foreground py-10 text-center text-sm">No tasks match.</p>;

  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      {groups.map((g) => (
        <div key={g.id} className="border-b last:border-b-0">
          <button
            type="button"
            onClick={() => setCollapsed((c) => ({ ...c, [g.id]: !c[g.id] }))}
            className="bg-muted/40 hover:bg-muted/60 flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-semibold"
            aria-expanded={!collapsed[g.id]}
          >
            {collapsed[g.id] ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
            <StatusDot status={g.id} /> {g.label}
            <span className="text-muted-foreground text-xs font-medium">{g.tasks.length}</span>
          </button>
          {!collapsed[g.id] && (
            <ul className="divide-y">
              {g.tasks.map((t) => (
                <li key={t.id} className="hover:bg-muted/30 flex items-center gap-3 px-4 py-2.5">
                  <Checkbox
                    checked={t.status === 'done'}
                    aria-label={t.status === 'done' ? `Reopen ${t.title}` : `Complete ${t.title}`}
                    onCheckedChange={(v) => planner.updateTask(t.id, { status: v === true ? 'done' : 'todo' }).catch((err) => toast(err.message, 'error'))}
                  />
                  <button type="button" onClick={() => onOpen(t)} className="flex min-w-0 flex-1 flex-col gap-0.5 text-left sm:flex-row sm:items-center sm:gap-3">
                    <span className={cn('truncate text-sm font-medium', t.status === 'done' && 'text-muted-foreground line-through')}>{t.title}</span>
                    <TaskMeta task={t} className="sm:ml-auto sm:shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

export default function TaskBoard({ tasks, planner, onOpen }: { tasks: Task[]; planner: Planner; onOpen: (t: Task) => void }) {
  const [view, setView] = useState<View>(() => {
    try {
      return (localStorage.getItem('stitch.focus.taskView') as View) || 'board';
    } catch {
      return 'board';
    }
  });
  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState<'all' | Priority>('all');
  const [tag, setTag] = useState('all');

  const allTags = useMemo(() => Array.from(new Set(tasks.flatMap((t) => t.tags))).sort(), [tasks]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter(
      (t) =>
        (priority === 'all' || t.priority === priority) &&
        (tag === 'all' || t.tags.includes(tag)) &&
        (!q || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)),
    );
  }, [tasks, query, priority, tag]);

  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem('stitch.focus.taskView', v);
    } catch {
      /* preference only */
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <QuickAdd onCreate={planner.createTasks} className="lg:max-w-md lg:flex-1" />
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter…" className="h-8 w-40 pl-8 text-sm" aria-label="Filter tasks" />
          </div>
          <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
            <SelectTrigger size="sm" className="w-36" aria-label="Priority filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any priority</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {allTags.length > 0 && (
            <Select value={tag} onValueChange={setTag}>
              <SelectTrigger size="sm" className="w-32" aria-label="Tag filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any tag</SelectItem>
                {allTags.map((t) => (
                  <SelectItem key={t} value={t}>
                    #{t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <SegmentedToggle<View>
            ariaLabel="Task view"
            value={view}
            onChange={changeView}
            options={[
              { value: 'board', label: <><Kanban /> Board</> },
              { value: 'list', label: <><List /> List</> },
            ]}
          />
        </div>
      </div>
      {view === 'board' ? <BoardView tasks={filtered} planner={planner} onOpen={onOpen} /> : <ListView tasks={filtered} planner={planner} onOpen={onOpen} />}
    </div>
  );
}
