import { useEffect, useMemo, useState } from 'react';
import { Archive, FilePen, FolderGit2, Search, Star } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { ContributionGraph } from '@/lib/contributions';
import { buildRepoRows, compareRows, hasUnsavedWork, STATUS_META, statusCounts, type RepoRow, type RepoStatus } from '@/lib/repoHealth';
import { cn } from '@/lib/utils';
import { confirmDialog } from '../helper/confirm';
import useAppStore from '../store/useAppStore';
import PageHeader from './layout/PageHeader';
import ProjectDetail from './ProjectDetail';
import AddRepoDialog from './repositories/AddRepoDialog';
import MajorProjects from './repositories/MajorProjects';
import RepoTable, { type RowActions } from './repositories/RepoTable';
import { useToast } from './Toast';

type Filter = 'all' | RepoStatus | 'unsaved' | 'major' | 'stale';
type Kind = 'all' | 'local' | 'github';
type Sort = 'health' | 'recent' | 'activity' | 'name';

const YEAR_MS = 365 * 86400000;
const entriesOf = (rows: RepoRow[]) => rows.flatMap((r) => r.entries.map((e) => ({ path: e.path || '', owner: e.owner || '', name: e.name || '' })));
const isStale = (r: RepoRow) => r.kind !== 'github' && (!r.lastCommit || Date.now() - new Date(r.lastCommit).getTime() > YEAR_MS);

const SORTS: Record<Sort, { label: string; compare: (a: RepoRow, b: RepoRow) => number }> = {
  health: { label: 'Health', compare: compareRows },
  recent: { label: 'Last commit', compare: (a, b) => (b.lastCommit ?? '').localeCompare(a.lastCommit ?? '') },
  activity: { label: 'Activity (90d)', compare: (a, b) => (b.commits ?? -1) - (a.commits ?? -1) },
  name: { label: 'Name', compare: (a, b) => a.name.localeCompare(b.name) },
};

function FilterChip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors outline-none focus-visible:ring-[3px]',
        active ? 'border-primary/40 bg-primary/10 text-foreground' : 'text-muted-foreground hover:text-foreground bg-card',
      )}
    >
      {children}
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

