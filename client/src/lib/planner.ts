import { addDays, parseDateStr, toDateStr } from './contributions';

export type Status = 'backlog' | 'todo' | 'in-progress' | 'review' | 'blocked' | 'done';
export type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'none';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  project: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  tags: string[];
  dueDate?: string;
  scheduledAt?: string;
  durationMin?: number;
  checklist: ChecklistItem[];
  order: number;
  githubIssueUrl?: string;
  meetingId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface Meeting {
  id: string;
  project: string;
  title: string;
  start: string;
  durationMin: number;
  location: string;
  attendees: string[];
  agenda: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Page {
  id: string;
  project: string;
  title: string;
  icon: string;
  /** Editor JSON document, or plain text for pages migrated from the old scratchpad */
  content: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Board {
  tasks: Task[];
  meetings: Meeting[];
  pages: Page[];
}

export type PagePatch = Partial<Pick<Page, 'title' | 'icon' | 'content' | 'pinned'>>;

export type TaskPatch = Partial<Omit<Task, 'id' | 'project' | 'createdAt' | 'updatedAt' | 'completedAt'>>;
export type MeetingPatch = Partial<Omit<Meeting, 'id' | 'project' | 'createdAt' | 'updatedAt'>>;

// ── Status & priority ─────────────────────────────────────────────────────

export const STATUSES: { id: Status; label: string; dot: string; text: string }[] = [
  { id: 'backlog', label: 'Backlog', dot: 'bg-muted-foreground/40', text: 'text-muted-foreground' },
  { id: 'todo', label: 'To do', dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
  { id: 'in-progress', label: 'In progress', dot: 'bg-primary', text: 'text-primary' },
  { id: 'review', label: 'In review', dot: 'bg-violet', text: 'text-violet' },
  { id: 'blocked', label: 'Blocked', dot: 'bg-destructive', text: 'text-destructive' },
  { id: 'done', label: 'Done', dot: 'bg-success', text: 'text-success' },
];
export const STATUS_BY_ID = Object.fromEntries(STATUSES.map((s) => [s.id, s])) as Record<Status, (typeof STATUSES)[number]>;

export const PRIORITIES: { id: Priority; label: string; cls: string; rank: number }[] = [
  { id: 'urgent', label: 'Urgent', cls: 'bg-destructive/12 text-destructive', rank: 0 },
  { id: 'high', label: 'High', cls: 'bg-warning/15 text-warning', rank: 1 },
  { id: 'medium', label: 'Medium', cls: 'bg-primary/10 text-primary', rank: 2 },
  { id: 'low', label: 'Low', cls: 'bg-muted text-muted-foreground', rank: 3 },
  { id: 'none', label: 'No priority', cls: 'bg-muted text-muted-foreground', rank: 4 },
];
export const PRIORITY_BY_ID = Object.fromEntries(PRIORITIES.map((p) => [p.id, p])) as Record<Priority, (typeof PRIORITIES)[number]>;

export const checklistProgress = (t: Task) => ({ done: t.checklist.filter((c) => c.done).length, total: t.checklist.length });

// ── Dates (local calendar) ────────────────────────────────────────────────

export const todayStr = () => toDateStr(new Date());

/** RFC3339 with the local offset, e.g. 2026-10-20T14:30:00+05:30 — what the API stores. */
export function toLocalISO(d: Date) {
  const pad = (n: number) => String(Math.abs(Math.trunc(n))).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${toDateStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${sign}${pad(off / 60)}:${pad(off % 60)}`;
}

/** Value for <input type="datetime-local"> from an ISO string. */
export const toInputDateTime = (iso?: string) => (iso ? toLocalISO(new Date(iso)).slice(0, 16) : '');
export const fromInputDateTime = (v: string) => (v ? toLocalISO(new Date(v)) : '');

export function startOfWeek(dateStr: string) {
  const d = parseDateStr(dateStr);
  return addDays(dateStr, -((d.getDay() + 6) % 7)); // Monday-first
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatRange(iso: string, minutes: number) {
  const end = new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
  return `${formatTime(iso)} – ${formatTime(end)}`;
}

export const isOverdue = (t: Task) => t.status !== 'done' && !!t.dueDate && t.dueDate < todayStr();

export function relativeDue(dateStr: string) {
  const today = todayStr();
  if (dateStr === today) return 'Today';
  if (dateStr === addDays(today, 1)) return 'Tomorrow';
  if (dateStr === addDays(today, -1)) return 'Yesterday';
  return parseDateStr(dateStr).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── Quick add: "Fix login !high #auth @tomorrow" ──────────────────────────

const PRIORITY_ALIASES: Record<string, Priority> = {
  urgent: 'urgent', u: 'urgent', p0: 'urgent',
  high: 'high', h: 'high', p1: 'high',
  medium: 'medium', med: 'medium', m: 'medium', p2: 'medium',
  low: 'low', l: 'low', p3: 'low',
};
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function parseDueToken(token: string): string | undefined {
  const t = token.toLowerCase();
  const today = todayStr();
  if (t === 'today') return today;
  if (t === 'tomorrow' || t === 'tmr') return addDays(today, 1);
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const rel = t.match(/^\+(\d+)([dw])$/);
  if (rel) return addDays(today, Number(rel[1]) * (rel[2] === 'w' ? 7 : 1));
  const wd = WEEKDAYS.findIndex((d) => t.startsWith(d));
  if (wd >= 0 && t.length >= 3) {
    const diff = (wd - parseDateStr(today).getDay() + 7) % 7 || 7; // next occurrence, never today
    return addDays(today, diff);
  }
  return undefined;
}

export function parseQuickAdd(input: string): TaskPatch & { title: string } {
  const tags: string[] = [];
  let priority: Priority | undefined;
  let dueDate: string | undefined;
  const words = input.split(/\s+/).filter((w) => {
    if (/^#[\w-]+$/.test(w)) {
      tags.push(w.slice(1));
      return false;
    }
    if (w.startsWith('!') && PRIORITY_ALIASES[w.slice(1).toLowerCase()]) {
      priority = PRIORITY_ALIASES[w.slice(1).toLowerCase()];
      return false;
    }
    if (w.startsWith('@')) {
      const due = parseDueToken(w.slice(1));
      if (due) {
        dueDate = due;
        return false;
      }
    }
    return true;
  });
  return {
    title: words.join(' ').trim(),
    ...(tags.length ? { tags } : {}),
    ...(priority ? { priority } : {}),
    ...(dueDate ? { dueDate } : {}),
  };
}

// ── Meetings ──────────────────────────────────────────────────────────────

const gcalStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function googleCalendarUrl(m: Meeting, project: string) {
  const start = new Date(m.start);
  const end = new Date(start.getTime() + m.durationMin * 60000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: m.title,
    dates: `${gcalStamp(start)}/${gcalStamp(end)}`,
    details: [m.agenda, `Project: ${project}`].filter(Boolean).join('\n\n'),
  });
  if (m.location) params.set('location', m.location);
  if (m.attendees.length) params.set('add', m.attendees.join(','));
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Action items in meeting notes: "- [ ] text", "TODO: text" or "Action: text". */
export function extractActionItems(notes: string) {
  const items: string[] = [];
  for (const line of notes.split('\n')) {
    const m = line.match(/^\s*(?:[-*]\s*\[\s\]\s+|(?:todo|action|ai)\s*:\s*)(.+)$/i);
    if (m && m[1].trim()) items.push(m[1].trim());
  }
  return items;
}

export const isUrl = (s: string) => /^https?:\/\//i.test(s.trim());

/** Absolute API URL for links the browser or desktop shell opens directly. */
export function apiUrl(path: string) {
  const isDesktop = (window as any).go !== undefined || import.meta.env.PROD;
  return `${isDesktop ? 'http://127.0.0.1:4000' : window.location.origin}${path}`;
}

/** Open a URL in the system browser (desktop) or a new tab (web). */
export function openExternal(url: string) {
  const app = (window as any).go?.desktop?.App;
  if (app?.OpenURL) app.OpenURL(url);
  else window.open(url, '_blank', 'noopener');
}
