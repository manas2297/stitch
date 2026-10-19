import { useEffect, useState } from 'react';
import { ArrowRight, Star } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { ageOf } from '@/lib/age';
import { STATUS_META, type RepoRow } from '@/lib/repoHealth';
import { cn } from '@/lib/utils';
import { apiFetch } from '../../store/useAppStore';
import { Sparkline } from '../overview/charts';

interface Details {
  features?: unknown[];
  bugs?: unknown[];
  prs?: unknown[];
  general?: unknown[];
}

function Count({ value, label, className }: { value: number | string; label: string; className?: string }) {
  return (
    <div className="bg-muted/50 rounded-lg px-2 py-1.5 text-center">
      <div className={cn('text-base font-extrabold tabular-nums', className)}>{value}</div>
      <div className="text-muted-foreground text-[0.6rem] font-medium tracking-wider uppercase">{label}</div>
    </div>
  );
}

/** Pinned cards for starred projects; opening one shows its full project workspace. */
export default function MajorProjects({ rows, onOpen }: { rows: RepoRow[]; onOpen: (row: RepoRow) => void }) {
  const [details, setDetails] = useState<Record<string, Details>>({});

  useEffect(() => {
    for (const r of rows) {
      if (!r.slug || details[r.slug]) continue;
      const [owner, name] = r.slug.split('/');
      apiFetch(`/api/projects/details?owner=${owner}&name=${name}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((d) => d && setDetails((prev) => ({ ...prev, [r.slug!]: d })))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map((r) => r.slug).join()]);

  if (rows.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
        <Star className="size-3.5 fill-current text-amber-500" /> Major projects
      </h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => {
          const d = r.slug ? details[r.slug] : undefined;
          const count = (list?: unknown[]) => (d ? (list?.length ?? 0) : '—');
          const st = STATUS_META[r.status];
          const canOpen = !!r.slug;
          return (
            <Card
              key={r.key}
              role={canOpen ? 'button' : undefined}
              tabIndex={canOpen ? 0 : undefined}
              onClick={() => canOpen && onOpen(r)}
              onKeyDown={(e) => canOpen && (e.key === 'Enter' || e.key === ' ') && onOpen(r)}
              className={cn(
                'group gap-0 py-4 outline-none transition-all',
                canOpen && 'hover:border-primary/40 focus-visible:ring-ring/50 cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-[3px]',
              )}
            >
              <CardContent className="flex flex-col gap-3 px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-bold">{r.name}</div>
                    <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      <span className={cn('inline-flex items-center gap-1 font-medium', st.text)}>
                        <span className={cn('size-1.5 rounded-full', st.dot)} /> {st.label}
                      </span>
                      {r.lastCommit && <span>· {ageOf(r.lastCommit).label.toLowerCase()}</span>}
                    </div>
                  </div>
                  {r.weekly && <Sparkline values={r.weekly} width={72} />}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <Count value={count(d?.features)} label="Features" className="text-violet" />
                  <Count value={count(d?.bugs)} label="Bugs" className="text-destructive" />
                  <Count value={count(d?.prs)} label="PRs" className="text-[var(--energy-low)]" />
                  <Count value={count(d?.general)} label="Issues" className="text-muted-foreground" />
                </div>
                <div className="text-muted-foreground group-hover:text-primary flex items-center gap-1 text-xs transition-colors">
                  {canOpen ? (
                    <>
                      Open project workspace <ArrowRight className="size-3" />
                    </>
                  ) : (
                    'No GitHub remote — workspace unavailable'
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
