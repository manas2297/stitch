import type { ReactNode } from 'react';
import {
  Activity,
  ArrowUpFromLine,
  CircleCheck,
  CircleDashed,
  CircleX,
  Code,
  ExternalLink,
  FilePen,
  GitBranch,
  GitFork,
  Info,
  Laptop,
  Link2,
  Rocket,
  SquareTerminal,
  Star,
  Tag,
  Workflow,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ageOf } from '@/lib/age';
import type { RepoRow } from '@/lib/repoHealth';
import { cn } from '@/lib/utils';
import { ACTIVITY, ColumnChart, NEUTRAL, SERIES } from '../overview/charts';

export interface Run {
  status: string;
  conclusion: string;
  workflowName: string;
  displayTitle: string;
  url: string;
  headBranch: string;
  createdAt: string;
  event?: string;
}

export interface Release {
  tagName: string;
  name?: string;
  publishedAt: string;
  isLatest?: boolean;
  isPrerelease?: boolean;
}

export interface RepoInfo {
  description?: string;
  url?: string;
  homepageUrl?: string;
  stargazerCount?: number;
  forkCount?: number;
  isPrivate?: boolean;
  isArchived?: boolean;
  pushedAt?: string;
  languages?: { size: number; node: { name: string } }[];
  defaultBranchRef?: { name: string };
  repositoryTopics?: { name: string }[];
}

