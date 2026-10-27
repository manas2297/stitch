import { useMemo } from 'react';
import { AlarmClock, CalendarClock, CheckCircle2, CircleDashed, Video } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { addDays, toDateStr } from '@/lib/contributions';
import { formatRange, isOverdue, isUrl, openExternal, PRIORITY_BY_ID, startOfWeek, STATUSES, todayStr, type Meeting, type Task } from '@/lib/planner';
import type { Planner } from '@/lib/usePlanner';
import { cn } from '@/lib/utils';
import { useToast } from '../Toast';
import PomodoroTimer from './PomodoroTimer';
import QuickAdd from './QuickAdd';
import { StatusDot, TaskMeta } from './taskBits';

function TaskLine({ task, planner, onOpen }: { task: Task; planner: Planner; onOpen: () => void }) {
  const toast = useToast();
  return (
    <li className="hover:bg-muted/40 -mx-2 flex items-start gap-3 rounded-md px-2 py-2">
      <Checkbox
        className="mt-0.5"
        checked={task.status === 'done'}
        aria-label={`Complete ${task.title}`}
        onCheckedChange={(v) => planner.updateTask(task.id, { status: v === true ? 'done' : 'todo' }).catch((err) => toast(err.message, 'error'))}
      />
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 flex-col gap-1 text-left">
        <span className={cn('text-sm font-medium', task.status === 'done' && 'text-muted-foreground line-through')}>{task.title}</span>
        <TaskMeta task={task} />
      </button>
    </li>
  );
}

function Section({ icon: Icon, title, count, children, tone }: { icon: typeof AlarmClock; title: string; count?: number; children: React.ReactNode; tone?: string }) {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-5">
        <CardTitle className={cn('flex items-center gap-2 text-sm', tone)}>
          <Icon className="size-4" /> {title}
          {count !== undefined && <span className="text-muted-foreground text-xs font-medium">{count}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5">{children}</CardContent>
    </Card>
  );
}

