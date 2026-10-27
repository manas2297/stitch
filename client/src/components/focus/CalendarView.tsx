import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, GripVertical, Video } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { addDays, parseDateStr, toDateStr } from '@/lib/contributions';
import { PRIORITY_BY_ID, startOfWeek, toLocalISO, todayStr, type Meeting, type Task } from '@/lib/planner';
import type { Planner } from '@/lib/usePlanner';
import { cn } from '@/lib/utils';
import { SegmentedToggle } from '../overview/charts';
import { useToast } from '../Toast';
import { PriorityChip, StatusDot } from './taskBits';

type Mode = 'week' | 'month';
const HOUR = 48; // px per hour
const SNAP = 15; // minutes
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Drag = { kind: 'task' | 'meeting'; id: string };

interface Block {
  key: string;
  kind: 'task' | 'meeting';
  title: string;
  start: number; // minutes from midnight
  end: number;
  task?: Task;
  meeting?: Meeting;
  lane: number;
  lanes: number;
}

const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
const fmtMinutes = (m: number) => new Date(2000, 0, 1, Math.floor(m / 60), m % 60).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const isoAt = (date: string, minutes: number) => {
  const d = parseDateStr(date);
  d.setMinutes(minutes);
  return toLocalISO(d);
};

/** Side-by-side lanes for overlapping blocks within one day. */
function layout(blocks: Omit<Block, 'lane' | 'lanes'>[]): Block[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Block[] = [];
  let cluster: Block[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((b) => b.lane + 1));
    cluster.forEach((b) => (b.lanes = lanes));
    out.push(...cluster);
    cluster = [];
  };
  for (const b of sorted) {
    if (b.start >= clusterEnd && cluster.length) flush();
    const used = new Set(cluster.filter((c) => c.end > b.start).map((c) => c.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    cluster.push({ ...b, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, b.end);
  }
  if (cluster.length) flush();
  return out;
}

export default function CalendarView({
  tasks,
  meetings,
  planner,
  onOpenTask,
  onOpenMeeting,
  onNewMeeting,
}: {
  tasks: Task[];
  meetings: Meeting[];
  planner: Planner;
  onOpenTask: (t: Task) => void;
  onOpenMeeting: (m: Meeting) => void;
  onNewMeeting: (startISO: string) => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('week');
  const [anchor, setAnchor] = useState(todayStr());
  const [drag, setDrag] = useState<Drag | null>(null);
  const [now, setNow] = useState(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = todayStr();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (mode === 'week' && scrollRef.current) scrollRef.current.scrollTop = 8 * HOUR - 8;
  }, [mode]);

  const weekStart = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const blocksByDay = useMemo(() => {
    const map: Record<string, Omit<Block, 'lane' | 'lanes'>[]> = {};
    const push = (day: string, b: Omit<Block, 'lane' | 'lanes'>) => (map[day] ??= []).push(b);
    for (const m of meetings) {
      const d = new Date(m.start);
      const start = minutesOf(d);
      push(toDateStr(d), { key: `m-${m.id}`, kind: 'meeting', title: m.title, start, end: Math.min(24 * 60, start + m.durationMin), meeting: m });
    }
    for (const t of tasks) {
      if (!t.scheduledAt) continue;
      const d = new Date(t.scheduledAt);
      const start = minutesOf(d);
      push(toDateStr(d), { key: `t-${t.id}`, kind: 'task', title: t.title, start, end: Math.min(24 * 60, start + (t.durationMin || 60)), task: t });
    }
    return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, layout(v)]));
  }, [tasks, meetings]);

  const dueByDay = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks) if (t.dueDate && t.status !== 'done') (map[t.dueDate] ??= []).push(t);
    return map;
  }, [tasks]);

  const unscheduled = tasks
    .filter((t) => !t.scheduledAt && t.status !== 'done' && t.status !== 'backlog')
    .sort((a, b) => PRIORITY_BY_ID[a.priority].rank - PRIORITY_BY_ID[b.priority].rank || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));

  const run = (p: Promise<unknown>) => p.catch((err) => toast(err.message, 'error'));

  const dropAtTime = (e: React.DragEvent, day: string) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = Math.max(0, Math.min(24 * 60 - SNAP, Math.round(((e.clientY - rect.top) / HOUR) * 60 / SNAP) * SNAP));
    const iso = isoAt(day, minutes);
    if (drag?.kind === 'task') run(planner.updateTask(drag.id, { scheduledAt: iso }));
    if (drag?.kind === 'meeting') run(planner.updateMeeting(drag.id, { start: iso }));
    setDrag(null);
  };
  const dropAsDue = (e: React.DragEvent, day: string) => {
    e.preventDefault();
    if (drag?.kind === 'task') run(planner.updateTask(drag.id, { dueDate: day }));
    setDrag(null);
  };
  const startDrag = (kind: Drag['kind'], id: string) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setDrag({ kind, id });
  };

  const shift = (dir: number) => setAnchor((a) => (mode === 'week' ? addDays(a, dir * 7) : toDateStr(new Date(parseDateStr(a).getFullYear(), parseDateStr(a).getMonth() + dir, 1))));
  const title =
    mode === 'week'
      ? `${parseDateStr(days[0]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${parseDateStr(days[6]).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
      : parseDateStr(anchor).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setAnchor(today)}>
          Today
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Previous" onClick={() => shift(-1)}>
          <ChevronLeft />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Next" onClick={() => shift(1)}>
          <ChevronRight />
        </Button>
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => onNewMeeting(isoAt(anchor === today ? today : anchor, Math.min(23 * 60, Math.ceil((minutesOf(now) + 1) / 30) * 30)))}>
          <Video /> New meeting
        </Button>
        <SegmentedToggle<Mode>
          ariaLabel="Calendar view"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
        />
      </div>
    </div>
  );

  if (mode === 'month') {
    const first = toDateStr(new Date(parseDateStr(anchor).getFullYear(), parseDateStr(anchor).getMonth(), 1));
    const gridStart = startOfWeek(first);
    const month = parseDateStr(anchor).getMonth();
    const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
    return (
      <div className="flex flex-col gap-4">
        {toolbar}
        <div className="bg-card overflow-hidden rounded-xl border">
          <div className="text-muted-foreground grid grid-cols-7 border-b text-center text-xs font-semibold">
            {DAY_NAMES.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day) => {
              const items = [
                ...(blocksByDay[day] ?? []).sort((a, b) => a.start - b.start).map((b) => ({ key: b.key, label: `${fmtMinutes(b.start)} ${b.title}`, kind: b.kind, onClick: () => (b.meeting ? onOpenMeeting(b.meeting) : onOpenTask(b.task!)) })),
                ...(dueByDay[day] ?? []).map((t) => ({ key: `d-${t.id}`, label: t.title, kind: 'due' as const, onClick: () => onOpenTask(t) })),
              ];
              return (
                <div
                  key={day}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => dropAsDue(e, day)}
                  className={cn('flex min-h-28 flex-col gap-1 border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0', parseDateStr(day).getMonth() !== month && 'bg-muted/30')}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setAnchor(day);
                      setMode('week');
                    }}
                    className={cn(
                      'self-start rounded-full px-1.5 text-xs font-semibold tabular-nums hover:underline',
                      day === today ? 'bg-primary text-primary-foreground' : parseDateStr(day).getMonth() !== month ? 'text-muted-foreground' : '',
                    )}
                  >
                    {parseDateStr(day).getDate()}
                  </button>
                  {items.slice(0, 3).map((it) => (
                    <button
                      key={it.key}
                      type="button"
                      onClick={it.onClick}
                      className={cn(
                        'truncate rounded px-1.5 py-0.5 text-left text-[0.68rem]',
                        it.kind === 'meeting' ? 'bg-violet/15' : it.kind === 'task' ? 'bg-primary/12' : 'border border-dashed',
                      )}
                    >
                      {it.label}
                    </button>
                  ))}
                  {items.length > 3 && <span className="text-muted-foreground px-1 text-[0.65rem]">+{items.length - 3} more</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const nowMinutes = minutesOf(now);

  return (
    <div className="flex flex-col gap-4">
      {toolbar}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="bg-card overflow-hidden rounded-xl border">
          {/* Day headers + all-day (due) row */}
          <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b">
            <div />
            {days.map((day, i) => (
              <div key={day} className={cn('border-l px-2 py-2 text-center', day === today && 'bg-primary/5')}>
                <div className="text-muted-foreground text-[0.68rem] font-semibold uppercase">{DAY_NAMES[i]}</div>
                <div className={cn('mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-sm font-bold tabular-nums', day === today && 'bg-primary text-primary-foreground')}>
                  {parseDateStr(day).getDate()}
                </div>
              </div>
            ))}
            <div className="text-muted-foreground flex items-start justify-end border-t pt-1.5 pr-2 text-[0.6rem] uppercase">Due</div>
            {days.map((day) => (
              <div
                key={day}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => dropAsDue(e, day)}
                className={cn('flex min-h-9 flex-col gap-1 border-t border-l p-1', day === today && 'bg-primary/5', drag?.kind === 'task' && 'bg-muted/40')}
              >
                {(dueByDay[day] ?? []).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    draggable
                    onDragStart={startDrag('task', t.id)}
                    onClick={() => onOpenTask(t)}
                    className="flex items-center gap-1 truncate rounded border border-dashed px-1.5 py-0.5 text-left text-[0.68rem]"
                    title={`Due: ${t.title}`}
                  >
                    <StatusDot status={t.status} className="size-1.5" /> <span className="truncate">{t.title}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div ref={scrollRef} className="max-h-[62vh] overflow-y-auto">
            <div className="relative grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]" style={{ height: 24 * HOUR }}>
              <div className="relative">
                {Array.from({ length: 24 }, (_, h) => (
                  <span key={h} className="text-muted-foreground absolute right-2 -translate-y-1/2 text-[0.62rem] tabular-nums" style={{ top: h * HOUR }}>
                    {h === 0 ? '' : fmtMinutes(h * 60)}
                  </span>
                ))}
              </div>
              {days.map((day) => (
                <div
                  key={day}
                  role="gridcell"
                  aria-label={parseDateStr(day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => dropAtTime(e, day)}
                  onClick={(e) => {
                    if (e.target !== e.currentTarget) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    onNewMeeting(isoAt(day, Math.floor(((e.clientY - rect.top) / HOUR) * 2) * 30));
                  }}
                  className={cn('relative cursor-cell border-l', day === today && 'bg-primary/[0.03]')}
                  style={{ backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px ${HOUR}px)` }}
                >
                  {(blocksByDay[day] ?? []).map((b) => {
                    const height = Math.max(18, ((b.end - b.start) / 60) * HOUR - 2);
                    const done = b.task?.status === 'done';
                    return (
                      <button
                        key={b.key}
                        type="button"
                        draggable
                        onDragStart={startDrag(b.kind, b.kind === 'task' ? b.task!.id : b.meeting!.id)}
                        onClick={() => (b.meeting ? onOpenMeeting(b.meeting) : onOpenTask(b.task!))}
                        className={cn(
                          'absolute overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-[0.7rem] leading-tight shadow-xs transition-opacity hover:z-10 hover:shadow-md',
                          b.kind === 'meeting' ? 'border-l-violet bg-violet/15' : 'border-l-primary bg-primary/12',
                          done && 'opacity-50',
                          drag && 'pointer-events-none',
                        )}
                        style={{ top: (b.start / 60) * HOUR + 1, height, left: `calc(${(b.lane / b.lanes) * 100}% + 2px)`, width: `calc(${100 / b.lanes}% - 4px)` }}
                        title={`${fmtMinutes(b.start)}–${fmtMinutes(b.end)} ${b.title}`}
                      >
                        <div className={cn('truncate font-semibold', done && 'line-through')}>{b.title}</div>
                        {height > 30 && (
                          <div className="text-muted-foreground truncate">
                            {fmtMinutes(b.start)} – {fmtMinutes(b.end)}
                          </div>
                        )}
                      </button>
                    );
                  })}
                  {day === today && (
                    <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: (nowMinutes / 60) * HOUR }}>
                      <span className="bg-destructive -ml-1 size-2 rounded-full" />
                      <span className="bg-destructive h-px flex-1" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="bg-card flex max-h-[75vh] flex-col rounded-xl border">
          <div className="border-b p-3">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold">
              <CalendarDays className="size-4" /> Unscheduled
              <span className="text-muted-foreground text-xs font-medium">{unscheduled.length}</span>
            </h4>
            <p className="text-muted-foreground mt-0.5 text-xs">Drag onto the week to block time, or onto “Due” to set a date.</p>
          </div>
          <ul className="flex flex-col gap-1.5 overflow-y-auto p-2">
            {unscheduled.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  draggable
                  onDragStart={startDrag('task', t.id)}
                  onClick={() => onOpenTask(t)}
                  className={cn('hover:bg-muted/50 flex w-full cursor-grab items-start gap-1.5 rounded-md border p-2 text-left text-xs active:cursor-grabbing', drag?.id === t.id && 'opacity-40')}
                >
                  <GripVertical className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate font-medium">{t.title}</span>
                    <span className="flex items-center gap-1.5">
                      <StatusDot status={t.status} className="size-1.5" />
                      <PriorityChip priority={t.priority} compact />
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {unscheduled.length === 0 && <li className="text-muted-foreground p-3 text-center text-xs">Everything open is on the calendar.</li>}
          </ul>
        </aside>
      </div>
    </div>
  );
}
