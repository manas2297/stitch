import { apiFetch } from '../../store/useAppStore';

export interface DrawingInfo {
  name: string;
  modified: string;
  size: number;
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body as T;
}

const qs = (repo: string, name?: string) =>
  `?repo=${encodeURIComponent(repo)}${name !== undefined ? `&name=${encodeURIComponent(name)}` : ''}`;

export const listDrawings = (repo: string) =>
  apiFetch(`/api/diagrams${qs(repo)}`).then((r) => json<{ dir: string; files: DrawingInfo[] }>(r));

export const createDrawing = (repo: string, name: string, scene?: unknown) =>
  apiFetch('/api/diagrams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo, name, scene }),
  }).then((r) => json<{ name: string }>(r));

export const loadDrawing = (repo: string, name: string) =>
  apiFetch(`/api/diagrams/file${qs(repo, name)}`).then((r) => json<any>(r));

const inFlight = new Set<Promise<unknown>>();

export function saveDrawing(repo: string, name: string, sceneJSON: string) {
  const p = apiFetch(`/api/diagrams/file${qs(repo, name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: sceneJSON,
  }).then((r) => json<{ saved: string }>(r));
  inFlight.add(p);
  p.finally(() => inFlight.delete(p)).catch(() => {});
  return p;
}

/** Resolves once saves already started (including a board's flush-on-unmount) have finished. */
export async function settleSaves() {
  await new Promise((r) => setTimeout(r, 50)); // let a just-unmounted board start its flush
  await Promise.allSettled([...inFlight]);
}

export const renameDrawing = (repo: string, from: string, to: string) =>
  apiFetch('/api/diagrams/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo, from, to }),
  }).then((r) => json<{ name: string }>(r));

export const deleteDrawing = (repo: string, name: string) =>
  apiFetch(`/api/diagrams/file${qs(repo, name)}`, { method: 'DELETE' }).then((r) => json(r));

export const loadLibrary = () => apiFetch('/api/diagrams/library').then((r) => json<any>(r));

export const saveLibrary = (libJSON: string) =>
  apiFetch('/api/diagrams/library', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: libJSON,
  }).then((r) => json(r));