function SideCard({ icon: Icon, title, children, action }: { icon: typeof Info; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="flex items-center justify-between px-5">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="size-4" /> {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="px-5">{children}</CardContent>
    </Card>
  );
}

export function runState(run?: Run) {
  if (!run) return { label: 'No CI', icon: CircleDashed, cls: 'text-muted-foreground' };
  if (run.status !== 'completed') return { label: 'Running', icon: CircleDashed, cls: 'text-warning' };
  if (run.conclusion === 'success') return { label: 'Passing', icon: CircleCheck, cls: 'text-success' };
  if (['failure', 'timed_out', 'startup_failure'].includes(run.conclusion)) return { label: 'Failing', icon: CircleX, cls: 'text-destructive' };
  return { label: run.conclusion || 'Unknown', icon: CircleDashed, cls: 'text-muted-foreground' };
}

export function ActivityCard({ participation }: { participation?: { all?: number[]; owner?: number[] } }) {
  const weeks = 26;
  const all = participation?.all?.slice(-weeks) ?? [];
  const mine = participation?.owner?.slice(-weeks) ?? [];
  const total = all.reduce((s, n) => s + n, 0);
  const yours = mine.reduce((s, n) => s + n, 0);
  const data = all.map((count, i) => {
    const weeksAgo = all.length - 1 - i;
    return { label: weeksAgo === 0 ? 'now' : weeksAgo % 8 === 0 ? `-${weeksAgo}w` : '', detail: weeksAgo === 0 ? 'this week' : `${weeksAgo} weeks ago`, count };
  });

  return (
    <SideCard icon={Activity} title="Commit activity">
      {all.length === 0 ? (
        <p className="text-muted-foreground text-xs">GitHub is still computing commit stats for this repo — check back in a minute.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <ColumnChart data={data} color={ACTIVITY} noun="commits" height={64} ariaLabel={`Weekly commits on the default branch, last ${weeks} weeks: ${total} total`} />
          <p className="text-muted-foreground text-xs">
            <strong className="text-foreground">{total}</strong> commits to the default branch in 6 months
            {total > 0 && (
              <>
                {' '}
                · {Math.round((yours / total) * 100)}% by the owner
              </>
            )}
          </p>
        </div>
      )}
    </SideCard>
  );
}

export function ReleaseCard({
  lastTag,
  releases,
  unreleased,
  onCutRelease,
}: {
  lastTag: string;
  releases: Release[];
  unreleased: number;
  onCutRelease: () => void;
}) {
  const latest = releases.find((r) => r.isLatest) ?? releases[0];
  const hasTag = lastTag && lastTag !== 'N/A';
  return (
    <SideCard
      icon={Tag}
      title="Releases"
      action={
        <Button size="xs" variant="ghost" onClick={onCutRelease}>
          <Rocket /> Cut release
        </Button>
      }
    >
      {!hasTag ? (
        <p className="text-muted-foreground text-xs">No releases or tags yet. Shipping a first version makes progress visible.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-lg font-bold">{lastTag}</span>
            {latest?.publishedAt && <span className="text-muted-foreground text-xs">{ageOf(latest.publishedAt).label}</span>}
          </div>
          {unreleased >= 0 && (
            <p className={cn('rounded-md px-3 py-2 text-xs', unreleased > 0 ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success')}>
              {unreleased > 0 ? `${unreleased} commit${unreleased === 1 ? '' : 's'} on the default branch since ${lastTag}` : `Default branch matches ${lastTag}`}
            </p>
          )}
          {releases.length > 1 && (
            <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
              {releases.slice(0, 5).map((r) => (
                <li key={r.tagName} className="flex justify-between gap-2">
                  <span className="font-mono">
                    {r.tagName}
                    {r.isPrerelease && <span className="ml-1 text-[0.6rem] uppercase">pre</span>}
                  </span>
                  <span>{ageOf(r.publishedAt).label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </SideCard>
  );
}

export function CICard({ runs, defaultBranch }: { runs: Run[]; defaultBranch?: string }) {
  return (
    <SideCard icon={Workflow} title="CI runs">
      {runs.length === 0 ? (
        <p className="text-muted-foreground text-xs">No GitHub Actions runs found for this repository.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {runs.slice(0, 6).map((run) => {
            const st = runState(run);
            return (
              <li key={run.url}>
                <a href={run.url} target="_blank" rel="noreferrer" className="hover:bg-muted/50 -mx-2 flex items-start gap-2 rounded-md px-2 py-1">
                  <st.icon className={cn('mt-0.5 size-4 shrink-0', st.cls)} aria-label={st.label} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{run.displayTitle}</div>
                    <div className="text-muted-foreground flex items-center gap-1 text-[0.68rem]">
                      <span className="truncate">{run.workflowName}</span>·
                      <span className={cn('truncate font-mono', run.headBranch === defaultBranch && 'text-foreground')}>{run.headBranch}</span>·
                      <span className="shrink-0">{ageOf(run.createdAt).label}</span>
                    </div>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </SideCard>
  );
}

export function AboutCard({ info }: { info?: RepoInfo }) {
  const langs = [...(info?.languages ?? [])].sort((a, b) => b.size - a.size);
  const total = langs.reduce((s, l) => s + l.size, 0);
  const top = langs.slice(0, SERIES.length).map((l, i) => ({ name: l.node.name, size: l.size, color: SERIES[i] }));
  const rest = langs.slice(SERIES.length).reduce((s, l) => s + l.size, 0);
  const parts = rest > 0 ? [...top, { name: 'Other', size: rest, color: NEUTRAL }] : top;
  const pct = (n: number) => (total ? `${((n / total) * 100).toFixed(n / total < 0.1 ? 1 : 0)}%` : '0%');

  return (
    <SideCard icon={Info} title="About">
      <div className="flex flex-col gap-3 text-xs">
        <p className={cn(info?.description ? 'text-foreground text-sm' : 'text-muted-foreground')}>
          {info?.description || 'No description on GitHub.'}
        </p>
        {!!info?.repositoryTopics?.length && (
          <div className="flex flex-wrap gap-1">
            {info.repositoryTopics.map((t) => (
              <span key={t.name} className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[0.65rem] font-medium">
                {t.name}
              </span>
            ))}
          </div>
        )}
        {parts.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={parts.map((p) => `${p.name} ${pct(p.size)}`).join(', ')}>
              {parts.map((p) => (
                <div key={p.name} style={{ width: `${(p.size / total) * 100}%`, backgroundColor: p.color }} />
              ))}
            </div>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
              {parts.map((p) => (
                <li key={p.name} className="flex items-center gap-1.5">
                  <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: p.color }} />
                  <span className="truncate">{p.name}</span>
                  <span className="text-muted-foreground ml-auto tabular-nums">{pct(p.size)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <Star className="size-3.5" /> {info?.stargazerCount ?? 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <GitFork className="size-3.5" /> {info?.forkCount ?? 0}
          </span>
          {info?.defaultBranchRef?.name && (
            <span className="inline-flex items-center gap-1 font-mono">
              <GitBranch className="size-3.5" /> {info.defaultBranchRef.name}
            </span>
          )}
          {info?.pushedAt && <span>pushed {ageOf(info.pushedAt).label.toLowerCase()}</span>}
        </div>
        {info?.homepageUrl && (
          <a href={info.homepageUrl} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 truncate hover:underline">
            <Link2 className="size-3.5 shrink-0" /> {info.homepageUrl.replace(/^https?:\/\//, '')}
          </a>
        )}
      </div>
    </SideCard>
  );
}

export function LocalCard({ row, onOpen }: { row: RepoRow; onOpen: (target: 'editor' | 'terminal') => void }) {
  return (
    <SideCard icon={Laptop} title="Local clone">
      <div className="flex flex-col gap-3 text-xs">
        <div className="text-muted-foreground truncate font-mono" title={row.path}>
          {row.path}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {row.branch && (
            <span className="inline-flex items-center gap-1 font-mono">
              <GitBranch className="size-3.5" /> {row.branch}
            </span>
          )}
          {row.lastCommit && <span className="text-muted-foreground">last commit {ageOf(row.lastCommit).label.toLowerCase()}</span>}
        </div>
        {(row.uncommitted > 0 || row.unpushed > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {row.uncommitted > 0 && (
              <span className="bg-warning/12 text-warning inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold">
                <FilePen className="size-3" /> {row.uncommitted} uncommitted
              </span>
            )}
            {row.unpushed > 0 && (
              <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold">
                <ArrowUpFromLine className="size-3" /> {row.unpushed} unpushed
              </span>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <Button size="xs" variant="outline" onClick={() => onOpen('editor')}>
            <Code /> VS Code
          </Button>
          <Button size="xs" variant="outline" onClick={() => onOpen('terminal')}>
            <SquareTerminal /> Terminal
          </Button>
        </div>
      </div>
    </SideCard>
  );
}

export function GitHubLink({ url }: { url: string }) {
  return (
    <Button variant="outline" size="sm" asChild>
      <a href={url} target="_blank" rel="noreferrer">
        GitHub <ExternalLink />
      </a>
    </Button>
  );
}
