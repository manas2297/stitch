import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  Copy,
  FileUp,
  FolderOpen,
  Loader2,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Shapes,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { confirmDialog } from '../helper/confirm';
import useAppStore from '../store/useAppStore';
import { timeAgo } from './ai-monitor/format';
import {
  createDrawing,
  deleteDrawing,
  listDrawings,
  loadDrawing,
  renameDrawing,
  settleSaves,
  type DrawingInfo,
} from './architecture/api';
import { EXT, nameFromFile, parseImportedScene } from './architecture/stitchdraw';
import LoadingState, { ErrorMessage } from './layout/LoadingState';
import RepoSelect from './layout/RepoSelect';
import { useToast } from './Toast';

// The editor (~2 MB plus global CSS) loads only when this tab is opened.
const StitchDrawBoard = lazy(() => import('./architecture/StitchDrawBoard'));

const PREFS_KEY = 'stitch.architecture';

type NameDialog = { mode: 'new' | 'rename' | 'duplicate'; from?: string; value: string } | null;

function readPrefs(): { repo?: string; drawing?: Record<string, string> } {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
  } catch {
    return {};
  }
}

function writePrefs(repo: string, drawing: string | null) {
  try {
    const prefs = readPrefs();
    prefs.repo = repo;
    prefs.drawing = { ...prefs.drawing, [repo]: drawing ?? '' };
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* per-viewer convenience only */
  }
}

