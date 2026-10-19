import { useMemo } from 'react';
import { GitMerge } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  addDays,
  CYCLE_BUCKETS,
  cycleTimes,
  formatDuration,
  median,
  RANGES,
  type RangeKey,
  type RangeStats,
  type SearchPR,
} from '@/lib/contributions';
import { cn } from '@/lib/utils';
import { SERIES, ShareBar } from './charts';

function Stat({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground text-[0.68rem] font-semibold tracking-wider uppercase">{label}</div>
      <div className="text-2xl font-extrabold tracking-tight tabular-nums">{value}</div>
      {sub && <div className="text-muted-foreground text-xs">{sub}</div>}
    </div>
  );
}

export default function Delivery({
  merged,
  openCount,
  stats,
  range,
  loading,
}: {
  merged: SearchPR[];
  openCount: number;
  stats: RangeStats | null;
  range: RangeKey;
  loading: boolean;
}) {
  const d = useMemo(() => {
    if (!stats) return null;
    const n = RANGES[range].days;
    const current = cycleTimes(merged, stats.start, stats.end);
    const previous = cycleTimes(merged, addDays(stats.start, -n), addDays(stats.start, -1));
    const med = median(current.map((c) => c.hours));
    const prevMed = median(previous.map((c) => c.hours));
    const buckets = CYCLE_BUCKETS.map((b, i) => ({
      ...b,
      count: current.filter((c) => c.hours < b.max && (i === 0 || c.hours >= CYCLE_BUCKETS[i - 1].max)).length,
    }));
    const slowest = [...current].sort((a, b) => b.hours - a.hours)[0];
    return { current, previous, med, prevMed, buckets, slowest };
  }, [merged, stats, range]);

  // Older history isn't fetched, so a full previous year can't be compared.
  const canCompare = range !== '365' && d?.prevMed != null;
  const faster = canCompare && d!.med != null && d!.med < d!.prevMed!;
  const maxBucket = Math.max(1, ...(d?.buckets.map((b) => b.count) ?? [0]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitMerge className="size-4" /> Delivery
        </CardTitle>
        <CardDescription>How fast your pull requests merge, {RANGES[range].long}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {loading || !d ? (
          <Skeleton className="h-40 w-full" />
        ) : d.current.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No merged PRs in this period{openCount ? ` — you have ${openCount} open` : ''}.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <Stat
                label="Merged"
                value={String(d.current.length)}
                sub={range !== '365' ? `${d.previous.length} the period before` : undefined}
              />
              <Stat
                label="Median to merge"
                value={d.med != null ? formatDuration(d.med) : '—'}
                sub={
                  canCompare ? (
                    <span className={cn('font-medium', faster ? 'text-success' : 'text-destructive')}>
                      {faster ? 'faster' : 'slower'} than {formatDuration(d.prevMed!)}
                    </span>
                  ) : undefined
                }
              />
              <Stat label="Still open" value={String(openCount)} sub="authored by you" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Time to merge</div>
              {d.buckets.map((b) => (
                <div key={b.label} className="grid grid-cols-[5.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-sm">
                  <span className="text-muted-foreground text-xs">{b.label}</span>
                  <ShareBar value={b.count} max={maxBucket} color={SERIES[0]} />
                  <span className="text-right font-semibold tabular-nums">{b.count}</span>
                </div>
              ))}
            </div>
            {d.slowest && d.slowest.hours >= 24 * 7 && (
              <p className="text-muted-foreground text-xs">
                Slowest:{' '}
                <a href={d.slowest.pr.url} target="_blank" rel="noreferrer" className="text-foreground hover:text-primary font-medium">
                  {d.slowest.pr.repository?.name}#{d.slowest.pr.number}
                </a>{' '}
                took {formatDuration(d.slowest.hours)}. Smaller PRs usually merge faster.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
