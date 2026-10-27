import { useEffect, useState, type ReactNode } from 'react';
import { AlarmClock, CalendarClock, Check, ChevronsUpDown, GitBranch, Globe, Laptop, ListTodo, Plus, Video } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toDateStr } from '@/lib/contributions';
import { isFocusRepo, repoFocusValue } from '@/lib/focus';
import { formatTime, isOverdue, isUrl, openExternal, todayStr, type Meeting, type Task, type TaskPatch } from '@/lib/planner';
import { cn } from '@/lib/utils';
import QuickAdd from './QuickAdd';

const repoLabel = (r) => (r.path ? r.path.split('/').pop() : `${r.owner}/${r.name}`);

/** Project name doubles as the switcher; local and GitHub repos are grouped. */
export function ProjectSwitcher({ repos, focusProject, onSwitch, children }: { repos: any[]; focusProject: string; onSwitch: (v: string) => void; children: ReactNode }) {
  const local = repos.filter((r) => r.path);
  const remote = repos.filter((r) => !r.path);
  const item = (r) => (
    <DropdownMenuItem key={repoFocusValue(r)} onSelect={() => onSwitch(repoFocusValue(r))} className="gap-2">
      {r.path ? <Laptop /> : <Globe />}
      <span className="truncate">{repoLabel(r)}</span>
      {isFocusRepo(r, focusProject) && <Check className="ml-auto" />}
    </DropdownMenuItem>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-96 w-72 overflow-y-auto">
        {local.length > 0 && <DropdownMenuLabel className="text-muted-foreground text-xs">Local clones</DropdownMenuLabel>}
        {local.map(item)}
        {local.length > 0 && remote.length > 0 && <DropdownMenuSeparator />}
        {remote.length > 0 && <DropdownMenuLabel className="text-muted-foreground text-xs">GitHub</DropdownMenuLabel>}
        {remote.map(item)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Stat({ icon: Icon, value, label, tone, onClick }: { icon: typeof ListTodo; value: ReactNode; label: string; tone?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="hover:bg-muted/60 flex w-full min-w-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors disabled:hover:bg-transparent"
    >
      <span className={cn('bg-muted inline-flex size-8 shrink-0 items-center justify-center rounded-md', tone)}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm leading-tight font-semibold tabular-nums">{value}</span>
        <span className="text-muted-foreground block truncate text-xs">{label}</span>
      </span>
    </button>
  );
}

/** "now", "in 25m", "at 16:00", "Wed 16:00" relative to the current time. */
function whenLabel(m: Meeting, now: number) {
  const start = new Date(m.start).getTime();
  if (now >= start) return 'happening now';
  const mins = Math.round((start - now) / 60000);
  if (mins < 60) return `in ${mins}m`;
  if (toDateStr(new Date(m.start)) === todayStr()) return `today ${formatTime(m.start)}`;
  return new Date(m.start).toLocaleDateString(undefined, { weekday: 'short' }) + ' ' + formatTime(m.start);
}

export default function FocusHeader({
  repo,
  repos,
  focusProject,
  onSwitch,
  tasks,
  meetings,
  onCreateTasks,
  onNewMeeting,
  onOpenMeeting,
  onGoTo,
}: {
  repo: any;
  repos: any[];
  focusProject: string;
  onSwitch: (v: string) => void;
  tasks: Task[];
  meetings: Meeting[];
  onCreateTasks: (p: TaskPatch[]) => Promise<unknown>;
  onNewMeeting: () => void;
  onOpenMeeting: (m: Meeting) => void;
  onGoTo: (tab: 'today' | 'tasks' | 'calendar') => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const today = todayStr();
  const open = tasks.filter((t) => t.status !== 'done');
  const inProgress = open.filter((t) => t.status === 'in-progress').length;
  const overdue = tasks.filter(isOverdue).length;
  const dueToday = open.filter((t) => t.dueDate === today).length;
  const meetingsToday = meetings.filter((m) => toDateStr(new Date(m.start)) === today).length;
  const next = meetings.find((m) => new Date(m.start).getTime() + m.durationMin * 60000 > now);
  const live = next && new Date(next.start).getTime() <= now;

  return (
    <header className="mb-5 flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="bg-primary/10 text-primary inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold uppercase">
            {repoLabel(repo).replace(/^.*\//, '').slice(0, 2)}
          </span>
          <div className="min-w-0">
            <ProjectSwitcher repos={repos} focusProject={focusProject} onSwitch={onSwitch}>
              <button type="button" className="hover:bg-muted/60 -ml-1.5 flex max-w-full items-center gap-1.5 rounded-md px-1.5 text-left" aria-label="Switch project">
                <h2 className="truncate text-2xl font-bold tracking-tight">{repoLabel(repo)}</h2>
                <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
              </button>
            </ProjectSwitcher>
            <div className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
              <span className="inline-flex min-w-0 items-center gap-1">
                {repo.path ? <Laptop className="size-3.5 shrink-0" /> : <Globe className="size-3.5 shrink-0" />}
                <span className="truncate font-mono">{repo.path || `github.com/${repo.owner}/${repo.name}`}</span>
              </span>
              {repo.path && repo.branch && (
                <span className="inline-flex items-center gap-1 font-mono">
                  <GitBranch className="size-3.5" /> {repo.branch}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Popover open={adding} onOpenChange={setAdding}>
            <PopoverTrigger asChild>
              <Button size="sm">
                <Plus /> Task
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96">
              <QuickAdd
                autoFocus
                onCreate={async (p) => {
                  await onCreateTasks(p);
                  setAdding(false);
                }}
              />
              <p className="text-muted-foreground mt-2 text-xs">
                <code>!high</code> priority · <code>#tag</code> · <code>@fri</code> due date
              </p>
            </PopoverContent>
          </Popover>
          <Button size="sm" variant="outline" onClick={onNewMeeting}>
            <Video /> Meeting
          </Button>
        </div>
      </div>

      <div className="bg-card grid grid-cols-2 gap-1 rounded-xl border p-1 shadow-xs lg:grid-cols-4">
        <Stat icon={ListTodo} value={open.length} label={inProgress ? `open · ${inProgress} in progress` : 'open tasks'} onClick={() => onGoTo('tasks')} />
        <Stat
          icon={AlarmClock}
          value={overdue ? `${overdue} overdue` : dueToday}
          label={overdue ? `${dueToday} due today` : 'due today'}
          tone={overdue ? 'bg-destructive/12 text-destructive' : undefined}
          onClick={() => onGoTo('today')}
        />
        <Stat icon={CalendarClock} value={meetingsToday} label={meetingsToday === 1 ? 'meeting today' : 'meetings today'} onClick={() => onGoTo('calendar')} />
        {next ? (
          <div className="flex min-w-0 items-center gap-1">
            <div className="min-w-0 flex-1">
              <Stat icon={Video} value={next.title} label={`Next · ${whenLabel(next, now)}`} tone={live ? 'bg-destructive/12 text-destructive' : 'bg-violet/12 text-violet'} onClick={() => onOpenMeeting(next)} />
            </div>
            {isUrl(next.location) && (
              <Button size="xs" variant={live ? 'default' : 'outline'} className="mr-2 shrink-0" onClick={() => openExternal(next.location.trim())}>
                Join
              </Button>
            )}
          </div>
        ) : (
          <Stat icon={Video} value="No meetings" label="nothing scheduled ahead" onClick={onNewMeeting} />
        )}
      </div>
    </header>
  );
}