export default function TodayView({
  tasks,
  meetings,
  planner,
  onOpenTask,
  onOpenMeeting,
}: {
  tasks: Task[];
  meetings: Meeting[];
  planner: Planner;
  onOpenTask: (t: Task) => void;
  onOpenMeeting: (m: Meeting) => void;
}) {
  const today = todayStr();
  const now = Date.now();

  const agenda = useMemo(() => {
    const items: { key: string; start: string; minutes: number; title: string; kind: 'meeting' | 'task'; meeting?: Meeting; task?: Task }[] = [];
    for (const m of meetings) if (toDateStr(new Date(m.start)) === today) items.push({ key: m.id, start: m.start, minutes: m.durationMin, title: m.title, kind: 'meeting', meeting: m });
    for (const t of tasks)
      if (t.scheduledAt && toDateStr(new Date(t.scheduledAt)) === today) items.push({ key: t.id, start: t.scheduledAt, minutes: t.durationMin || 60, title: t.title, kind: 'task', task: t });
    return items.sort((a, b) => a.start.localeCompare(b.start));
  }, [tasks, meetings, today]);

  const open = tasks.filter((t) => t.status !== 'done');
  const byPriority = (a: Task, b: Task) => PRIORITY_BY_ID[a.priority].rank - PRIORITY_BY_ID[b.priority].rank;
  const dueNow = open.filter((t) => t.dueDate && t.dueDate <= today).sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || byPriority(a, b));
  const inProgress = open.filter((t) => (t.status === 'in-progress' || t.status === 'review' || t.status === 'blocked') && !dueNow.includes(t)).sort(byPriority);
  const overdue = dueNow.filter(isOverdue).length;

  const weekStart = startOfWeek(today);
  const doneThisWeek = tasks.filter((t) => t.completedAt && toDateStr(new Date(t.completedAt)) >= weekStart).length;
  const upcoming = meetings.filter((m) => new Date(m.start).getTime() > now && toDateStr(new Date(m.start)) <= addDays(today, 7) && toDateStr(new Date(m.start)) !== today).slice(0, 4);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <QuickAdd onCreate={planner.createTasks} extra={{ dueDate: today }} placeholder="Add a task for today…  !high  #tag" />

        <Section icon={CalendarClock} title="Today's agenda" count={agenda.length}>
          {agenda.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing scheduled. Drag tasks onto the calendar to block focus time.</p>
          ) : (
            <ol className="relative flex flex-col gap-2 border-l pl-4">
              {agenda.map((a) => {
                const start = new Date(a.start).getTime();
                const live = now >= start && now < start + a.minutes * 60000;
                const past = now >= start + a.minutes * 60000;
                return (
                  <li key={a.key} className={cn('relative', past && 'opacity-60')}>
                    <span className={cn('absolute top-2 -left-[1.3rem] size-2.5 rounded-full border-2 border-card', live ? 'bg-destructive' : a.kind === 'meeting' ? 'bg-violet' : 'bg-primary')} />
                    <div className={cn('flex items-center gap-3 rounded-lg border px-3 py-2', live && 'border-destructive/40 bg-destructive/5')}>
                      <button type="button" onClick={() => (a.meeting ? onOpenMeeting(a.meeting) : onOpenTask(a.task!))} className="flex min-w-0 flex-1 flex-col text-left">
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {formatRange(a.start, a.minutes)} {live && <strong className="text-destructive">· now</strong>}
                        </span>
                        <span className={cn('truncate text-sm font-medium', a.task?.status === 'done' && 'line-through')}>
                          {a.kind === 'meeting' ? <Video className="mr-1 inline size-3.5 align-[-2px]" /> : <StatusDot status={a.task!.status} className="mr-1.5 align-middle" />}
                          {a.title}
                        </span>
                      </button>
                      {a.meeting && isUrl(a.meeting.location) && (
                        <Button size="xs" variant={live ? 'default' : 'outline'} onClick={() => openExternal(a.meeting!.location)}>
                          Join
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Section>

        <Section icon={AlarmClock} title={overdue ? `Due — ${overdue} overdue` : 'Due today'} count={dueNow.length} tone={overdue ? 'text-destructive' : undefined}>
          {dueNow.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing due. Use “@today” or “@fri” in quick add to set due dates.</p>
          ) : (
            <ul>
              {dueNow.map((t) => (
                <TaskLine key={t.id} task={t} planner={planner} onOpen={() => onOpenTask(t)} />
              ))}
            </ul>
          )}
        </Section>

        <Section icon={CircleDashed} title="In flight" count={inProgress.length}>
          {inProgress.length === 0 ? (
            <p className="text-muted-foreground text-sm">No tasks in progress. Move one to “In progress” on the board when you start it.</p>
          ) : (
            <ul>
              {inProgress.map((t) => (
                <TaskLine key={t.id} task={t} planner={planner} onOpen={() => onOpenTask(t)} />
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Section icon={CheckCircle2} title="This week">
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tabular-nums">{doneThisWeek}</span>
              <span className="text-muted-foreground text-sm">done since Monday · {open.length} open</span>
            </div>
            <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={STATUSES.map((s) => `${s.label} ${tasks.filter((t) => t.status === s.id).length}`).join(', ')}>
              {STATUSES.map((s) => {
                const n = tasks.filter((t) => t.status === s.id).length;
                return n ? <div key={s.id} className={s.dot} style={{ flex: n }} /> : null;
              })}
            </div>
            <ul className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {STATUSES.map((s) => (
                <li key={s.id} className="flex items-center gap-1.5">
                  <StatusDot status={s.id} /> {s.label}
                  <span className="text-foreground ml-auto font-semibold tabular-nums">{tasks.filter((t) => t.status === s.id).length}</span>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {upcoming.length > 0 && (
          <Section icon={Video} title="Upcoming meetings">
            <ul className="flex flex-col gap-1">
              {upcoming.map((m) => (
                <li key={m.id}>
                  <button type="button" onClick={() => onOpenMeeting(m)} className="hover:bg-muted/50 -mx-2 flex w-full flex-col rounded-md px-2 py-1.5 text-left">
                    <span className="truncate text-sm font-medium">{m.title}</span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(m.start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · {formatRange(m.start, m.durationMin)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <PomodoroTimer />
      </div>
    </div>
  );
}
