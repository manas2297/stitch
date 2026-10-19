import { useState } from 'react';
import { PieChart } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RANGES, type GitHubWindow, type RangeKey } from '@/lib/contributions';
import { cn } from '@/lib/utils';
import { NEUTRAL, SERIES } from './charts';

export default function ContributionMix({ window, range, loading }: { window?: GitHubWindow; range: RangeKey; loading: boolean }) {
  const [hover, setHover] = useState<number | null>(null);

  const parts = window
    ? [
        { label: 'Commits', value: window.commits, color: SERIES[0] },
        { label: 'Pull requests', value: window.pullRequests, color: SERIES[1] },
        { label: 'Code reviews', value: window.reviews, color: SERIES[2] },
        { label: 'Issues', value: window.issues, color: SERIES[3] },
        { label: 'Private & other', value: window.private + window.repositories, color: NEUTRAL },
      ]
    : [];
  const total = parts.reduce((s, p) => s + p.value, 0);
  const visible = parts.filter((p) => p.value > 0);
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);

  // A nudge for the most under-represented collaborative habit
  const tip = !window
    ? null
    : window.reviews === 0 && window.pullRequests > 0
      ? 'No code reviews yet this period — reviewing teammates’ PRs counts too.'
      : window.pullRequests === 0 && window.commits > 0
        ? 'All commits, no PRs — opening PRs makes work easier to review and track.'
        : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PieChart className="size-4" /> Contribution mix
        </CardTitle>
        <CardDescription>What your GitHub activity was made of, {RANGES[range].long}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <Skeleton className="h-28 w-full" />
        ) : !window || total === 0 ? (
          <p className="text-muted-foreground text-sm">No GitHub contributions in this period.</p>
        ) : (
          <>
            <div
              role="img"
              aria-label={visible.map((p) => `${p.label} ${p.value}`).join(', ')}
              className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full"
              onMouseLeave={() => setHover(null)}
            >
              {visible.map((p, i) => (
                <div
                  key={p.label}
                  onMouseEnter={() => setHover(i)}
                  className={cn('h-full transition-opacity', hover !== null && hover !== i && 'opacity-40')}
                  style={{ width: `${(p.value / total) * 100}%`, backgroundColor: p.color }}
                />
              ))}
            </div>
            <ul className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {parts.map((p) => {
                const vi = visible.indexOf(p);
                return (
                  <li
                    key={p.label}
                    onMouseEnter={() => vi >= 0 && setHover(vi)}
                    onMouseLeave={() => setHover(null)}
                    className={cn('flex items-center gap-2', hover !== null && visible[hover] !== p && 'opacity-50')}
                  >
                    <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: p.color }} />
                    <span className="text-muted-foreground flex-1">{p.label}</span>
                    <span className="font-semibold tabular-nums">{p.value}</span>
                    <span className="text-muted-foreground w-9 text-right text-xs tabular-nums">{pct(p.value)}%</span>
                  </li>
                );
              })}
            </ul>
            {tip && <p className="bg-muted/60 text-muted-foreground rounded-md px-3 py-2 text-xs">{tip}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
