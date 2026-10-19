import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Flame, GitBranch, GitCommit, GitGraph, Sparkles, Target } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { isFocusRepo } from '@/lib/focus';
import {
  commitsInRange,
  computeRangeStats,
  computeStreaks,
  RANGES,
  type ContributionGraph,
  type RangeKey,
} from '@/lib/contributions';
import useAppStore from '../store/useAppStore';
import ActivityTable from './overview/ActivityTable';
import { SegmentedToggle } from './overview/charts';
import CodingRhythm from './overview/CodingRhythm';
import ContributionCalendar, { type GraphKind } from './overview/ContributionCalendar';
import ContributionMix from './overview/ContributionMix';
import Delivery from './overview/Delivery';
import InsightTiles, { headline } from './overview/InsightTiles';
import Languages from './overview/Languages';
import NeedsAttention, { type DeliveryData } from './overview/NeedsAttention';
import ProjectPulse from './overview/ProjectPulse';
import TopRepos, { type RepoShare } from './overview/TopRepos';
import WeeklyGoal from './overview/WeeklyGoal';
import PageHeader from './layout/PageHeader';

const PREFS_KEY = 'stitch.overview.prefs';

function readPrefs(): { range: RangeKey; kind: GraphKind } {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return { range: p.range in RANGES ? p.range : '30', kind: p.kind === 'local' ? 'local' : 'github' };
  } catch {
    return { range: '30', kind: 'github' };
  }
}

