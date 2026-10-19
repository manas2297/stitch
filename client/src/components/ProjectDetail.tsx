import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  GitMerge,
  GitPullRequest,
  Lightbulb,
  Lock,
  Map as MapIcon,
  RefreshCw,
  Star,
  Tag,
  Target,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ageOf } from '@/lib/age';
import { formatDuration, median } from '@/lib/contributions';
import { isFocusRepo } from '@/lib/focus';
import { STATUS_META, type RepoRow } from '@/lib/repoHealth';
import { cn } from '@/lib/utils';
import useAppStore, { apiFetch } from '../store/useAppStore';
import IdeasEditor from './IdeasEditor';
import { ErrorMessage } from './layout/LoadingState';
import IssuesPanel, { type Issue } from './project/IssuesPanel';
import PullRequests, { type PR } from './project/PullRequests';
import { AboutCard, ActivityCard, CICard, GitHubLink, LocalCard, ReleaseCard, runState, type Release, type RepoInfo, type Run } from './project/Sidebar';
import Roadmap from './Roadmap';
import { useToast } from './Toast';

interface Details {
  features: Issue[];
  bugs: Issue[];
  general: Issue[];
  prs: PR[] | null;
  lastTag: string;
  repo?: RepoInfo;
  releases: Release[];
  runs: Run[];
  unreleased: number;
  participation?: { all?: number[]; owner?: number[] };
}

const DAY = 86400000;

function Tile({ icon: Icon, label, value, sub, tone }: { icon: LucideIcon; label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="flex flex-col gap-1 px-4">
        <div className="text-muted-foreground flex items-center gap-1.5 text-[0.7rem] font-semibold tracking-wider uppercase">
          <Icon className="size-3.5" /> {label}
        </div>
        <div className={cn('truncate text-2xl leading-tight font-extrabold tracking-tight tabular-nums', tone)}>{value}</div>
        <div className="text-muted-foreground min-h-4 truncate text-xs">{sub}</div>
      </CardContent>
    </Card>
  );
}

