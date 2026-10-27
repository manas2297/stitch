import { lazy, Suspense, useState } from 'react';
import { CalendarRange, ChevronsUpDown, Code2, Kanban, NotebookPen, RefreshCw, Sun, Target } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toDateStr } from '@/lib/contributions';
import { isFocusRepo } from '@/lib/focus';
import { isOverdue, toLocalISO, todayStr, type Meeting, type Task } from '@/lib/planner';
import { usePlanner } from '@/lib/usePlanner';
import useAppStore from '../store/useAppStore';
import CalendarView from './focus/CalendarView';
import FocusHeader, { ProjectSwitcher } from './focus/FocusHeader';
import MeetingDialog, { type MeetingTarget } from './focus/MeetingDialog';
import NotesWorkspace from './focus/notes/NotesWorkspace';
import TaskBoard from './focus/TaskBoard';
import TaskDrawer from './focus/TaskDrawer';
import TodayView from './focus/TodayView';
import { ErrorMessage } from './layout/LoadingState';

// CodeMirror and its language packs are only needed on the Code tab.
const CodeWorkspace = lazy(() => import('./focus/code/CodeWorkspace'));

type Tab = 'today' | 'tasks' | 'calendar' | 'notes' | 'code';
const TAB_KEY = 'stitch.focus.tab';

/** Next half hour from now — the default start for a new meeting. */
function nextHalfHour() {
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return toLocalISO(d);
}

// Underline tabs: full-width rule with a primary indicator on the active tab.
// No focus box: clicking focuses the tab, so keyboard focus is shown as a faint underline instead.
const TAB_TRIGGER =
  'flex-none gap-1.5 px-1 pb-2.5 text-sm after:bg-primary group-data-[orientation=horizontal]/tabs:after:bottom-[-1px] data-[state=active]:text-foreground focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none focus-visible:text-foreground focus-visible:after:opacity-40 data-[state=active]:focus-visible:after:opacity-100';

