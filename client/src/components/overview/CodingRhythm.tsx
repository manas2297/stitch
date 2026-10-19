import { useMemo } from 'react';
import { Clock } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatHour, RANGES, rhythm, WEEKDAYS, type LocalCommit, type RangeKey } from '@/lib/contributions';
import { ColumnChart, SERIES } from './charts';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded-lg px-3 py-2">
      <div className="text-muted-foreground text-[0.68rem] font-semibold tracking-wider uppercase">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

export default function CodingRhythm({ commits, range, loading }: { commits: LocalCommit[]; range: RangeKey; loading: boolean }) {
  const r = useMemo(() => rhythm(commits), [commits]);
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  const weekdayData = r.weekday.map((count, i) => ({ label: WEEKDAYS[i], detail: WEEKDAYS[i], count }));
  const hourData = r.hours.map((count, h) => ({
    label: formatHour(h),
    detail: `${formatHour(h)}–${formatHour(h + 1)}`,
    count,
  }));

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="size-4" /> Coding rhythm
        </CardTitle>
        <CardDescription>When you commit locally, {RANGES[range].long}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : r.total === 0 ? (
          <p className="text-muted-foreground text-sm">No local commits in this period. Add local repositories to see your rhythm.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_minmax(0,1.2fr)]">
            <div className="min-w-0">
              <div className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">By weekday</div>
              <ColumnChart data={weekdayData} color={SERIES[0]} noun="commits" highlight={r.peakDay} ariaLabel={`Commits by weekday; busiest is ${WEEKDAYS[r.peakDay]}`} />
            </div>
            <div className="min-w-0">
              <div className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">By hour of day</div>
              <ColumnChart data={hourData} color={SERIES[0]} noun="commits" labelEvery={6} ariaLabel={`Commits by hour; busiest window starts ${formatHour(r.peakStart)}`} />
            </div>
            <div className="grid grid-cols-2 content-start gap-2 lg:grid-cols-1">
              <Fact label="Busiest day" value={WEEKDAYS[r.peakDay]} />
              <Fact label="Peak window" value={`${formatHour(r.peakStart)}–${formatHour(r.peakStart + 3)}`} />
              <Fact label="Weekends" value={`${pct(r.weekendShare)} of commits`} />
              <Fact label="Late night (10pm–5am)" value={`${pct(r.nightShare)} of commits`} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
