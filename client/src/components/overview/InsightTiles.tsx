import type { ReactNode } from 'react';
import { Activity, CalendarCheck, Code2, Flame, GitPullRequest, TrendingDown, TrendingUp, Zap, type LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { compactNumber, formatDay, percentDelta, RANGES, type RangeKey, type RangeStats } from '@/lib/contributions';
import { cn } from '@/lib/utils';
import type { GraphKind } from './ContributionCalendar';

function Tile({ icon: Icon, label, value, sub, loading }: { icon: LucideIcon; label: string; value: ReactNode; sub?: ReactNode; loading: boolean }) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="flex flex-col gap-1 px-4">
        <div className="text-muted-foreground flex items-center gap-1.5 text-[0.7rem] font-semibold tracking-wider uppercase">
          <Icon className="size-3.5" /> {label}
        </div>
        {loading ? (
          <Skeleton className="mt-1 h-8 w-20" />
        ) : (
          <div className="text-[1.75rem] leading-tight font-extrabold tracking-tight tabular-nums">{value}</div>
        )}
        <div className="text-muted-foreground min-h-4 text-xs">{!loading && sub}</div>
      </CardContent>
    </Card>
  );
}

/** Percentages off a tiny base are noise ("+3500%"), so compare raw counts instead. */
function smallBase(prev: number | null, pct: number | null) {
  return prev !== null && (prev < 10 || (pct !== null && Math.abs(pct) >= 300));
}

export function Delta({ current, prev, range }: { current: number; prev: number | null; range: RangeKey }) {
  if (prev === null) return <span>no earlier period to compare</span>;
  const pct = percentDelta(current, prev);
  const up = current >= prev;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn('inline-flex items-center gap-0.5 font-semibold', up ? 'text-success' : 'text-destructive')}>
        <Icon className="size-3.5" />
        {smallBase(prev, pct) ? `${up ? 'up' : 'down'} from ${prev}` : `${up ? '+' : ''}${pct}%`}
      </span>
      vs previous {RANGES[range].short}
    </span>
  );
}

export function headline(stats: RangeStats, range: RangeKey, kind: GraphKind, streak: number) {
  const noun = kind === 'github' ? 'contributions' : 'commits';
  const n = RANGES[range].days;
  if (stats.total === 0) return `No ${noun} in the ${RANGES[range].long} — a good day to start a streak.`;
  const pct = percentDelta(stats.total, stats.prevTotal);
  const prev = stats.prevTotal;
  const trend =
    prev === null
      ? ''
      : stats.total === prev
        ? ', level with the period before'
        : smallBase(prev, pct)
          ? `, ${stats.total > prev ? 'up' : 'down'} from ${prev} the period before`
          : `, ${pct! > 0 ? 'up' : 'down'} ${Math.abs(pct!)}% on the period before`;
  const streakNote = streak >= 3 ? ` You're on a ${streak}-day streak.` : '';
  return `You shipped ${stats.total} ${noun} on ${stats.activeDays} of the last ${n} days${trend}.${streakNote}`;
}

export default function InsightTiles({
  stats,
  range,
  kind,
  streaks,
  loading,
  lines,
  collaboration,
}: {
  stats: RangeStats | null;
  range: RangeKey;
  kind: GraphKind;
  streaks: { current: number; longest: number };
  loading: boolean;
  lines: { added: number; deleted: number } | null;
  collaboration: { prs: number; reviews: number } | null;
}) {
  const noun = kind === 'github' ? 'Contributions' : 'Commits';
  const s = stats;
  const n = RANGES[range].days;

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <Tile
        icon={Activity}
        label={noun}
        loading={loading || !s}
        value={s?.total ?? 0}
        sub={s && <Delta current={s.total} prev={s.prevTotal} range={range} />}
      />
      <Tile
        icon={CalendarCheck}
        label="Active days"
        loading={loading || !s}
        value={
          <>
            {s?.activeDays ?? 0}
            <span className="text-muted-foreground text-base font-semibold">/{n}</span>
          </>
        }
        sub={s && `${Math.round(s.consistency * 100)}% consistency · best run ${s.longestRun}d`}
      />
      <Tile
        icon={Flame}
        label="Current streak"
        loading={loading || !s}
        value={`${streaks.current}d`}
        sub={streaks.current > 0 && streaks.current >= streaks.longest ? 'personal best this year' : `best this year: ${streaks.longest}d`}
      />
      <Tile
        icon={Zap}
        label="Per active day"
        loading={loading || !s}
        value={s ? s.avgPerActiveDay.toFixed(1) : '0'}
        sub={s?.bestDay && `peak ${s.bestDay.count} on ${formatDay(s.bestDay.date)}`}
      />
      {kind === 'local' ? (
        <Tile
          icon={Code2}
          label="Lines changed"
          loading={loading || !lines}
          value={
            <span className="text-[1.4rem]">
              <span className="text-success">+{compactNumber(lines?.added ?? 0)}</span>{' '}
              <span className="text-destructive">−{compactNumber(lines?.deleted ?? 0)}</span>
            </span>
          }
          sub={lines && `net ${lines.added - lines.deleted >= 0 ? '+' : '−'}${compactNumber(Math.abs(lines.added - lines.deleted))} lines`}
        />
      ) : (
        <Tile
          icon={GitPullRequest}
          label="PRs & reviews"
          loading={loading || !collaboration}
          value={(collaboration?.prs ?? 0) + (collaboration?.reviews ?? 0)}
          sub={collaboration && `${collaboration.prs} PRs opened · ${collaboration.reviews} reviews`}
        />
      )}
    </div>
  );
}
