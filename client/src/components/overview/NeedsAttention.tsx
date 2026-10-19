import { useMemo, useState } from 'react';
import {
  ArrowUpFromLine,
  BellRing,
  CircleAlert,
  CircleCheck,
  Eye,
  FilePen,
  GitPullRequest,
  Hourglass,
  OctagonX,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { LocalRepoPulse, SearchPR } from '@/lib/contributions';
import { cn } from '@/lib/utils';

type Severity = 'critical' | 'warning' | 'info';

const SEVERITY: Record<Severity, { label: string; cls: string; rank: number }> = {
  critical: { label: 'Urgent', cls: 'text-destructive bg-destructive/10', rank: 0 },
  warning: { label: 'Soon', cls: 'text-warning bg-warning/12', rank: 1 },
  info: { label: 'Tidy', cls: 'text-muted-foreground bg-muted', rank: 2 },
};

interface Item {
  key: string;
  severity: Severity;
  icon: LucideIcon;
  title: string;
  meta: string;
  url?: string;
  action?: { label: string; run: () => void };
  age: number; // days, for ordering within a severity
}

export interface DeliveryData {
  authoredOpen: SearchPR[];
  reviewRequests: SearchPR[];
  merged: SearchPR[];
  assignedIssues: SearchPR[];
  focus: {
    repo: string;
    branch: string;
    runs: { status: string; conclusion: string; workflowName: string; displayTitle: string; url: string; headBranch: string; createdAt: string }[];
  };
}

const COLLAPSED = 6;
const daysSince = (iso?: string) => (iso ? (Date.now() - new Date(iso).getTime()) / 86400000 : 0);
const ago = (days: number) => (days < 1 ? 'today' : days < 60 ? `${Math.floor(days)}d ago` : `${Math.floor(days / 30)}mo ago`);
const repoOf = (p: SearchPR) => p.repository?.name ?? '';

export default function NeedsAttention({
  delivery,
  pulses,
  loading,
  onFocusRepo,
}: {
  delivery: DeliveryData | null;
  pulses: LocalRepoPulse[];
  loading: boolean;
  onFocusRepo: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];

    // CI on the focus repo: the latest finished run on the checked-out branch (or any branch)
    const runs = delivery?.focus.runs ?? [];
    const finished = runs.filter((r) => r.status === 'completed');
    const latest = finished.find((r) => !delivery?.focus.branch || r.headBranch === delivery.focus.branch) ?? finished[0];
    if (latest && ['failure', 'timed_out', 'startup_failure'].includes(latest.conclusion)) {
      out.push({
        key: `ci-${latest.url}`,
        severity: 'critical',
        icon: OctagonX,
        title: `CI failing on ${delivery!.focus.repo} (${latest.headBranch})`,
        meta: `${latest.workflowName} · ${latest.displayTitle} · ${ago(daysSince(latest.createdAt))}`,
        url: latest.url,
        age: daysSince(latest.createdAt),
      });
    }

    for (const pr of delivery?.reviewRequests ?? []) {
      const age = daysSince(pr.createdAt);
      out.push({
        key: `rr-${pr.url}`,
        severity: age > 2 ? 'critical' : 'warning',
        icon: Eye,
        title: `Review requested: ${pr.title}`,
        meta: `${repoOf(pr)}#${pr.number}${pr.author?.login ? ` by @${pr.author.login}` : ''} · waiting ${ago(age).replace(' ago', '')}`,
        url: pr.url,
        age,
      });
    }

    for (const pr of delivery?.authoredOpen ?? []) {
      const idle = daysSince(pr.updatedAt ?? pr.createdAt);
      if (idle < 7) continue;
      out.push({
        key: `pr-${pr.url}`,
        severity: idle > 30 ? 'info' : 'warning',
        icon: idle > 30 ? Hourglass : GitPullRequest,
        title: `${pr.isDraft ? 'Draft' : 'Your PR'} has gone quiet: ${pr.title}`,
        meta: `${repoOf(pr)}#${pr.number} · no activity for ${ago(idle).replace(' ago', '')} — merge, nudge or close`,
        url: pr.url,
        age: idle,
      });
    }

    for (const issue of delivery?.assignedIssues ?? []) {
      const idle = daysSince(issue.updatedAt ?? issue.createdAt);
      if (idle < 14) continue;
      out.push({
        key: `is-${issue.url}`,
        severity: 'info',
        icon: CircleAlert,
        title: `Assigned issue idle: ${issue.title}`,
        meta: `${repoOf(issue)}#${issue.number} · untouched for ${ago(idle).replace(' ago', '')}`,
        url: issue.url,
        age: idle,
      });
    }

    let dormantDirty = 0;
    for (const p of pulses) {
      const sinceCommit = daysSince(p.lastCommit);
      if (p.unpushed > 0) {
        out.push({
          key: `up-${p.path}`,
          severity: 'warning',
          icon: ArrowUpFromLine,
          title: `${p.unpushed} unpushed commit${p.unpushed === 1 ? '' : 's'} in ${p.name}`,
          meta: 'Only on this machine — push to back it up',
          action: { label: 'Focus', run: () => onFocusRepo(p.path) },
          age: sinceCommit,
        });
      }
      if (p.uncommitted > 0) {
        if (p.lastCommit && sinceCommit <= 30) {
          out.push({
            key: `uc-${p.path}`,
            severity: 'warning',
            icon: FilePen,
            title: `${p.uncommitted} uncommitted file${p.uncommitted === 1 ? '' : 's'} in ${p.name}`,
            meta: `Last commit ${ago(sinceCommit)} — commit or stash before it drifts`,
            action: { label: 'Focus', run: () => onFocusRepo(p.path) },
            age: sinceCommit,
          });
        } else dormantDirty++;
      }
    }
    if (dormantDirty > 0) {
      out.push({
        key: 'dormant-dirty',
        severity: 'info',
        icon: FilePen,
        title: `${dormantDirty} dormant repo${dormantDirty === 1 ? ' has' : 's have'} uncommitted changes`,
        meta: 'Forgotten experiments? Commit, stash or discard them — see Project pulse',
        age: 0,
      });
    }

    return out.sort((a, b) => SEVERITY[a.severity].rank - SEVERITY[b.severity].rank || b.age - a.age);
  }, [delivery, pulses, onFocusRepo]);

  const counts = items.reduce<Record<Severity, number>>((acc, i) => ({ ...acc, [i.severity]: acc[i.severity] + 1 }), {
    critical: 0,
    warning: 0,
    info: 0,
  });
  const visible = expanded ? items : items.slice(0, COLLAPSED);

  return (
    <Card className="h-full gap-0 overflow-hidden pb-0">
      <CardHeader className="border-b pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="size-4" /> Needs attention
        </CardTitle>
        <CardDescription>CI, reviews, stale PRs and unsaved local work</CardDescription>
        {!loading && items.length > 0 && (
          <CardAction className="flex gap-1.5">
            {(Object.keys(SEVERITY) as Severity[])
              .filter((s) => counts[s] > 0)
              .map((s) => (
                <span key={s} className={cn('rounded-full px-2 py-0.5 text-[0.65rem] font-bold', SEVERITY[s].cls)}>
                  {counts[s]} {SEVERITY[s].label.toLowerCase()}
                </span>
              ))}
          </CardAction>
        )}
      </CardHeader>
      {loading ? (
        <CardContent className="flex flex-col gap-3 py-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      ) : items.length === 0 ? (
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <CircleCheck className="text-success size-8" />
          <p className="font-semibold">All clear</p>
          <p className="text-muted-foreground text-sm">No failing CI, pending reviews or unsaved work.</p>
        </CardContent>
      ) : (
        <>
          <ul className="divide-y">
            {visible.map((item) => {
              const sev = SEVERITY[item.severity];
              const Icon = item.icon;
              return (
                <li key={item.key} className="hover:bg-muted/40 flex items-start gap-3 px-6 py-3 transition-colors">
                  <span className={cn('mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md', sev.cls)}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer" className="hover:text-primary line-clamp-1 text-sm font-medium" title={item.title}>
                        {item.title}
                      </a>
                    ) : (
                      <div className="line-clamp-1 text-sm font-medium">{item.title}</div>
                    )}
                    <div className="text-muted-foreground line-clamp-1 text-xs">{item.meta}</div>
                  </div>
                  <span className={cn('hidden shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] font-bold uppercase sm:inline', sev.cls)}>
                    {sev.label}
                  </span>
                  {item.action && (
                    <Button size="xs" variant="ghost" onClick={item.action.run} className="shrink-0">
                      {item.action.label}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          {items.length > COLLAPSED && (
            <div className="bg-muted/30 border-t px-6 py-2.5">
              <Button size="xs" variant="ghost" onClick={() => setExpanded((e) => !e)}>
                {expanded ? 'Show less' : `Show all ${items.length}`}
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