export default function Repositories() {
  const toast = useToast();
  const repos = useAppStore((s) => s.repos);
  const currentUser = useAppStore((s) => s.currentUser);
  const focusProject = useAppStore((s) => s.focusProject);
  const local: ContributionGraph | null = useAppStore((s) => s.overviewLocalContributions);
  const github: ContributionGraph | null = useAppStore((s) => s.overviewContributions);

  const [filter, setFilter] = useState<Filter>('all');
  const [kind, setKind] = useState<Kind>('all');
  const [sort, setSort] = useState<Sort>('health');
  const [query, setQuery] = useState('');
  // Keep the key, not the row, so the workspace always shows live data (e.g. after the local scan lands).
  const [workspaceKey, setWorkspaceKey] = useState<string | null>(null);

  useEffect(() => {
    useAppStore.getState().loadRepoActivity();
  }, []);

  const rows = useMemo(
    () => buildRepoRows({ repos, local, githubMonth: github?.windows?.['30'], focusProject, currentUser }),
    [repos, local, github, focusProject, currentUser],
  );
  const counts = statusCounts(rows);
  const unsaved = rows.filter(hasUnsavedWork).length;
  const stale = rows.filter(isStale).length;
  const major = rows.filter((r) => r.isMajor);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (filter === 'unsaved') return hasUnsavedWork(r);
        if (filter === 'major') return r.isMajor;
        if (filter === 'stale') return isStale(r);
        return filter === 'all' || r.status === filter;
      })
      .filter((r) => kind === 'all' || (kind === 'github' ? r.kind !== 'local' : r.kind !== 'github'))
      .filter((r) => !q || [r.name, r.slug, r.path, r.topLanguage, r.branch].some((v) => v?.toLowerCase().includes(q)))
      .sort(SORTS[sort].compare);
  }, [rows, filter, kind, sort, query]);

  const actions: RowActions = {
    focus: async (row) => {
      await useAppStore.getState().setFocusProject(row.focusValue);
      useAppStore.getState().setActiveTab('focus');
      toast(`Focused workspace set to ${row.name}`, 'info');
    },
    toggleStar: (row) => {
      const { toggleMajor } = useAppStore.getState();
      // A merged row may be starred through either entry; unstar them all, star just the primary.
      const targets = row.isMajor ? row.entries.filter((e) => e.isMajorProject) : [row.entries[0]];
      for (const e of targets) toggleMajor({ path: e.path || '', owner: e.owner || '', name: e.name || '' });
      toast(row.isMajor ? `${row.name} removed from Major projects` : `${row.name} starred as a Major project`, row.isMajor ? 'info' : 'success');
    },
    open: async (row, target) => {
      try {
        await useAppStore.getState().openRepo(row.path, target);
      } catch (err) {
        toast(err.message, 'error');
      }
    },
    copyPath: async (row) => {
      try {
        await navigator.clipboard.writeText(row.path ?? '');
        toast('Path copied', 'success');
      } catch {
        toast('Could not access the clipboard', 'error');
      }
    },
    openWorkspace: (row) => setWorkspaceKey(row.key),
    untrack: async (row) => {
      const both = row.entries.length > 1 ? ' (both the local clone and its GitHub entry)' : '';
      const ok = await confirmDialog('Stop tracking', `Stop tracking ${row.name}${both}? Nothing on disk or GitHub is changed.`);
      if (!ok) return;
      try {
        await useAppStore.getState().bulkRepos({ remove: entriesOf([row]) });
        toast(`Stopped tracking ${row.name}`, 'info');
      } catch (err) {
        toast(err.message, 'error');
      }
    },
  };

  const untrackVisibleStale = async () => {
    const targets = visible.filter((r) => isStale(r) && !r.isMajor);
    const ok = await confirmDialog(
      'Stop tracking stale repositories',
      `Stop tracking ${targets.length} repositories with no commits in over a year? Nothing on disk is changed, and you can add them back any time.`,
    );
    if (!ok) return;
    try {
      const res = await useAppStore.getState().bulkRepos({ remove: entriesOf(targets) });
      toast(`Stopped tracking ${targets.length} repositories`, 'info');
      if (res.removed) setFilter('all');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const workspace = workspaceKey ? rows.find((r) => r.key === workspaceKey) : null;
  if (workspace?.slug) {
    const [owner, name] = workspace.slug.split('/');
    const entry = { ...workspace.entries[0], owner, name };
    return <ProjectDetail repo={entry} row={workspace} onBack={() => setWorkspaceKey(null)} />;
  }

  const statusChips = (['active', 'cooling', 'dormant', 'unknown', 'missing'] as RepoStatus[]).filter((s) => counts[s] > 0);

  return (
    <section id="repositories-section">
      <PageHeader
        title="Repositories"
        description="Everything Stitch tracks — what's alive, what's drifting, and what needs tidying."
        actions={<AddRepoDialog />}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="No repositories tracked yet"
          description="Add a local clone or a GitHub owner/name to start building your insights."
        />
      ) : (
        <>
          <MajorProjects rows={major.sort(compareRows)} onOpen={(r) => setWorkspaceKey(r.key)} />

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} count={rows.length}>
              All
            </FilterChip>
            {statusChips.map((s) => (
              <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)} count={counts[s]}>
                <span className={cn('size-2 rounded-full', STATUS_META[s].dot)} /> {STATUS_META[s].label}
              </FilterChip>
            ))}
            {major.length > 0 && (
              <FilterChip active={filter === 'major'} onClick={() => setFilter('major')} count={major.length}>
                <Star className="size-3 fill-current text-amber-500" /> Major
              </FilterChip>
            )}
            {unsaved > 0 && (
              <FilterChip active={filter === 'unsaved'} onClick={() => setFilter('unsaved')} count={unsaved}>
                <FilePen className="text-warning size-3" /> Unsaved work
              </FilterChip>
            )}
          </div>

          {filter === 'stale' && visible.length > 0 && (
            <div className="border-warning/30 bg-warning/5 mb-4 flex flex-col gap-2 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">
                Starred projects are kept — star anything you still care about, then untrack the rest.
              </span>
              <Button size="xs" variant="outline" onClick={untrackVisibleStale} className="text-destructive shrink-0">
                <Archive /> Stop tracking {visible.filter((r) => isStale(r) && !r.isMajor).length} shown
              </Button>
            </div>
          )}

          {stale >= 3 && filter !== 'stale' && (
            <div className="bg-muted/50 text-muted-foreground mb-4 flex flex-col gap-2 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-start gap-2">
                <Archive className="mt-0.5 size-4 shrink-0" />
                <span>
                  <strong className="text-foreground">{stale} local repos</strong> haven't had a commit in over a year. Untracking
                  them keeps your insights focused on what you're actually building.
                </span>
              </span>
              <Button size="xs" variant="outline" onClick={() => setFilter('stale')} className="shrink-0">
                Review them
              </Button>
            </div>
          )}

          <Card className="gap-0 overflow-hidden py-0">
            <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, path, branch or language…"
                  className="pl-8"
                  aria-label="Search repositories"
                />
              </div>
              <div className="flex gap-2">
                <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
                  <SelectTrigger className="w-36" aria-label="Repository type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="local">Local clones</SelectItem>
                    <SelectItem value="github">On GitHub</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
                  <SelectTrigger className="w-40" aria-label="Sort by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SORTS) as Sort[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        Sort: {SORTS[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!local ? (
              <div className="flex flex-col gap-3 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <p className="text-muted-foreground px-6 py-10 text-center text-sm">No repositories match these filters.</p>
            ) : (
              <RepoTable rows={visible} actions={actions} activityLabel="Activity · 12 wks / 90d" />
            )}

            <div className="bg-muted/30 text-muted-foreground flex items-center justify-between border-t px-6 py-2.5 text-xs">
              <span>
                Showing <strong className="text-foreground">{visible.length}</strong> of {rows.length} projects
              </span>
              {(filter !== 'all' || kind !== 'all' || query) && (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setFilter('all');
                    setKind('all');
                    setQuery('');
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </Card>
        </>
      )}
    </section>
  );
}
