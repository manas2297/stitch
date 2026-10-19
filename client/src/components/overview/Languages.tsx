import { useMemo } from 'react';
import { Code2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { compactNumber, languageMix, RANGES, type LocalCommit, type RangeKey } from '@/lib/contributions';
import { SERIES, ShareBar } from './charts';

const SHOWN = 6;

export default function Languages({ commits, range, loading }: { commits: LocalCommit[]; range: RangeKey; loading: boolean }) {
  const mix = useMemo(() => languageMix(commits), [commits]);
  const total = mix.reduce((s, l) => s + l.lines, 0);
  const top = mix.slice(0, SHOWN);
  const rest = mix.slice(SHOWN).reduce((s, l) => s + l.lines, 0);
  const rows = rest > 0 ? [...top, { name: `${mix.length - SHOWN} more`, lines: rest }] : top;
  const max = Math.max(1, ...rows.map((r) => r.lines));
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Code2 className="size-4" /> Languages
        </CardTitle>
        <CardDescription>Lines you changed locally, {RANGES[range].long} · lockfiles and build output excluded</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : total === 0 ? (
          <p className="text-muted-foreground text-sm">No local code changes in this period.</p>
        ) : (
          <>
            {rows.map((l) => (
              <div key={l.name} className="grid grid-cols-[6.5rem_minmax(0,1fr)_4.5rem] items-center gap-3 text-sm">
                <span className="truncate font-medium">{l.name}</span>
                <ShareBar value={l.lines} max={max} color={SERIES[0]} />
                <span className="text-right text-xs tabular-nums">
                  <strong>{pct(l.lines)}%</strong> <span className="text-muted-foreground">{compactNumber(l.lines)}</span>
                </span>
              </div>
            ))}
            <p className="text-muted-foreground text-xs">
              Mostly <strong className="text-foreground">{mix[0].name}</strong>
              {mix.length > 1 ? ` with ${mix.length - 1} other language${mix.length === 2 ? '' : 's'}` : ''} ·{' '}
              {compactNumber(total)} lines changed
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