function Planner({ repo, repos, project, projectLabel, hasRemote, onSwitch }: { repo: any; repos: any[]; project: string; projectLabel: string; hasRemote: boolean; onSwitch: (v: string) => void }) {
  const planner = usePlanner(project);
  const [tab, setTab] = useState<Tab>(() => {
    try {
      return (localStorage.getItem(TAB_KEY) as Tab) || 'today';
    } catch {
      return 'today';
    }
  });
  const [taskId, setTaskId] = useState<string | null>(null);
  const [meetingTarget, setMeetingTarget] = useState<MeetingTarget | null>(null);

  const changeTab = (t: string) => {
    setTab(t as Tab);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* preference only */
    }
  };

  const tasks = planner.board?.tasks ?? [];
  const meetings = planner.board?.meetings ?? [];
  const openTask = (t: Task) => setTaskId(t.id);
  const openMeeting = (m: Meeting) => setMeetingTarget({ meeting: m });
  const newMeeting = (start: string) => setMeetingTarget({ start });

  const open = tasks.filter((t) => t.status !== 'done').length;
  const overdue = tasks.filter(isOverdue).length;
  const today = todayStr();
  const meetingsToday = meetings.filter((m) => toDateStr(new Date(m.start)) === today).length;

  if (planner.error && !planner.board) {
    return (
      <div className="flex flex-col items-start gap-3">
        <ErrorMessage>Couldn't load the planner: {planner.error}</ErrorMessage>
        <Button variant="secondary" onClick={() => planner.reload()}>
          <RefreshCw /> Try again
        </Button>
      </div>
    );
  }

  const shared = { tasks, meetings, planner };

  return (
    <>
      <FocusHeader
        repo={repo}
        repos={repos}
        focusProject={project}
        onSwitch={onSwitch}
        tasks={tasks}
        meetings={meetings}
        onCreateTasks={planner.createTasks}
        onNewMeeting={() => newMeeting(nextHalfHour())}
        onOpenMeeting={openMeeting}
        onGoTo={changeTab}
      />
      <Tabs value={tab} onValueChange={changeTab}>
        <div className="mb-5 overflow-x-auto border-b">
          <TabsList variant="line" className="h-auto w-max gap-6 p-0">
            <TabsTrigger value="today" className={TAB_TRIGGER}>
              <Sun /> Today
              {overdue > 0 && <span className="bg-destructive/15 text-destructive rounded-full px-1.5 text-[0.65rem] font-bold tabular-nums">{overdue}</span>}
            </TabsTrigger>
            <TabsTrigger value="tasks" className={TAB_TRIGGER}>
              <Kanban /> Tasks <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[0.65rem] font-semibold tabular-nums">{open}</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className={TAB_TRIGGER}>
              <CalendarRange /> Calendar
              {meetingsToday > 0 && <span className="bg-violet/12 text-violet rounded-full px-1.5 text-[0.65rem] font-semibold tabular-nums">{meetingsToday}</span>}
            </TabsTrigger>
            <TabsTrigger value="notes" className={TAB_TRIGGER}>
              <NotebookPen /> Notes
            </TabsTrigger>
            <TabsTrigger value="code" className={TAB_TRIGGER}>
              <Code2 /> Code
            </TabsTrigger>
          </TabsList>
        </div>

        {!planner.board && tab !== 'code' ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-10 w-full max-w-md" />
            <Skeleton className="h-80 w-full" />
          </div>
        ) : (
          <>
            <TabsContent value="today">
              <TodayView {...shared} onOpenTask={openTask} onOpenMeeting={openMeeting} />
            </TabsContent>
            <TabsContent value="tasks">
              <TaskBoard tasks={tasks} planner={planner} onOpen={openTask} />
            </TabsContent>
            <TabsContent value="calendar">
              <CalendarView {...shared} onOpenTask={openTask} onOpenMeeting={openMeeting} onNewMeeting={newMeeting} />
            </TabsContent>
            <TabsContent value="notes">{planner.board && <NotesWorkspace planner={planner} project={project} />}</TabsContent>
          </>
        )}
        <TabsContent value="code">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <CodeWorkspace focusProject={project} />
          </Suspense>
        </TabsContent>
      </Tabs>

      <TaskDrawer
        task={tasks.find((t) => t.id === taskId) ?? null}
        planner={planner}
        meetings={meetings}
        hasRemote={hasRemote}
        onClose={() => setTaskId(null)}
        onOpenMeeting={(m) => {
          setTaskId(null);
          openMeeting(m);
        }}
      />
      <MeetingDialog target={meetingTarget} planner={planner} projectLabel={projectLabel} tasks={tasks} onClose={() => setMeetingTarget(null)} />
    </>
  );
}

export default function FocusWorkspace() {
  const repos = useAppStore((s) => s.repos);
  const focusProject = useAppStore((s) => s.focusProject);
  const setFocusProject = useAppStore((s) => s.setFocusProject);
  const repo = repos.find((r) => isFocusRepo(r, focusProject));
  const label = repo ? (repo.path ? repo.path.split('/').pop() : `${repo.owner}/${repo.name}`) : '';

  return (
    <section id="focus-section">
      {!focusProject || !repo ? (
        <EmptyState
          icon={Target}
          title="Pick a project to focus on"
          description="Plan tasks, block time on the calendar and run meetings for the project you're working on."
          action={
            <ProjectSwitcher repos={repos} focusProject={focusProject} onSwitch={setFocusProject}>
              <Button>
                Choose a project <ChevronsUpDown />
              </Button>
            </ProjectSwitcher>
          }
        />
      ) : (
        // Keyed so every per-project state (drawer, dialogs, notes draft) resets on switch.
        <Planner
          key={focusProject}
          repo={repo}
          repos={repos}
          project={focusProject}
          projectLabel={label}
          hasRemote={!!(repo.owner && repo.name)}
          onSwitch={setFocusProject}
        />
      )}
    </section>
  );
}
