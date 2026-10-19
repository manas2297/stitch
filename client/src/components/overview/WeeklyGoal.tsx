import { useMemo } from 'react';
import { Check, Goal, Minus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDay, weeklyGoal, type ContributionWeek } from '@/lib/contributions';
import { cn } from '@/lib/utils';
import { ACTIVITY, ACTIVITY_FG } from './charts';
import type { GraphKind } from './ContributionCalendar';

function Ring({ value, goal }: { value: number; goal: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, value / goal);
  return (
    <svg viewBox="0 0 84 84" className="size-24 shrink-0" role="img" aria-label={`${value} of ${goal} active days this week`}>
      <circle cx="42" cy="42" r={r} fill="none" stroke="var(--muted)" strokeWidth="8" />
      <circle
        cx="42"
        cy="42"
        r={r}
        fill="none"
        stroke={ACTIVITY}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${frac * c} ${c}`}
        transform="rotate(-90 42 42)"
        className="transition-[stroke-dasharray] duration-500"
      />
      <text x="42" y="40" textAnchor="middle" className="fill-foreground text-[20px] font-extrabold">
        {value}
        <tspan className="fill-muted-foreground text-[12px] font-semibold">/{goal}</tspan>
      </text>
      <text x="42" y="56" textAnchor="middle" className="fill-muted-foreground text-[9px] font-semibold tracking-wider uppercase">
        days
      </text>
    </svg>
  );
}

export default function WeeklyGoal({
  weeks,
  goal,
  kind,
  loading,
  onGoalChange,
}: {
  weeks?: ContributionWeek[];
  goal: number;
  kind: GraphKind;
  loading: boolean;
  onGoalChange: (goal: number) => void;
}) {
  const g = useMemo(() => weeklyGoal(weeks, goal), [weeks, goal]);

  const status = g.current.hit
    ? g.current.active > goal
      ? `Goal smashed — ${g.current.active - goal} day${g.current.active - goal === 1 ? '' : 's'} over.`
      : 'Goal hit this week. Anything more is a bonus.'
    : g.reachable
      ? `${g.needed} more active day${g.needed === 1 ? '' : 's'} to go, ${g.daysLeft} left this week.`
      : `Out of reach this week — ${g.daysLeft} day${g.daysLeft === 1 ? '' : 's'} left for ${g.needed} needed.`;

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Goal className="size-4" /> Weekly goal
        </CardTitle>
        <CardDescription>Active {kind === 'github' ? 'GitHub' : 'local'} days, Sun–Sat</CardDescription>
        <CardAction className="flex items-center gap-1">
          <Button size="icon-xs" variant="outline" aria-label="Lower goal" disabled={goal <= 1} onClick={() => onGoalChange(goal - 1)}>
            <Minus />
          </Button>
          <span className="w-12 text-center text-xs font-semibold tabular-nums">{goal}d / wk</span>
          <Button size="icon-xs" variant="outline" aria-label="Raise goal" disabled={goal >= 7} onClick={() => onGoalChange(goal + 1)}>
            <Plus />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            <div className="flex items-center gap-4">
              <Ring value={g.current.active} goal={goal} />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm font-medium">{status}</p>
                <p className="text-muted-foreground text-xs">
                  {g.weekStreak > 0 ? `${g.weekStreak}-week goal streak · ` : ''}
                  hit {Math.round(g.hitRate * 100)}% of the last {g.history.length - 1} weeks
                </p>
              </div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1.5 text-[0.68rem] font-semibold tracking-wider uppercase">This week</div>
              <div className="grid grid-cols-7 gap-1.5">
                {g.thisWeekDays.map((d) => (
                  <div key={d.date} className="flex flex-col items-center gap-1">
                    <div
                      title={`${formatDay(d.date, { weekday: 'long' })}: ${d.future ? 'upcoming' : `${d.count} ${kind === 'github' ? 'contributions' : 'commits'}`}`}
                      className={cn(
                        'flex size-7 items-center justify-center rounded-full border text-[0.65rem] font-semibold tabular-nums',
                        d.count > 0 ? 'border-transparent' : d.future ? 'border-dashed' : 'bg-muted/50',
                        d.today && 'ring-foreground/40 ring-offset-card ring-2 ring-offset-1',
                      )}
                      style={d.count > 0 ? { backgroundColor: ACTIVITY, color: ACTIVITY_FG } : undefined}
                    >
                      {d.count > 0 ? d.count : ''}
                    </div>
                    <span className={cn('text-[0.6rem]', d.today ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
                      {formatDay(d.date, { weekday: 'narrow' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1.5 text-[0.68rem] font-semibold tracking-wider uppercase">Last 8 weeks</div>
              <div className="flex gap-1.5" role="list" aria-label="Goal results for recent weeks">
                {g.history.map((w) => (
                  <div
                    key={w.start}
                    role="listitem"
                    title={`Week of ${formatDay(w.start)}: ${w.active}/${goal} days${w.current ? ' (in progress)' : ''}`}
                    className={cn(
                      'flex h-8 flex-1 items-center justify-center rounded-md border text-[0.65rem] font-semibold tabular-nums',
                      w.hit ? 'border-transparent' : 'text-muted-foreground bg-muted/40',
                      w.current && !w.hit && 'border-dashed',
                    )}
                    style={w.hit ? { backgroundColor: ACTIVITY, color: ACTIVITY_FG } : undefined}
                  >
                    {w.hit ? <Check className="size-3.5" aria-label="hit" /> : `${w.active}/${goal}`}
                  </div>
                ))}
              </div>
              <div className="text-muted-foreground mt-1 flex justify-between text-[0.6rem]">
                <span>{formatDay(g.history[0].start)}</span>
                <span>this week</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