export default function ProjectDetail({ repo, row, onBack }: { repo: any; row?: RepoRow; onBack: () => void }) {
  const toast = useToast();
  const focusProject = useAppStore((s) => s.focusProject);
  const [details, setDetails] = useState<Details | null>(null);
  const [roadmap, setRoadmap] = useState({ tasks: [], issue: null });
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setError('');
    Promise.all([
      apiFetch(`/api/projects/details?owner=${repo.owner}&name=${repo.name}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
      apiFetch(`/api/roadmap?owner=${repo.owner}&name=${repo.name}`).then((r) => r.json()),
    ])
      .then(([d, rm]) => {
        setDetails(d);
        setRoadmap(rm);
      })
      .catch((err) => setError(err.message));
  }, [repo.owner, repo.name, reloadKey]);

  const prs = details?.prs ?? [];
  const stats = useMemo(() => {
    const open = prs.filter((p) => p.state === 'OPEN');
    const awaiting = open.filter((p) => !p.isDraft && p.reviewDecision !== 'APPROVED');
    const merged = prs.filter((p) => p.state === 'MERGED' && p.mergedAt);
    const recentMerged = merged.filter((p) => Date.now() - new Date(p.mergedAt!).getTime() < 30 * DAY);
    const cycle = median(merged.map((p) => (new Date(p.mergedAt!).getTime() - new Date(p.createdAt).getTime()) / 3600000));
    const defaultBranch = details?.repo?.defaultBranchRef?.name;
    const finished = (details?.runs ?? []).filter((r) => r.status === 'completed');
    const mainRun = finished.find((r) => r.headBranch === defaultBranch) ?? finished[0];
    const issues = (details?.features.length ?? 0) + (details?.bugs.length ?? 0) + (details?.general.length ?? 0);
    return { open, awaiting, recentMerged, cycle, defaultBranch, mainRun, issues };
  }, [prs, details]);

  const slug = `${repo.owner}/${repo.name}`;
  const isFocus = row ? row.isFocus : isFocusRepo(repo, focusProject);
  const status = row ? STATUS_META[row.status] : null;
  const ci = runState(stats.mainRun);

  const focus = async () => {
    await useAppStore.getState().setFocusProject(row?.focusValue ?? slug);
    useAppStore.getState().setActiveTab('focus');
  };
  const openLocal = async (target: 'editor' | 'terminal') => {
    try {
      await useAppStore.getState().openRepo(row?.path, target);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground -ml-2 self-start">
          <ArrowLeft /> Repositories
        </Button>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{row?.name ?? repo.name}</h2>
              {row?.isMajor && (
                <Badge variant="green" className="text-[0.65rem]">
                  <Star className="fill-current" /> Major
                </Badge>
              )}
              {details?.repo?.isPrivate && (
                <Badge className="bg-muted text-muted-foreground text-[0.65rem]">
                  <Lock /> Private
                </Badge>
              )}
              {details?.repo?.isArchived && (
                <Badge variant="orange" className="text-[0.65rem]">
                  <Archive /> Archived
                </Badge>
              )}
            </div>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="font-mono">{slug}</span>
              {status && (
                <>
                  <span aria-hidden>·</span>
                  <span className={cn('inline-flex items-center gap-1.5 font-medium', status.text)}>
                    <span className={cn('size-2 rounded-full', status.dot)} /> {status.label}
                  </span>
                </>
              )}
              {row?.lastCommit && (
                <>
                  <span aria-hidden>·</span>
                  <span>your last commit {ageOf(row.lastCommit).label.toLowerCase()}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => setReloadKey((k) => k + 1)} aria-label="Refresh">
              <RefreshCw />
            </Button>
            <Button variant={isFocus ? 'secondary' : 'default'} size="sm" disabled={isFocus} onClick={focus}>
              <Target /> {isFocus ? 'In focus' : 'Focus on this'}
            </Button>
            <GitHubLink url={details?.repo?.url ?? `https://github.com/${slug}`} />
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-start gap-4">
          <ErrorMessage>Failed to load project details: {error}</ErrorMessage>
          <Button variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>
            <RefreshCw /> Try again
          </Button>
        </div>
      ) : !details ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Tile
              icon={GitPullRequest}
              label="Open PRs"
              value={stats.open.length}
              sub={stats.awaiting.length ? `${stats.awaiting.length} waiting on review` : 'nothing waiting on review'}
            />
            <Tile
              icon={GitMerge}
              label="Time to merge"
              value={stats.cycle != null ? formatDuration(stats.cycle) : '—'}
              sub={`median · ${stats.recentMerged.length} merged in 30d`}
            />
            <Tile
              icon={AlertCircle}
              label="Open issues"
              value={stats.issues}
              sub={`${details.bugs.length} bug${details.bugs.length === 1 ? '' : 's'} · ${details.features.length} feature${details.features.length === 1 ? '' : 's'}`}
              tone={details.bugs.length > 0 ? 'text-destructive' : undefined}
            />
            <Tile
              icon={Tag}
              label="Latest release"
              value={<span className="font-mono text-xl">{details.lastTag !== 'N/A' ? details.lastTag : 'None'}</span>}
              sub={
                details.unreleased > 0
                  ? `${details.unreleased} commits unreleased`
                  : details.releases[0]?.publishedAt
                    ? ageOf(details.releases[0].publishedAt).label
                    : details.lastTag === 'N/A'
                      ? 'never released'
                      : 'up to date'
              }
            />
            <Tile
              icon={Workflow}
              label={`CI${stats.defaultBranch ? ` · ${stats.defaultBranch}` : ''}`}
              value={
                <span className={cn('inline-flex items-center gap-1.5', ci.cls)}>
                  <ci.icon className="size-5" /> {ci.label}
                </span>
              }
              sub={stats.mainRun ? `${stats.mainRun.workflowName} · ${ageOf(stats.mainRun.createdAt).label.toLowerCase()}` : 'no workflow runs'}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Tabs defaultValue={stats.open.length || !stats.issues ? 'prs' : 'issues'} className="min-w-0">
              <TabsList className="mb-3">
                <TabsTrigger value="prs" className="gap-1.5">
                  <GitPullRequest /> Pull requests <span className="text-muted-foreground text-xs">{stats.open.length}</span>
                </TabsTrigger>
                <TabsTrigger value="issues" className="gap-1.5">
                  <AlertCircle /> Issues <span className="text-muted-foreground text-xs">{stats.issues}</span>
                </TabsTrigger>
                <TabsTrigger value="roadmap" className="gap-1.5">
                  <MapIcon /> Roadmap <span className="text-muted-foreground text-xs">{roadmap.tasks.length}</span>
                </TabsTrigger>
                <TabsTrigger value="ideas" className="gap-1.5">
                  <Lightbulb /> Ideas
                </TabsTrigger>
              </TabsList>
              <Card className="gap-0 overflow-hidden py-0">
                <TabsContent value="prs">
                  <PullRequests prs={prs} />
                </TabsContent>
                <TabsContent value="issues">
                  <IssuesPanel features={details.features} bugs={details.bugs} other={details.general} />
                </TabsContent>
                <TabsContent value="roadmap" className="p-5">
                  <Roadmap owner={repo.owner} name={repo.name} initialTasks={roadmap.tasks} issue={roadmap.issue} />
                </TabsContent>
                <TabsContent value="ideas" className="p-5">
                  <IdeasEditor owner={repo.owner} name={repo.name} />
                </TabsContent>
              </Card>
            </Tabs>

            <aside className="flex min-w-0 flex-col gap-4 lg:pt-12">
              {row?.path && row.kind !== 'github' && <LocalCard row={row} onOpen={openLocal} />}
              <ActivityCard participation={details.participation} />
              <ReleaseCard
                lastTag={details.lastTag}
                releases={details.releases}
                unreleased={details.unreleased}
                onCutRelease={() => useAppStore.getState().setActiveTab('releases')}
              />
              <CICard runs={details.runs} defaultBranch={stats.defaultBranch} />
              <AboutCard info={details.repo} />
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
