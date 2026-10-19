import { useMemo } from 'react';
import { ArrowRight, ArrowUpFromLine, FilePen, GitBranch, Globe, HeartPulse, Laptop, Star, Target } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ageOf } from '@/lib/age';
import { RANGES, type ContributionGraph, type GitHubWindow, type RangeKey } from '@/lib/contributions';
import { buildRepoRows, compareRows, hasUnsavedWork, STATUS_META, statusCounts, type RepoStatus } from '@/lib/repoHealth';
import { cn } from '@/lib/utils';
import { Sparkline } from './charts';

const SHOWN = 8;

export default function ProjectPulse({
  repos,
  local,
  githubMonth,
  range,
  rangeStart,
  focusProject,
  currentUser,
  onFocus,
  onManage,
  loading,
}: {
  repos: any[];
  local: ContributionGraph | null;
  githubMonth?: GitHubWindow;
  range: RangeKey;
  rangeStart?: string;
  focusProject: string;
  currentUser: string;
  onFocus: (value: string) => void;
  onManage: () => void;
  loading: boolean;
}) {
  const rows = useMemo(
    () => buildRepoRows({ repos, local, githubMonth, focusProject, currentUser, since: rangeStart }).sort(compareRows),
    [repos, local, githubMonth, focusProject, currentUser, rangeStart],
  );
  const counts = statusCounts(rows);
  const dirty = rows.filter(hasUnsavedWork).length;

  return (
    <Card className="mt-6 gap-0 overflow-hidden pb-0">
      <CardHeader className="border-b pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <HeartPulse className="size-4" /> Project pulse
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {(Object.keys(STATUS_META) as RepoStatus[])
            .filter((s) => counts[s] > 0)
            .map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className={cn('size-2 rounded-full', STATUS_META[s].dot)} />
                {counts[s]} {STATUS_META[s].label.toLowerCase()}
              </span>
            ))}
          {dirty > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <FilePen className="size-3.5" /> {dirty} with unsaved work
            </span>
          )}
        </CardDescription>
        <CardAction>
          <Button size="xs" variant="ghost" onClick={onManage}>
            Manage <ArrowRight />
          </Button>
        </CardAction>
      </CardHeader>

      {loading ? (
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground px-6 py-6 text-sm">No repositories tracked yet. Add some from the Repositories tab.</p>
      ) : (
        <>
          <ul className="divide-y">
            {rows.slice(0, SHOWN).map((r) => {
              const st = STATUS_META[r.status];
              return (
                <li key={r.key} className="group hover:bg-muted/40 flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3 transition-colors">
                  <div className="flex min-w-0 flex-1 basis-56 items-center gap-2.5">
                    {r.kind === 'github' ? (
                      <Globe className="text-muted-foreground size-4 shrink-0" />
                    ) : (
                      <Laptop className="text-muted-foreground size-4 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium" title={r.path ?? r.slug}>
                          {r.name}
                        </span>
                        {r.isMajor && (
                          <Badge variant="green" className="px-1.5 py-0 text-[0.6rem]">
                            <Star /> Major
                          </Badge>
                        )}
                        {r.isFocus && (
                          <Badge variant="blue" className="px-1.5 py-0 text-[0.6rem]">
                            <Target /> Focus
                          </Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        <span className={cn('inline-flex items-center gap-1 font-medium', st.text)}>
                          <span className={cn('size-1.5 rounded-full', st.dot)} /> {st.label}
                        </span>
                        {r.lastCommit && <span>· last commit {ageOf(r.lastCommit).label.toLowerCase()}</span>}
                        {r.branch && (
                          <span className="hidden items-center gap-1 font-mono sm:inline-flex">
                            · <GitBranch className="size-3" /> {r.branch}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {r.weekly ? <Sparkline values={r.weekly} /> : <div className="hidden w-[84px] sm:block" />}
                    <div className="w-20 text-right text-xs">
                      {r.commits !== null ? (
                        <>
                          <strong className="text-sm tabular-nums">{r.commits}</strong>{' '}
                          <span className="text-muted-foreground">{r.kind === 'github' ? 'in 30d' : `in ${RANGES[range].short}`}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="flex w-28 flex-wrap justify-end gap-1">
                      {r.uncommitted > 0 && (
                        <span title={`${r.uncommitted} uncommitted file(s)`} className="bg-warning/12 text-warning inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold">
                          <FilePen className="size-3" /> {r.uncommitted}
                        </span>
                      )}
                      {r.unpushed > 0 && (
                        <span title={`${r.unpushed} unpushed commit(s)`} className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold">
                          <ArrowUpFromLine className="size-3" /> {r.unpushed}
                        </span>
                      )}
                    </div>
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={r.isFocus || r.status === 'missing'}
                      onClick={() => onFocus(r.focusValue)}
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    >
                      <Target /> Focus
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="bg-muted/30 border-t px-6 py-2.5">
            <Button size="xs" variant="ghost" onClick={onManage}>
              {rows.length > SHOWN ? `See all ${rows.length} projects in Repositories` : 'Manage in Repositories'} <ArrowRight />
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
