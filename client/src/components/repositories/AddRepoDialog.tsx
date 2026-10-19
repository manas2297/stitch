import { useEffect, useMemo, useState } from 'react';
import { FolderOpen, FolderSearch, Globe, Lock, Plus, Search, Type } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ageOf } from '@/lib/age';
import { cn } from '@/lib/utils';
import useAppStore, { apiFetch } from '../../store/useAppStore';
import { useToast } from '../Toast';

type Mode = 'scan' | 'github' | 'path';

interface Candidate {
  id: string; // what gets sent to the bulk endpoint: a path or owner/name
  title: string;
  subtitle: string;
  lastActivity?: string;
  tracked: boolean;
  badges: string[];
  isPrivate?: boolean;
}

const DAY = 86400000;
const recentWithin = (iso: string | undefined, days: number) => !!iso && Date.now() - new Date(iso).getTime() < days * DAY;

async function getJSON(url: string) {
  const res = await apiFetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function CandidateList({
  items,
  selected,
  onToggle,
}: {
  items: Candidate[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (items.length === 0) return <p className="text-muted-foreground py-8 text-center text-sm">Nothing to show.</p>;
  return (
    <ul className="max-h-80 divide-y overflow-y-auto rounded-lg border">
      {items.map((c) => (
        <li key={c.id}>
          <label
            className={cn(
              'flex items-center gap-3 px-3 py-2.5',
              c.tracked ? 'opacity-60' : 'hover:bg-muted/40 cursor-pointer',
            )}
          >
            <Checkbox checked={c.tracked || selected.has(c.id)} disabled={c.tracked} onCheckedChange={() => onToggle(c.id)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium">{c.title}</span>
                {c.isPrivate && <Lock className="text-muted-foreground size-3 shrink-0" aria-label="Private" />}
                {c.badges.map((b) => (
                  <Badge key={b} variant="default" className="bg-muted text-muted-foreground px-1.5 py-0 text-[0.6rem] normal-case">
                    {b}
                  </Badge>
                ))}
              </div>
              <div className="text-muted-foreground truncate font-mono text-[0.7rem]">{c.subtitle}</div>
            </div>
            <span className="text-muted-foreground shrink-0 text-xs">
              {c.tracked ? 'Tracked' : c.lastActivity ? ageOf(c.lastActivity).label : 'no commits'}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

export default function AddRepoDialog() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('scan');
  const [saving, setSaving] = useState(false);

  const [roots, setRoots] = useState<{ path: string; label: string }[]>([]);
  const [home, setHome] = useState('');
  const [root, setRoot] = useState('');
  const [scan, setScan] = useState<{ loading: boolean; error?: string; items: Candidate[]; truncated?: boolean } | null>(null);
  const [github, setGithub] = useState<{ loading: boolean; error?: string; items: Candidate[] } | null>(null);
  const [filter, setFilter] = useState('');
  const [manual, setManual] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const pickFolder = window.go?.desktop?.App?.PickFolder;
  const tilde = (p: string) => (home && p.startsWith(home) ? `~${p.slice(home.length)}` : p);

  useEffect(() => {
    if (!open || roots.length) return;
    getJSON('/api/repos/discover/roots')
      .then((d) => {
        setRoots(d.roots);
        setHome(d.home);
        if (!root && d.roots[0]) runScan(d.roots[0].path, d.home);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open && mode === 'github' && !github) loadGitHub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  const runScan = async (path: string, homeDir = home) => {
    setRoot(path);
    setScan({ loading: true, items: [] });
    try {
      const d = await getJSON(`/api/repos/discover?root=${encodeURIComponent(path)}`);
      const short = (p: string) => (homeDir && p.startsWith(homeDir) ? `~${p.slice(homeDir.length)}` : p);
      const items: Candidate[] = d.repos.map((r) => ({
        id: r.path,
        title: r.name,
        subtitle: r.slug ? `${short(r.path)} · ${r.slug}` : short(r.path),
        lastActivity: r.lastCommit,
        tracked: r.tracked,
        badges: [],
      }));
      setScan({ loading: false, items, truncated: d.truncated });
      // Pre-select what you're plausibly still working on.
      setSelected(new Set(items.filter((i) => !i.tracked && recentWithin(i.lastActivity, 180)).map((i) => i.id)));
    } catch (err) {
      setScan({ loading: false, error: err.message, items: [] });
    }
  };

  const loadGitHub = async () => {
    setGithub({ loading: true, items: [] });
    try {
      const d = await getJSON('/api/repos/github');
      const items: Candidate[] = d.repos
        .map((r) => ({
          id: r.nameWithOwner,
          title: r.nameWithOwner,
          subtitle: [r.primaryLanguage?.name, r.description].filter(Boolean).join(' · ') || r.url,
          lastActivity: r.pushedAt,
          tracked: r.tracked,
          isPrivate: r.isPrivate,
          badges: [r.isFork && 'fork', r.isArchived && 'archived', r.cloned && 'cloned locally'].filter(Boolean),
        }))
        .sort((a, b) => (b.lastActivity ?? '').localeCompare(a.lastActivity ?? ''));
      setGithub({ loading: false, items });
    } catch (err) {
      setGithub({ loading: false, error: err.message, items: [] });
    }
  };

  const source = mode === 'scan' ? scan : mode === 'github' ? github : null;
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (source?.items ?? []).filter((i) => !q || `${i.title} ${i.subtitle}`.toLowerCase().includes(q));
  }, [source, filter]);
  const selectable = visible.filter((i) => !i.tracked);
  const pending = (source?.items ?? []).filter((i) => selected.has(i.id)).length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const selectWhere = (pred: (c: Candidate) => boolean) => setSelected(new Set(selectable.filter(pred).map((c) => c.id)));

  const switchMode = (m: Mode) => {
    setMode(m);
    setFilter('');
    setSelected(new Set());
  };

  const submit = async () => {
    const add = mode === 'path' ? [manual.trim()].filter(Boolean) : (source?.items ?? []).filter((i) => selected.has(i.id)).map((i) => i.id);
    if (!add.length) return;
    setSaving(true);
    try {
      const res = await useAppStore.getState().bulkRepos({ add });
      if (res.failed?.length) toast(`${res.failed[0].target}: ${res.failed[0].error}`, 'error');
      if (res.added) toast(`Now tracking ${res.added} repositor${res.added === 1 ? 'y' : 'ies'}`, 'success');
      if (res.added && !res.failed?.length) {
        setOpen(false);
        setManual('');
        setSelected(new Set());
        setScan(null);
        setGithub(null);
        setRoots([]);
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const count = mode === 'path' ? (manual.trim() ? 1 : 0) : pending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Add repositories
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>Track repositories</DialogTitle>
          <DialogDescription>Local clones feed your commit insights. GitHub repos add PRs, issues and releases.</DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => switchMode(v as Mode)}>
          <TabsList>
            <TabsTrigger value="scan" className="gap-1.5">
              <FolderSearch /> Scan a folder
            </TabsTrigger>
            <TabsTrigger value="github" className="gap-1.5">
              <Globe /> From GitHub
            </TabsTrigger>
            <TabsTrigger value="path" className="gap-1.5">
              <Type /> Enter a path
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === 'scan' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {roots.map((r) => (
                <Button key={r.path} size="xs" variant={root === r.path ? 'secondary' : 'outline'} onClick={() => runScan(r.path)}>
                  {r.label}
                </Button>
              ))}
              {pickFolder ? (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={async () => {
                    const dir = await pickFolder('Choose a folder to scan for git repositories');
                    if (dir) runScan(dir);
                  }}
                >
                  <FolderOpen /> Choose folder…
                </Button>
              ) : (
                <form
                  className="flex gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const v = (e.currentTarget.elements.namedItem('scanRoot') as HTMLInputElement).value.trim();
                    if (v) runScan(v);
                  }}
                >
                  <Input name="scanRoot" placeholder="~/somewhere" className="h-6 w-36 text-xs" aria-label="Folder to scan" />
                  <Button size="xs" variant="outline" type="submit">
                    Scan
                  </Button>
                </form>
              )}
            </div>
            {root && <p className="text-muted-foreground text-xs">Looking up to 4 levels deep in {tilde(root)}, skipping hidden and dependency folders.</p>}
          </div>
        )}

        {mode === 'path' ? (
          <div className="flex flex-col gap-2">
            <Input
              autoFocus
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="/Users/you/code/project  or  owner/name"
              aria-label="Repository path or owner/name"
            />
            <p className="text-muted-foreground text-xs">A local clone that's also on GitHub shows up as a single project.</p>
          </div>
        ) : source?.loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : source?.error ? (
          <p className="text-destructive text-sm">{source.error}</p>
        ) : source ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative sm:w-64">
                <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter…" className="h-8 pl-8 text-sm" />
              </div>
              <div className="text-muted-foreground flex items-center gap-1 text-xs">
                Select:
                <Button size="xs" variant="ghost" onClick={() => selectWhere((c) => recentWithin(c.lastActivity, mode === 'scan' ? 180 : 90))}>
                  Recently active
                </Button>
                <Button size="xs" variant="ghost" onClick={() => selectWhere(() => true)}>
                  All
                </Button>
                <Button size="xs" variant="ghost" onClick={() => setSelected(new Set())}>
                  None
                </Button>
              </div>
            </div>
            <CandidateList items={visible} selected={selected} onToggle={toggle} />
            <p className="text-muted-foreground text-xs">
              {source.items.length} found · {source.items.filter((i) => i.tracked).length} already tracked
              {scan?.truncated && mode === 'scan' ? ' · stopped early, try a narrower folder' : ''}
            </p>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!count || saving}>
            {saving ? 'Adding…' : count > 1 ? `Track ${count} repositories` : 'Track repository'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
