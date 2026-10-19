import { ExternalLink, Lock, Trophy } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { compactNumber, RANGES, type RangeKey } from '@/lib/contributions';
import { SERIES, ShareBar } from './charts';
import type { GraphKind } from './ContributionCalendar';

export interface RepoShare {
  name: string;
  count: number;
  url?: string;
  isPrivate?: boolean;
  added?: number;
  deleted?: number;
}

export default function TopRepos({
  repos,
  kind,
  range,
  loading,
}: {
  repos: RepoShare[];
  kind: GraphKind;
  range: RangeKey;
  loading: boolean;
}) {
  const top = repos.slice(0, 6);
  const total = repos.reduce((s, r) => s + r.count, 0);
  const max = top[0]?.count ?? 0;
  const focusShare = total ? Math.round((max / total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="size-4" /> Where your commits went
        </CardTitle>
        <CardDescription>
          {kind === 'github' ? 'GitHub commits' : 'Local commits'} by repository, {RANGES[range].long}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loading ? (
          <Skeleton className="h-36 w-full" />
        ) : top.length === 0 ? (
          <p className="text-muted-foreground text-sm">No commits in this period.</p>
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {top.map((r, i) => (
                <li key={`${r.name}-${i}`} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-1.5 font-medium">
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noreferrer" className="hover:text-primary inline-flex min-w-0 items-center gap-1">
                          <span className="truncate">{r.name}</span>
                          <ExternalLink className="text-muted-foreground size-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="truncate">{r.name}</span>
                      )}
                      {r.isPrivate && <Lock className="text-muted-foreground size-3 shrink-0" aria-label="Private" />}
                    </span>
                    <span className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs tabular-nums">
                      {r.added !== undefined && (
                        <span>
                          <span className="text-success">+{compactNumber(r.added)}</span>{' '}
                          <span className="text-destructive">−{compactNumber(r.deleted ?? 0)}</span>
                        </span>
                      )}
                      <strong className="text-foreground">{r.count}</strong>
                    </span>
                  </div>
                  <ShareBar value={r.count} max={max} color={SERIES[0]} />
                </li>
              ))}
            </ul>
            {repos.length > 1 && (
              <p className="text-muted-foreground text-xs">
                <strong className="text-foreground">{top[0].name}</strong> took {focusShare}% of your commits across {repos.length} repos
                {focusShare >= 60 ? ' — deep focus.' : focusShare < 30 ? ' — spread thin across many projects.' : '.'}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
