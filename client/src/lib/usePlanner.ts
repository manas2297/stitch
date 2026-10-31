import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '../store/useAppStore';
import type { Board, Meeting, MeetingPatch, Page, PagePatch, Task, TaskPatch } from './planner';

async function send(method: string, url: string, body?: unknown) {
  const res = await apiFetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const storage = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* best effort */
    }
  },
};

/**
 * One project's planner board with optimistic updates. Every mutation updates
 * local state first and rolls back (rethrowing) if the server rejects it.
 */
export function usePlanner(project: string) {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState('');
  const boardRef = useRef<Board | null>(null);
  boardRef.current = board;

  const load = useCallback(async () => {
    if (!project) return;
    setError('');
    try {
      const b: Board = await send('GET', `/api/focus/board?project=${encodeURIComponent(project)}`);
      setBoard(b);
      return b;
    } catch (err) {
      setError(err.message);
    }
  }, [project]);

  // The old Focus checklist and scratchpad lived in localStorage; import them once.
  const migrate = useCallback(
    async (b: Board) => {
      const flag = `stitch_planner_migrated_${project}`;
      if (storage.get(flag)) return;
      try {
        const legacy = JSON.parse(storage.get(`stitch_tasks_${project}`) || '[]');
        if (Array.isArray(legacy) && legacy.length && b.tasks.length === 0) {
          const created: Task[] = await send('POST', '/api/focus/tasks', {
            project,
            tasks: legacy
              .filter((t) => t?.text?.trim())
              .map((t) => ({ title: t.text.trim(), status: t.completed ? 'done' : 'todo' })),
          });
          setBoard((cur) => (cur ? { ...cur, tasks: [...cur.tasks, ...created] } : cur));
        }
        const scratch = storage.get(`stitch_scratchpad_${project}`);
        if (scratch?.trim() && b.pages.length === 0) {
          const page: Page = await send('POST', '/api/focus/pages', { project, title: 'Scratchpad', icon: '📝', content: scratch });
          setBoard((cur) => (cur ? { ...cur, pages: [page, ...cur.pages] } : cur));
        }
        storage.set(flag, new Date().toISOString());
      } catch {
        /* retry next time */
      }
    },
    [project],
  );

  useEffect(() => {
    setBoard(null);
    load().then((b) => b && migrate(b));
  }, [load, migrate]);

  // Refetch when the window regains focus, so edits made elsewhere (e.g. by Claude over MCP) show up.
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const optimistic = async <T,>(apply: (b: Board) => Board, request: () => Promise<T>, settle?: (b: Board, result: T) => Board) => {
    const before = boardRef.current;
    if (before) setBoard(apply(before));
    try {
      const result = await request();
      if (settle) setBoard((cur) => (cur ? settle(cur, result) : cur));
      return result;
    } catch (err) {
      setBoard(before);
      throw err;
    }
  };

  const replaceTask = (b: Board, t: Task) => ({ ...b, tasks: b.tasks.map((x) => (x.id === t.id ? t : x)) });
  const replaceMeeting = (b: Board, m: Meeting) => ({ ...b, meetings: b.meetings.map((x) => (x.id === m.id ? m : x)) });

  return {
    board,
    error,
    reload: load,

    createTasks: async (patches: TaskPatch[]) => {
      const created: Task[] = await send('POST', '/api/focus/tasks', { project, tasks: patches });
      setBoard((cur) => (cur ? { ...cur, tasks: [...cur.tasks, ...created] } : cur));
      return created;
    },
    updateTask: (id: string, patch: TaskPatch) =>
      optimistic(
        (b) => ({ ...b, tasks: b.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }),
        () => send('PATCH', `/api/focus/tasks/${id}`, patch) as Promise<Task>,
        replaceTask,
      ),
    deleteTask: (id: string) =>
      optimistic(
        (b) => ({ ...b, tasks: b.tasks.filter((t) => t.id !== id) }),
        () => send('DELETE', `/api/focus/tasks/${id}`),
      ),
    createIssue: async (id: string) => {
      const t: Task = await send('POST', `/api/focus/tasks/${id}/issue`);
      setBoard((cur) => (cur ? replaceTask(cur, t) : cur));
      return t;
    },

    createMeeting: async (patch: MeetingPatch) => {
      const m: Meeting = await send('POST', '/api/focus/meetings', { project, ...patch });
      setBoard((cur) => (cur ? { ...cur, meetings: [...cur.meetings, m].sort((a, b) => a.start.localeCompare(b.start)) } : cur));
      return m;
    },
    updateMeeting: (id: string, patch: MeetingPatch) =>
      optimistic(
        (b) => ({ ...b, meetings: b.meetings.map((m) => (m.id === id ? { ...m, ...patch } : m)) }),
        () => send('PATCH', `/api/focus/meetings/${id}`, patch) as Promise<Meeting>,
        replaceMeeting,
      ),
    deleteMeeting: (id: string) =>
      optimistic(
        (b) => ({ ...b, meetings: b.meetings.filter((m) => m.id !== id) }),
        () => send('DELETE', `/api/focus/meetings/${id}`),
      ),

    createPage: async (patch: PagePatch = {}) => {
      const page: Page = await send('POST', '/api/focus/pages', { project, ...patch });
      setBoard((cur) => (cur ? { ...cur, pages: [page, ...cur.pages] } : cur));
      return page;
    },
    updatePage: (id: string, patch: PagePatch) =>
      optimistic(
        (b) => ({ ...b, pages: b.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)) }),
        () => send('PATCH', `/api/focus/pages/${id}`, patch) as Promise<Page>,
        (b, page) => ({ ...b, pages: b.pages.map((p) => (p.id === page.id ? page : p)) }),
      ),
    deletePage: (id: string) =>
      optimistic(
        (b) => ({ ...b, pages: b.pages.filter((p) => p.id !== id) }),
        () => send('DELETE', `/api/focus/pages/${id}`),
      ),
  };
}

export type Planner = ReturnType<typeof usePlanner>;