export default function Overview() {
  const repos = useAppStore((s) => s.repos);
  const focusProject = useAppStore((s) => s.focusProject);
  const currentUser = useAppStore((s) => s.currentUser);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const setFocusProject = useAppStore((s) => s.setFocusProject);

  const data = useAppStore((s) => s.overviewRecents);
  const github: ContributionGraph | null = useAppStore((s) => s.overviewContributions);
  const local: ContributionGraph | null = useAppStore((s) => s.overviewLocalContributions);
  const delivery: DeliveryData | null = useAppStore((s) => s.overviewDelivery);
  const goals = useAppStore((s) => s.overviewGoals);
  const saveOverviewGoals = useAppStore((s) => s.saveOverviewGoals);

  const loading = !data;
  const [range, setRange] = useState<RangeKey>(() => readPrefs().range);
  const [kind, setKind] = useState<GraphKind>(() => readPrefs().kind);

  useEffect(() => {
    useAppStore.getState().loadOverviewData();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ range, kind }));
    } catch {
      /* preferences are a convenience only */
    }
  }, [range, kind]);

  const graph = kind === 'github' ? github : local;
  const graphLoading = !graph;
  const stats = useMemo(() => (graph?.weeks ? computeRangeStats(graph.weeks, range) : null), [graph, range]);
  const streaks = useMemo(() => computeStreaks(graph?.weeks), [graph]);
  const ghWindow = github?.windows?.[range];

  const localStats = useMemo(() => (local?.weeks ? computeRangeStats(local.weeks, range) : null), [local, range]);
  const localCommits = useMemo(() => (localStats ? commitsInRange(local?.commits, localStats) : []), [local, localStats]);

  const lines = useMemo(() => {
    if (!local?.commits) return null;
    return localCommits.reduce((acc, c) => ({ added: acc.added + c.a, deleted: acc.deleted + c.x }), { added: 0, deleted: 0 });
  }, [local, localCommits]);

  const topRepos = useMemo<RepoShare[]>(() => {
    if (kind === 'github') {
      return (ghWindow?.byRepository ?? []).map((b) => ({
        name: b.repository.name,
        url: b.repository.url,
        isPrivate: b.repository.isPrivate,
        count: b.contributions.totalCount,
      }));
    }
    const byRepo = new Map<number, RepoShare>();
    for (const c of localCommits) {
      const r = byRepo.get(c.r) ?? { name: local?.repos?.[c.r]?.name ?? 'unknown', count: 0, added: 0, deleted: 0 };
      r.count++;
      r.added! += c.a;
      r.deleted! += c.x;
      byRepo.set(c.r, r);
    }
    return Array.from(byRepo.values()).sort((a, b) => b.count - a.count);
  }, [kind, ghWindow, localCommits, local]);

  const prs = data?.prs ?? [];
  const issues = data?.issues ?? [];

  const repoNames = useMemo(() => {
    const names = new Set<string>();
    repos.forEach((r) => names.add(r.name));
    prs.forEach((p) => p.repository?.name && names.add(p.repository.name));
    issues.forEach((i) => i.repository?.name && names.add(i.repository.name));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [repos, prs, issues]);

  const focusRepo = repos.find((r) => isFocusRepo(r, focusProject));

  const openFocus = useCallback(
    async (value: string) => {
      await setFocusProject(value);
      setActiveTab('focus');
    },
    [setFocusProject, setActiveTab],
  );

  // computeStreaks lets a quiet today keep the streak alive, so a streak with nothing today is at risk.
  const todayCount = stats?.days[stats.days.length - 1]?.count ?? 0;
  const streakAtRisk = streaks.current > 0 && todayCount === 0;

  return (
    <section id="overview-section">
      <PageHeader
        title="Overview"
        description="Your contributions, consistency and projects at a glance."
        actions={
          <>
            <SegmentedToggle<GraphKind>
              ariaLabel="Data source"
              value={kind}
              onChange={setKind}
              options={[
                { value: 'github', label: <><GitGraph /> GitHub</> },
                { value: 'local', label: <><GitCommit /> Local</> },
              ]}
            />
            <SegmentedToggle<RangeKey>
              ariaLabel="Time range"
              value={range}
              onChange={setRange}
              options={(Object.keys(RANGES) as RangeKey[]).map((k) => ({ value: k, label: RANGES[k].short }))}
            />
          </>
        }
      />

      {stats && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground flex items-start gap-2 text-sm">
            <Sparkles className="text-primary mt-0.5 size-4 shrink-0" />
            <span>{headline(stats, range, kind, streaks.current)}</span>
          </p>
          {streakAtRisk && (
            <span className="border-warning/30 bg-warning/10 text-warning inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border px-3 py-1 text-xs font-semibold">
              <Flame className="size-3.5" />
              Nothing {kind === 'github' ? 'contributed' : 'committed'} today — keep your {streaks.current}-day streak alive
            </span>
          )}
        </div>
      )}

      <InsightTiles
        stats={stats}
        range={range}
        kind={kind}
        streaks={streaks}
        loading={graphLoading}
        lines={lines}
        collaboration={ghWindow ? { prs: ghWindow.pullRequests, reviews: ghWindow.reviews } : null}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col gap-4">
          <WeeklyGoal
            weeks={graph?.weeks}
            goal={goals.activeDaysPerWeek}
            kind={kind}
            loading={graphLoading}
            onGoalChange={(n) => saveOverviewGoals({ activeDaysPerWeek: n })}
          />
          {focusRepo && (
            <Card
              role="button"
              tabIndex={0}
              onClick={() => setActiveTab('focus')}
              onKeyDown={(e) => e.key === 'Enter' && setActiveTab('focus')}
              className="hover:border-primary/40 focus-visible:ring-ring/50 cursor-pointer py-4 outline-none transition-colors focus-visible:ring-[3px]"
            >
              <CardContent className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="bg-primary/10 text-primary inline-flex size-10 shrink-0 items-center justify-center rounded-lg">
                    <Target className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Current Focus</div>
                    <div className="truncate font-bold">
                      {focusRepo.path ? focusRepo.name : `${focusRepo.owner}/${focusRepo.name}`}
                    </div>
                  </div>
                </div>
                <div className="text-muted-foreground flex shrink-0 items-center gap-3 text-xs">
                  {focusRepo.branch && (
                    <span className="hidden items-center gap-1 font-mono sm:inline-flex">
                      <GitBranch className="size-3.5" /> {focusRepo.branch}
                    </span>
                  )}
                  <span className="text-primary inline-flex items-center gap-1 font-medium">
                    Open <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        <NeedsAttention delivery={delivery} pulses={local?.repos ?? []} loading={!delivery || !local} onFocusRepo={openFocus} />
      </div>

      <ContributionCalendar stats={stats} loading={graphLoading} kind={kind} range={range} username={github?.username} />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ContributionMix window={ghWindow} range={range} loading={!github} />
        <TopRepos repos={topRepos} kind={kind} range={range} loading={graphLoading} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Delivery
          merged={delivery?.merged ?? []}
          openCount={delivery?.authoredOpen.length ?? 0}
          stats={stats}
          range={range}
          loading={!delivery}
        />
        <Languages commits={localCommits} range={range} loading={!local} />
      </div>

      <CodingRhythm commits={localCommits} range={range} loading={!local} />

      <ActivityTable prs={prs} issues={issues} repoNames={repoNames} loading={loading} />

      <ProjectPulse
        repos={repos}
        local={local}
        githubMonth={github?.windows?.['30']}
        range={range}
        rangeStart={localStats?.start}
        focusProject={focusProject}
        currentUser={currentUser}
        onFocus={openFocus}
        onManage={() => setActiveTab('repositories')}
        loading={!local}
      />
    </section>
  );
}
