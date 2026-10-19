import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, CircleAlert, ExternalLink, FilePlus2, GitBranch, Loader2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { apiFetch } from '../../../store/useAppStore';
import LoadingState, { ErrorMessage } from '../../layout/LoadingState';
import RepoContext from '../RepoContext';
import CodeEditor from './CodeEditor';
import FileTree, { type FsEntry } from './FileTree';

type OpenFile = {
  path: string;
  saved: string; // last content known to be on disk / remote
  content: string; // current editor content
  state: 'loading' | 'ready' | 'binary' | 'tooLarge' | 'error';
  error?: string;
};

type View = 'editor' | 'activity';

const baseName = (p: string) => p.split('/').pop() ?? p;

/** Code tab: file explorer + tabbed CodeMirror editor (editable for local repos, read-only for remote), plus repo activity. */
export default function CodeWorkspace({ focusProject }: { focusProject: string }) {
  const { resolved } = useTheme();
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('editor');

  const [entries, setEntries] = useState<Record<string, FsEntry[] | undefined>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<OpenFile[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isLocal = info?.active && info.type === true;
  const repo = info?.repo;
  const ready = info?.active && info.exists !== false;

  const filesRef = useRef(files);
  filesRef.current = files;
  const dirty = (f: OpenFile) => f.state === 'ready' && f.content !== f.saved;
  const anyDirty = files.some(dirty);

  // Load repo info whenever the focused project changes; reset the whole editor session.
  useEffect(() => {
    setEntries({});
    setExpanded(new Set());
    setFiles([]);
    setActive(null);
    setStatus({});
    setInfo(null);
    if (!focusProject) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    apiFetch('/api/focus/info')
      .then((r) => r.json())
      .then((d) => !cancelled && setInfo(d))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [focusProject]);

  const listDir = useCallback(
    async (dir: string): Promise<FsEntry[]> => {
      const url = isLocal
        ? `/api/focus/fs/list?path=${encodeURIComponent(dir)}`
        : `/api/focus/contents?owner=${repo.owner}&name=${repo.name}&path=${encodeURIComponent(dir)}`;
      const items = await (await apiFetch(url)).json();
      if (!Array.isArray(items)) throw new Error(items?.error ?? 'Cannot list directory');
      const mapped: FsEntry[] = items.map((i: any) => ({ name: i.name, path: i.path, type: i.type === 'dir' ? 'dir' : 'file' }));
      return isLocal ? mapped : mapped.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
    },
    [isLocal, repo],
  );

  const refreshStatus = useCallback(async () => {
    if (!isLocal) return;
    try {
      setStatus(await (await apiFetch('/api/focus/fs/status')).json());
    } catch {
      /* badges are best-effort */
    }
  }, [isLocal]);

  const loadDir = useCallback(
    async (dir: string) => {
      try {
        const items = await listDir(dir);
        setEntries((prev) => ({ ...prev, [dir]: items }));
      } catch (e: any) {
        toast.error(e.message);
        setEntries((prev) => ({ ...prev, [dir]: [] }));
      }
    },
    [listDir],
  );

  useEffect(() => {
    if (!ready) return;
    loadDir('');
    refreshStatus();
  }, [ready, loadDir, refreshStatus]);

  const toggleDir = (dir: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) next.delete(dir);
      else {
        next.add(dir);
        if (!entries[dir]) loadDir(dir);
      }
      return next;
    });
  };

  const patchFile = (path: string, patch: Partial<OpenFile>) => setFiles((fs) => fs.map((f) => (f.path === path ? { ...f, ...patch } : f)));

  const openFile = async (path: string) => {
    setView('editor');
    setActive(path);
    if (filesRef.current.some((f) => f.path === path)) return;
    setFiles((fs) => [...fs, { path, saved: '', content: '', state: 'loading' }]);
    try {
      if (isLocal) {
        const d = await (await apiFetch(`/api/focus/fs/read?path=${encodeURIComponent(path)}`)).json();
        if (d.error) throw new Error(d.error);
        if (d.binary) return patchFile(path, { state: 'binary' });
        if (d.tooLarge) return patchFile(path, { state: 'tooLarge' });
        patchFile(path, { state: 'ready', saved: d.content, content: d.content });
      } else {
        const d = await (await apiFetch(`/api/focus/contents?owner=${repo.owner}&name=${repo.name}&path=${encodeURIComponent(path)}`)).json();
        if (d.error) throw new Error(d.error);
        if (typeof d.decodedContent !== 'string') return patchFile(path, { state: 'binary' });
        patchFile(path, { state: 'ready', saved: d.decodedContent, content: d.decodedContent });
      }
    } catch (e: any) {
      patchFile(path, { state: 'error', error: e.message });
    }
  };

  const closeFile = (path: string) => {
    const f = filesRef.current.find((x) => x.path === path);
    if (f && dirty(f) && !window.confirm(`Discard unsaved changes to ${baseName(path)}?`)) return;
    const idx = filesRef.current.findIndex((x) => x.path === path);
    const rest = filesRef.current.filter((x) => x.path !== path);
    setFiles(rest);
    if (active === path) setActive(rest[Math.min(idx, rest.length - 1)]?.path ?? null);
  };

  const save = useCallback(
    async (path: string) => {
      if (!isLocal) return;
      const f = filesRef.current.find((x) => x.path === path);
      if (!f || f.state !== 'ready' || f.content === f.saved) return;
      const content = f.content;
      setSaving(true);
      try {
        const res = await apiFetch('/api/focus/fs/write', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path, content }),
        });
        const d = await res.json();
        if (!res.ok || d.error) throw new Error(d.error ?? 'Save failed');
        patchFile(path, { saved: content });
        refreshStatus();
      } catch (e: any) {
        toast.error(`Could not save ${baseName(path)}: ${e.message}`);
      } finally {
        setSaving(false);
      }
    },
    [isLocal, refreshStatus],
  );

  const newFile = async () => {
    const path = window.prompt('New file path (relative to the repo root)', active ? active.split('/').slice(0, -1).join('/') + '/' : '')?.trim().replace(/^\/+/, '');
    if (!path || path.endsWith('/')) return;
    try {
      const res = await apiFetch('/api/focus/fs/write', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content: '' }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error ?? 'Create failed');
      // Reveal the new file: refresh each ancestor directory and expand it.
      const parts = path.split('/');
      const dirs = parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/'));
      setExpanded((prev) => new Set([...prev, ...dirs]));
      await Promise.all(['', ...dirs].map(loadDir));
      refreshStatus();
      openFile(path);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Warn before leaving with unsaved work.
  useEffect(() => {
    if (!anyDirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [anyDirty]);

  const activeFile = files.find((f) => f.path === active) ?? null;
  const openPaths = useMemo(() => files.map((f) => f.path), [files]);

  if (loading) return <LoadingState label="Retrieving Workspace Context…" />;
  if (error) return <ErrorMessage>Failed to load focus workspace: {error}</ErrorMessage>;
  if (!ready) return <EmptyState title="No code to show" description="Focus a repository to browse and edit its code here." />;

  const issueCount = (Array.isArray(info.issues) ? info.issues.length : 0) + (Array.isArray(info.prs) ? info.prs.length : 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="bg-muted inline-flex rounded-lg p-0.5 text-sm">
          {(['editor', 'activity'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn('rounded-md px-3 py-1 font-medium capitalize', view === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              {v === 'activity' ? `Issues & PRs${issueCount ? ` · ${issueCount}` : ''}` : 'Editor'}
            </button>
          ))}
        </div>
        <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <GitBranch className="size-4" /> {repo?.branch || 'main'}
        </span>
        {!isLocal && (
          <span className="text-muted-foreground bg-muted rounded-full px-2 py-0.5 text-xs">Read-only · remote</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {isLocal && view === 'editor' && (
            <Button variant="secondary" size="sm" onClick={newFile}>
              <FilePlus2 /> New file
            </Button>
          )}
          {isLocal && view === 'editor' && (
            <Button size="sm" disabled={!activeFile || !dirty(activeFile) || saving} onClick={() => active && save(active)}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />} Save
            </Button>
          )}
          {!isLocal && repo?.owner && (
            <Button asChild variant="secondary" size="sm">
              <a href={`https://github.com/${repo.owner}/${repo.name}`} target="_blank" rel="noreferrer">
                GitHub <ExternalLink />
              </a>
            </Button>
          )}
        </div>
      </div>

      {view === 'activity' ? (
        <RepoContext data={info} />
      ) : (
        <div className="bg-card grid h-[calc(100vh-15rem)] min-h-[30rem] grid-cols-1 overflow-hidden rounded-xl border md:grid-cols-[16rem_minmax(0,1fr)]">
          <aside className="max-h-48 overflow-y-auto border-b p-2 md:max-h-none md:border-r md:border-b-0">
            <FileTree entries={entries} expanded={expanded} activePath={active} status={status} onToggle={toggleDir} onOpen={openFile} />
          </aside>

          <section className="flex min-h-0 min-w-0 flex-col">
            {files.length > 0 && (
              <div className="flex shrink-0 overflow-x-auto border-b" role="tablist">
                {files.map((f) => (
                  <div
                    key={f.path}
                    role="tab"
                    aria-selected={f.path === active}
                    onClick={() => setActive(f.path)}
                    onAuxClick={(e) => e.button === 1 && closeFile(f.path)}
                    title={f.path}
                    className={cn(
                      'group flex shrink-0 cursor-pointer items-center gap-2 border-r px-3 py-2 text-[13px]',
                      f.path === active ? 'bg-background text-foreground border-b-primary -mb-px border-b-2' : 'text-muted-foreground hover:bg-muted/60',
                    )}
                  >
                    <span className="max-w-40 truncate">{baseName(f.path)}</span>
                    {dirty(f) ? (
                      <span className="bg-primary size-2 rounded-full group-hover:hidden" aria-label="Unsaved changes" />
                    ) : null}
                    <button
                      type="button"
                      aria-label={`Close ${baseName(f.path)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        closeFile(f.path);
                      }}
                      className={cn('hover:bg-muted rounded p-0.5', dirty(f) && 'hidden group-hover:block')}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="min-h-0 flex-1">
              {!activeFile ? (
                <EmptyState title="Pick a file" description={isLocal ? 'Open a file from the explorer to read or edit it. Cmd/Ctrl+S saves.' : 'Open a file from the explorer to read it.'} />
              ) : activeFile.state === 'loading' ? (
                <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
                  <Loader2 className="size-4 animate-spin" /> Loading {baseName(activeFile.path)}…
                </div>
              ) : activeFile.state === 'ready' ? (
                <CodeEditor
                  path={activeFile.path}
                  value={activeFile.content}
                  dark={resolved === 'dark'}
                  readOnly={!isLocal}
                  openPaths={openPaths}
                  onChange={(p, v) => patchFile(p, { content: v })}
                  onSave={save}
                />
              ) : (
                <EmptyState
                  icon={CircleAlert}
                  title={activeFile.state === 'binary' ? 'Binary file' : activeFile.state === 'tooLarge' ? 'File too large' : 'Could not open file'}
                  description={activeFile.state === 'error' ? activeFile.error : 'This file cannot be shown in the editor.'}
                />
              )}
            </div>

            {activeFile?.state === 'ready' && (
              <div className="text-muted-foreground flex shrink-0 items-center gap-3 border-t px-3 py-1 text-xs">
                <span className="truncate">{activeFile.path}</span>
                <span className="ml-auto flex items-center gap-1">
                  {isLocal && (dirty(activeFile) ? 'Unsaved' : (<><Check className="size-3" /> Saved</>))}
                </span>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
