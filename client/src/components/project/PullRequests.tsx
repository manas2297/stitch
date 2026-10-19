import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Clock, ExternalLink, GitBranch, GitMerge, GitPullRequest, GitPullRequestClosed } from 'lucide-react';

import { ageOf } from '@/lib/age';
import { formatDuration } from '@/lib/contributions';
import { cn } from '@/lib/utils';
import { SegmentedToggle } from '../overview/charts';

export interface PR {
  number: number;
  title: string;
  url: string;
  state: 'OPEN' | 'MERGED' | 'CLOSED';
  author?: { login: string };
  createdAt: string;
  updatedAt?: string;
  mergedAt?: string;
  closedAt?: string;
  isDraft?: boolean;
  headRefName?: string;
  reviewDecision?: string;
  reviewRequests?: unknown[];
  additions?: number;
  deletions?: number;
}

type View = 'OPEN' | 'MERGED' | 'CLOSED';

const REVIEW: Record<string, { label: string; icon: typeof Check; cls: string }> = {
  APPROVED: { label: 'Approved', icon: Check, cls: 'bg-success/12 text-success' },
  CHANGES_REQUESTED: { label: 'Changes requested', icon: AlertTriangle, cls: 'bg-destructive/10 text-destructive' },
  REVIEW_REQUIRED: { label: 'Needs review', icon: Clock, cls: 'bg-warning/12 text-warning' },
};

/** T-shirt size from lines changed — big PRs are slow to review. */
export function prSize(pr: PR) {
  const lines = (pr.additions ?? 0) + (pr.deletions ?? 0);
  if (lines < 10) return { label: 'XS', cls: 'bg-muted text-muted-foreground' };
  if (lines < 100) return { label: 'S', cls: 'bg-muted text-muted-foreground' };
  if (lines < 500) return { label: 'M', cls: 'bg-primary/10 text-primary' };
  if (lines < 1000) return { label: 'L', cls: 'bg-warning/12 text-warning' };
  return { label: 'XL', cls: 'bg-destructive/10 text-destructive' };
}

const hoursBetween = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 3600000;

function PRRow({ pr }: { pr: PR }) {
  const size = prSize(pr);
  const review = pr.state === 'OPEN' && !pr.isDraft ? REVIEW[pr.reviewDecision ?? ''] : undefined;
  const Icon = pr.state === 'MERGED' ? GitMerge : pr.state === 'CLOSED' ? GitPullRequestClosed : GitPullRequest;
  const iconCls = pr.state === 'MERGED' ? 'text-violet' : pr.state === 'CLOSED' ? 'text-destructive' : pr.isDraft ? 'text-muted-foreground' : 'text-success';

  return (
    <li className="hover:bg-muted/40 flex items-start gap-3 px-5 py-3 transition-colors">
      <Icon className={cn('mt-0.5 size-4 shrink-0', iconCls)} aria-label={pr.isDraft ? 'Draft' : pr.state.toLowerCase()} />
      <div className="min-w-0 flex-1">
        <a href={pr.url} target="_blank" rel="noreferrer" className="hover:text-primary group inline-flex max-w-full items-start gap-1 text-sm font-medium">
          <span className="line-clamp-2">{pr.title}</span>
          <ExternalLink className="text-muted-foreground mt-1 size-3 shrink-0 opacity-0 group-hover:opacity-100" />
        </a>
        <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span>#{pr.number}</span>
          {pr.author?.login && <span>@{pr.author.login}</span>}
          {pr.headRefName && (
            <span className="inline-flex max-w-48 items-center gap-1 font-mono">
              <GitBranch className="size-3 shrink-0" /> <span className="truncate">{pr.headRefName}</span>
            </span>
          )}
          {pr.state === 'MERGED' && pr.mergedAt ? (
            <span>merged {ageOf(pr.mergedAt).label.toLowerCase()} · took {formatDuration(hoursBetween(pr.createdAt, pr.mergedAt))}</span>
          ) : pr.state === 'CLOSED' && pr.closedAt ? (
            <span>closed {ageOf(pr.closedAt).label.toLowerCase()}</span>
          ) : (
            <span>opened {ageOf(pr.createdAt).label.toLowerCase()}</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className="flex items-center gap-1">
          {pr.isDraft && pr.state === 'OPEN' && (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[0.65rem] font-bold">Draft</span>
          )}
          {review && (
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-bold', review.cls)}>
              <review.icon className="size-3" /> {review.label}
            </span>
          )}
          <span
            title={`+${pr.additions ?? 0} −${pr.deletions ?? 0} lines`}
            className={cn('rounded px-1.5 py-0.5 font-mono text-[0.65rem] font-bold', size.cls)}
          >
            {size.label}
          </span>
        </div>
        <span className="font-mono text-[0.65rem] tabular-nums">
          <span className="text-success">+{pr.additions ?? 0}</span> <span className="text-destructive">−{pr.deletions ?? 0}</span>
        </span>
      </div>
    </li>
  );
}

export default function PullRequests({ prs }: { prs: PR[] }) {
  const counts = useMemo(
    () => ({
      OPEN: prs.filter((p) => p.state === 'OPEN').length,
      MERGED: prs.filter((p) => p.state === 'MERGED').length,
      CLOSED: prs.filter((p) => p.state === 'CLOSED').length,
    }),
    [prs],
  );
  const [view, setView] = useState<View>(counts.OPEN ? 'OPEN' : 'MERGED');

  const list = useMemo(() => {
    const filtered = prs.filter((p) => p.state === view);
    // Open: oldest first so neglected PRs surface; history: most recent first.
    return view === 'OPEN'
      ? filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      : filtered.sort((a, b) => (b.mergedAt ?? b.closedAt ?? '').localeCompare(a.mergedAt ?? a.closedAt ?? ''));
  }, [prs, view]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
        <SegmentedToggle<View>
          ariaLabel="Pull request state"
          value={view}
          onChange={setView}
          options={[
            { value: 'OPEN', label: `Open ${counts.OPEN}` },
            { value: 'MERGED', label: `Merged ${counts.MERGED}` },
            { value: 'CLOSED', label: `Closed ${counts.CLOSED}` },
          ]}
        />
        <span className="text-muted-foreground hidden text-xs sm:inline">
          {view === 'OPEN' ? 'Oldest first' : 'Most recent first'} · last {prs.length} PRs
        </span>
      </div>
      {list.length === 0 ? (
        <p className="text-muted-foreground px-5 py-10 text-center text-sm">
          {view === 'OPEN' ? 'No open pull requests — nothing waiting to land.' : `No ${view.toLowerCase()} pull requests.`}
        </p>
      ) : (
        <ul className="divide-y">
          {list.map((pr) => (
            <PRRow key={pr.number} pr={pr} />
          ))}
        </ul>
      )}
    </div>
  );
}
