import { useEffect, useMemo, useRef } from 'react';
import { Flame, GitCommit, GitGraph, Trophy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { computeMonthLabels, computeStreaks, type ContributionWeek } from '@/lib/contributions';
import { cn } from '@/lib/utils';

const LEGEND = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];

interface Graph {
  weeks?: ContributionWeek[];
  total?: number;
  username?: string;
}

export type GraphKind = 'github' | 'local';

export default function ContributionCalendar({
  graph,
  loading,
  kind,
  onKindChange,
}: {
  graph?: Graph | null;
  loading: boolean;
  kind: GraphKind;
  onKindChange: (kind: GraphKind) => void;
}) {
  const streaks = useMemo(() => computeStreaks(graph?.weeks), [graph]);
  const monthLabels = useMemo(() => computeMonthLabels(graph?.weeks), [graph]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Show the most recent weeks first on narrow screens
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [graph, loading]);

  const noun = kind === 'github' ? 'contributions' : 'commits';

  return (
    <Card className="mb-6">
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-muted-foreground flex items-center gap-1.5 text-sm font-bold tracking-wider uppercase">
              <Flame className="size-4 text-amber-500" /> Consistency &amp; Activity
            </h3>
            <div className="bg-muted/60 flex gap-1 rounded-lg border p-0.5">
              <Button size="xs" variant={kind === 'github' ? 'default' : 'ghost'} onClick={() => onKindChange('github')}>
                <GitGraph /> GitHub Graph
              </Button>
              <Button size="xs" variant={kind === 'local' ? 'default' : 'ghost'} onClick={() => onKindChange('local')}>
                <GitCommit /> Local Commits
              </Button>
            </div>
            {!loading && graph?.weeks && (
              <div className="flex gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-orange-300/50 bg-orange-100/60 px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-orange-600">
                  <Flame className="size-3" /> {streaks.current}d streak
                </span>
                <span className="text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold whitespace-nowrap">
                  <Trophy className="size-3" /> {streaks.longest}d best
                </span>
              </div>
            )}
          </div>
          {!loading && graph && (
            <span className="text-muted-foreground text-sm">
              {kind === 'github' ? (
                <>
                  <strong className="text-foreground">{graph.total}</strong> contributions ·{' '}
                  <strong className="text-foreground">@{graph.username}</strong>
                </>
              ) : (
                <>
                  <strong className="text-foreground">{graph.total}</strong> local commits this year
                </>
              )}
            </span>
          )}
        </div>

        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : graph?.weeks ? (
          <>
            <div ref={scrollRef} className="overflow-x-auto pb-1">
              <div className="flex w-max gap-2 text-xs">
                <div className="text-muted-foreground grid grid-rows-[repeat(7,10px)] gap-[3px] pt-[15px] pr-1 text-right text-[0.65rem] leading-[10px]">
                  <span /> <span>Mon</span> <span /> <span>Wed</span> <span /> <span>Fri</span> <span />
                </div>
                <div className="flex flex-col">
                  <div className="mb-[3px] flex gap-[3px]">
                    {monthLabels.map((label, i) => (
                      <div key={i} className="text-muted-foreground h-3 w-2.5 shrink-0 overflow-visible text-[0.6rem] whitespace-nowrap">
                        {label}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-[3px]">
                    {graph.weeks.map((week, w) => (
                      <div key={w} className="grid grid-rows-[repeat(7,10px)] gap-[3px]">
                        {week.contributionDays.map((day, d) => (
                          <div
                            key={d}
                            className="size-2.5 rounded-[2px] transition-transform hover:scale-125"
                            style={{ backgroundColor: day.color || LEGEND[0] }}
                            title={`${day.contributionCount} ${noun} on ${new Date(day.date).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className={cn('text-muted-foreground flex items-center justify-end gap-1 text-[0.62rem]')}>
              Less
              {LEGEND.map((c) => (
                <span key={c} className="size-2.5 rounded-[2px]" style={{ backgroundColor: c }} />
              ))}
              More
            </div>
          </>
        ) : (
          <p className="text-muted-foreground py-2 text-sm">
            Contribution graph unavailable. Ensure your git config is set or GitHub CLI is authenticated.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
