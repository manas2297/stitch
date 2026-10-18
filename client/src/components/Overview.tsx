import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Flame,
  GitBranch,
  GitPullRequest,
  Globe,
  Laptop,
  Package,
  Search,
  Star,
  Target,
} from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/StatCard';
import { computeStreaks } from '@/lib/contributions';
import useAppStore from '../store/useAppStore';
import ActivityTable from './overview/ActivityTable';
import ContributionCalendar, { type GraphKind } from './overview/ContributionCalendar';
import PageHeader from './layout/PageHeader';

export default function Overview() {
  const repos = useAppStore((s) => s.repos);
  const githubRepoCount = useAppStore((s) => s.githubRepoCount);
  const focusProject = useAppStore((s) => s.focusProject);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  const data = useAppStore((s) => s.overviewRecents);
  const contributions = useAppStore((s) => s.overviewContributions);
  const localContribs = useAppStore((s) => s.overviewLocalContributions);

  const loading = !data;
  const [graphKind, setGraphKind] = useState<GraphKind>('github');

  useEffect(() => {
    useAppStore.getState().loadOverviewData();
  }, []);

  const majorRepos = repos.filter((r) => r.isMajorProject);
  const localRepos = repos.filter((r) => r.type === 'local');
  const webRepos = repos.filter((r) => r.type !== 'local');
  const totalRepoCount = githubRepoCount > 0 ? githubRepoCount : repos.length;
  const trackedCount = repos.length;

  const graph = graphKind === 'github' ? contributions : localContribs;
  const graphLoading = !graph;
  const streaks = useMemo(() => computeStreaks(graph?.weeks), [graph]);

  const prs = data?.prs ?? [];
  const issues = data?.issues ?? [];

  const repoNames = useMemo(() => {
    const names = new Set<string>();
    repos.forEach((r) => names.add(r.name));
    prs.forEach((p) => p.repository?.name && names.add(p.repository.name));
    issues.forEach((i) => i.repository?.name && names.add(i.repository.name));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [repos, prs, issues]);

  const focusRepo = focusProject
    ? repos.find((r) => (focusProject.includes('/') ? `${r.owner}/${r.name}` === focusProject : r.path === focusProject))
    : null;

  return (
    <section id="overview-section">
      <PageHeader title="Overview" description="Your repository workspace at a glance." />

      {focusRepo && (
        <Card
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab('focus')}
          onKeyDown={(e) => e.key === 'Enter' && setActiveTab('focus')}
          className="hover:border-primary/40 focus-visible:ring-ring/50 mb-6 cursor-pointer py-4 outline-none transition-colors focus-visible:ring-[3px]"
        >
          <CardContent className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="bg-primary/10 text-primary inline-flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Target className="size-5" />
              </span>
              <div className="min-w-0">
                <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Current Focus</div>
                <div className="truncate font-bold">
                  {focusProject.includes('/') ? `${focusRepo.owner}/${focusRepo.name}` : focusRepo.name}
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

      <ContributionCalendar graph={graph} loading={graphLoading} kind={graphKind} onKindChange={setGraphKind} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          icon={Package}
          variant="purple"
          value={totalRepoCount}
          label="GitHub Repos"
          sublabel={trackedCount < totalRepoCount ? `${trackedCount} tracked` : undefined}
        />
        <StatCard icon={Star} variant="green" value={majorRepos.length} label="Major Projects" />
        <StatCard icon={GitPullRequest} variant="blue" value={loading ? '—' : prs.length} label="Open PRs" />
        <StatCard icon={AlertCircle} variant="orange" value={loading ? '—' : issues.length} label="Open Issues" />
        <StatCard
          icon={Flame}
          variant="teal"
          value={graphLoading ? '—' : streaks.current}
          label="Day Streak"
          sublabel={!graphLoading && streaks.longest > 0 ? `best: ${streaks.longest}d` : undefined}
        />
        <StatCard icon={Search} variant="pink" value={loading ? '—' : prs.length} label="Review Requests" />
      </div>

      <ActivityTable prs={prs} issues={issues} repoNames={repoNames} loading={loading} />

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Laptop className="size-4" /> Local Repos ({localRepos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {localRepos.length === 0 ? (
              <p className="text-muted-foreground text-sm">None added yet.</p>
            ) : (
              <ul className="divide-y">
                {localRepos.map((r) => (
                  <li key={r.path || r.name} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0 text-sm">
                      <span className="font-medium">{r.name}</span>
                      {r.branch && (
                        <span className="text-muted-foreground ml-2 inline-flex items-center gap-1 font-mono text-[0.7rem]">
                          <GitBranch className="size-3" /> {r.branch}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {r.isMajorProject && (
                        <Badge variant="green" className="text-[0.65rem]">
                          <Star /> Major
                        </Badge>
                      )}
                      {!r.exists && (
                        <Badge variant="orange" className="text-[0.65rem]">
                          Missing
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="size-4" /> Web Repos ({webRepos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {webRepos.length === 0 ? (
              <p className="text-muted-foreground text-sm">None added yet.</p>
            ) : (
              <ul className="divide-y">
                {webRepos.map((r) => (
                  <li key={`${r.owner}/${r.name}`} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="truncate font-medium">
                      {r.owner}/{r.name}
                    </span>
                    {r.isMajorProject && (
                      <Badge variant="green" className="text-[0.65rem]">
                        <Star /> Major
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
