import { useMemo, useState } from 'react';
import { Bug, CircleDot, ExternalLink, Hourglass, Lightbulb } from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ageOf } from '@/lib/age';
import { cn } from '@/lib/utils';
import { SegmentedToggle } from '../overview/charts';

export interface Issue {
  number: number;
  title: string;
  url: string;
  createdAt: string;
  updatedAt?: string;
  author?: { login: string };
  labels?: { name: string; color?: string }[];
  assignees?: { login: string }[];
}

type Kind = 'all' | 'features' | 'bugs' | 'other';
type Sort = 'newest' | 'oldest' | 'updated';

const KIND_ICON = { features: Lightbulb, bugs: Bug, other: CircleDot };
const KIND_CLS = { features: 'text-violet', bugs: 'text-destructive', other: 'text-success' };
const STALE_DAYS = 30;

export default function IssuesPanel({ features, bugs, other }: { features: Issue[]; bugs: Issue[]; other: Issue[] }) {
  const [kind, setKind] = useState<Kind>('all');
  const [sort, setSort] = useState<Sort>('newest');

  const tagged = useMemo(
    () => [
      ...features.map((i) => ({ issue: i, kind: 'features' as const })),
      ...bugs.map((i) => ({ issue: i, kind: 'bugs' as const })),
      ...other.map((i) => ({ issue: i, kind: 'other' as const })),
    ],
    [features, bugs, other],
  );

  const list = useMemo(() => {
    const items = tagged.filter((t) => kind === 'all' || t.kind === kind);
    const key = (t: (typeof items)[number]) => (sort === 'updated' ? (t.issue.updatedAt ?? t.issue.createdAt) : t.issue.createdAt);
    return items.sort((a, b) => (sort === 'oldest' ? key(a).localeCompare(key(b)) : key(b).localeCompare(key(a))));
  }, [tagged, kind, sort]);

  const staleCount = tagged.filter((t) => Date.now() - new Date(t.issue.updatedAt ?? t.issue.createdAt).getTime() > STALE_DAYS * 86400000).length;

  return (
    <div>
      <div className="flex flex-col gap-2 border-b px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedToggle<Kind>
          ariaLabel="Issue type"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'all', label: `All ${tagged.length}` },
            { value: 'features', label: <><Lightbulb /> {features.length}</> },
            { value: 'bugs', label: <><Bug /> {bugs.length}</> },
            { value: 'other', label: `Other ${other.length}` },
          ]}
        />
        <div className="flex items-center gap-3">
          {staleCount > 0 && (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <Hourglass className="size-3.5" /> {staleCount} untouched {STALE_DAYS}d+
            </span>
          )}
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger size="sm" className="w-40" aria-label="Sort issues">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="updated">Recently updated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="text-muted-foreground px-5 py-10 text-center text-sm">
          {kind === 'features'
            ? 'No feature issues. Label a GitHub issue "feature" or "enhancement" to see it here.'
            : kind === 'bugs'
              ? 'No open bugs. 🎉'
              : 'No open issues.'}
        </p>
      ) : (
        <ul className="divide-y">
          {list.map(({ issue, kind: k }) => {
            const Icon = KIND_ICON[k];
            const updated = issue.updatedAt ?? issue.createdAt;
            const stale = Date.now() - new Date(updated).getTime() > STALE_DAYS * 86400000;
            return (
              <li key={issue.number} className="hover:bg-muted/40 flex items-start gap-3 px-5 py-3 transition-colors">
                <Icon className={cn('mt-0.5 size-4 shrink-0', KIND_CLS[k])} aria-label={k} />
                <div className="min-w-0 flex-1">
                  <a href={issue.url} target="_blank" rel="noreferrer" className="hover:text-primary group inline-flex max-w-full items-start gap-1 text-sm font-medium">
                    <span className="line-clamp-2">{issue.title}</span>
                    <ExternalLink className="text-muted-foreground mt-1 size-3 shrink-0 opacity-0 group-hover:opacity-100" />
                  </a>
                  <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span>#{issue.number}</span>
                    {issue.author?.login && <span>@{issue.author.login}</span>}
                    <span>opened {ageOf(issue.createdAt).label.toLowerCase()}</span>
                    {issue.labels?.slice(0, 4).map((l) => (
                      <span key={l.name} className="inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[0.65rem]">
                        {l.color && <span className="size-1.5 rounded-full" style={{ backgroundColor: `#${l.color}` }} />}
                        {l.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                  {issue.assignees?.length ? (
                    <span className="text-muted-foreground">@{issue.assignees[0].login}</span>
                  ) : (
                    <span className="text-muted-foreground/70">unassigned</span>
                  )}
                  {stale && (
                    <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[0.62rem] font-semibold">
                      quiet {ageOf(updated).label.replace(' ago', '')}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