function uniqueName(base: string, files: DrawingInfo[]) {
  const taken = new Set(files.map((f) => f.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base} ${i}`.toLowerCase())) return `${base} ${i}`;
}

export default function Architecture() {
  const toast = useToast();
  const repos = useAppStore((s) => s.repos);
  const [repo, setRepo] = useState<string>(() => readPrefs().repo ?? '');
  const [files, setFiles] = useState<DrawingInfo[]>([]);
  const [dir, setDir] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const [scene, setScene] = useState<any>(null);
  const [listLoading, setListLoading] = useState(true);
  const [sceneLoading, setSceneLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(() => window.innerWidth >= 768);
  const [dialog, setDialog] = useState<NameDialog>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async (scope: string) => {
    const res = await listDrawings(scope);
    setFiles(res.files);
    setDir(res.dir);
    return res.files;
  }, []);

  // Load the list when the scope changes, then reopen the last drawing used in that scope.
  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    setError(null);
    setActive(null);
    setScene(null);
    refresh(repo)
      .then((list) => {
        if (cancelled) return;
        const remembered = readPrefs().drawing?.[repo];
        const pick = list.find((f) => f.name === remembered) ?? list[0];
        setActive(pick?.name ?? null);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setListLoading(false));
    return () => {
      cancelled = true;
    };
  }, [repo, refresh]);

  // Refetch the list when the window regains focus, so drawings created over MCP show up.
  useEffect(() => {
    const onFocus = () => refresh(repo).catch(() => {});
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [repo, refresh]);

  useEffect(() => {
    writePrefs(repo, active);
    if (!active) return;
    let cancelled = false;
    setSceneLoading(true);
    setScene(null);
    loadDrawing(repo, active)
      .then((s) => !cancelled && setScene(s))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setSceneLoading(false));
    return () => {
      cancelled = true;
    };
  }, [repo, active]);

  const onSaved = useCallback(() => {
    const now = new Date().toISOString();
    setFiles((list) => list.map((f) => (f.name === active ? { ...f, modified: now } : f)));
  }, [active]);

  const submitDialog = async () => {
    if (!dialog) return;
    const value = dialog.value.trim();
    if (!value) return;
    try {
      if (dialog.mode === 'new') {
        const { name } = await createDrawing(repo, value);
        await refresh(repo);
        setActive(name);
      } else if (dialog.mode === 'rename' && dialog.from) {
        if (value !== dialog.from) {
          // Unmount the board first so its pending save lands on the old name before the rename.
          const wasActive = active === dialog.from;
          if (wasActive) setActive(null);
          await settleSaves();
          const { name } = await renameDrawing(repo, dialog.from, value);
          await refresh(repo);
          if (wasActive) setActive(name);
        }
      } else if (dialog.mode === 'duplicate' && dialog.from) {
        await settleSaves(); // include a save that is already in flight
        const source = await loadDrawing(repo, dialog.from);
        const { name } = await createDrawing(repo, value, source);
        await refresh(repo);
        setActive(name);
      }
      setDialog(null);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const remove = async (name: string) => {
    if (!(await confirmDialog('Delete drawing', `Delete "${name}"? This removes the ${EXT} file from disk.`))) return;
    try {
      if (active === name) setActive(null);
      await settleSaves(); // a flushed save must not recreate the file after deletion
      await deleteDrawing(repo, name);
      const list = await refresh(repo);
      if (active === name) setActive(list[0]?.name ?? null);
      toast(`Deleted "${name}"`, 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  // Each imported file becomes a new .stitchdraw drawing; legacy .excalidraw files are converted.
  const importFiles = async (picked: File[]) => {
    let list = files;
    let last: string | null = null;
    for (const file of picked) {
      try {
        const scene = parseImportedScene(await file.text());
        const { name } = await createDrawing(repo, uniqueName(nameFromFile(file.name), list), scene);
        list = [...list, { name, modified: new Date().toISOString(), size: file.size }];
        last = name;
      } catch (e) {
        toast(`${file.name}: ${e.message}`, 'error');
      }
    }
    if (last) {
      await refresh(repo);
      setActive(last);
      toast(picked.length > 1 ? `Imported ${picked.length} drawings` : `Imported "${last}"`, 'success');
    }
  };

  const openImport = () => fileInput.current?.click();

  const openNew = () => setDialog({ mode: 'new', value: uniqueName('Untitled', files) });

  return (
    <section
      id="architecture-section"
      className="flex min-w-0 h-[calc(100dvh-3.5rem-1.5rem)] flex-col gap-3 sm:h-[calc(100dvh-3.5rem-2.5rem)] lg:h-[calc(100dvh-3.5rem-4rem)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setListOpen((o) => !o)}
            aria-label={listOpen ? 'Hide drawings' : 'Show drawings'}
          >
            {listOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
          </Button>
          <h2 className="truncate text-xl font-bold tracking-tight sm:text-2xl">Architecture</h2>
          {active && <span className="text-muted-foreground hidden truncate text-sm sm:inline">/ {active}</span>}
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="min-w-0 flex-1 sm:flex-none">
            <RepoSelect repos={repos} value={repo} onChange={setRepo} allLabel="Personal drawings" />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={openImport}
            disabled={listLoading}
            aria-label="Import drawing"
          >
            <FileUp /> <span className="hidden sm:inline">Import</span>
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".stitchdraw,.excalidraw,application/json"
            multiple
            hidden
            onChange={(e) => {
              const picked = [...(e.target.files ?? [])];
              e.target.value = '';
              if (picked.length) importFiles(picked);
            }}
          />
          <Button size="sm" className="shrink-0" onClick={openNew} disabled={listLoading}>
            <Plus /> New drawing
          </Button>
        </div>
      </div>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      <div className="flex min-h-0 flex-1 gap-3">
        {listOpen && (
          <aside className="bg-card flex w-56 shrink-0 flex-col overflow-hidden rounded-lg border">
            <div className="text-muted-foreground border-b px-3 py-2 text-[0.7rem] font-semibold tracking-wider uppercase">
              Drawings {files.length > 0 && `· ${files.length}`}
            </div>
            <ul className="flex-1 overflow-y-auto p-1.5">
              {listLoading && <LoadingState label="Loading…" />}
              {!listLoading && files.length === 0 && (
                <li className="text-muted-foreground px-2 py-6 text-center text-xs">No drawings yet.</li>
              )}
              {files.map((f) => (
                <li key={f.name}>
                  <div
                    className={cn(
                      'group flex items-center gap-1 rounded-md pr-1 transition-colors',
                      active === f.name ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setActive(f.name)}
                      className="min-w-0 flex-1 px-2 py-1.5 text-left"
                      aria-current={active === f.name ? 'true' : undefined}
                    >
                      <div className="truncate text-sm font-medium">{f.name}</div>
                      <div className="text-muted-foreground text-[0.7rem]">{timeAgo(f.modified)}</div>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="opacity-60 group-hover:opacity-100"
                          aria-label={`Actions for ${f.name}`}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setDialog({ mode: 'rename', from: f.name, value: f.name })}>
                          <Pencil /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setDialog({ mode: 'duplicate', from: f.name, value: uniqueName(`${f.name} copy`, files) })}
                        >
                          <Copy /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => remove(f.name)}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              ))}
            </ul>
            {dir && (
              <div className="text-muted-foreground flex items-start gap-1.5 border-t px-3 py-2 text-[0.65rem] leading-snug" title={dir}>
                <FolderOpen className="mt-px size-3 shrink-0" />
                <span className="break-all">{dir}</span>
              </div>
            )}
          </aside>
        )}

        <div className="bg-card relative min-w-0 flex-1 overflow-hidden rounded-lg border">
          {!listLoading && !active && (
            <EmptyState
              icon={Shapes}
              className="h-full"
              title="No drawing open"
              description={`Create a drawing to sketch services, data flows and infrastructure with StitchDraw. Drawings autosave as ${EXT} files.`}
              action={
                <Button onClick={openNew}>
                  <Plus /> New drawing
                </Button>
              }
            />
          )}
          {active && (sceneLoading || !scene) && <LoadingState label="Opening drawing…" />}
          {active && scene && !sceneLoading && (
            <Suspense
              fallback={
                <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
                  <Loader2 className="size-4 animate-spin" /> Loading editor…
                </div>
              }
            >
              <StitchDrawBoard
                key={`${repo}::${active}`}
                repo={repo}
                name={active}
                scene={scene}
                onSaved={onSaved}
                onImport={openImport}
                onImportFiles={importFiles}
              />
            </Suspense>
          )}
        </div>
      </div>

      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitDialog();
            }}
            className="flex flex-col gap-4"
          >
            <DialogHeader>
              <DialogTitle>
                {dialog?.mode === 'new' ? 'New drawing' : dialog?.mode === 'rename' ? 'Rename drawing' : 'Duplicate drawing'}
              </DialogTitle>
              <DialogDescription>
                Saved as <span className="font-mono">{(dialog?.value.trim() || '…') + EXT}</span>
              </DialogDescription>
            </DialogHeader>
            <Input
              autoFocus
              value={dialog?.value ?? ''}
              onChange={(e) => setDialog((d) => d && { ...d, value: e.target.value })}
              maxLength={100}
              aria-label="Drawing name"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!dialog?.value.trim()}>
                {dialog?.mode === 'rename' ? 'Rename' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
