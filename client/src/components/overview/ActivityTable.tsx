import { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  GitPullRequest,
} from 'lucide-react';

import { AgeBadge } from '@/components/ui/AgeBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ROWS_PER_PAGE = 8;
const ALL = 'all';

type Kind = 'prs' | 'issues';

const REVIEW: Record<string, { label: string; icon: typeof Check; cls: string }> = {
  APPROVED: { label: 'Approved', icon: Check, cls: 'bg-success/12 text-success' },
  CHANGES_REQUESTED: { label: 'Changes', icon: AlertTriangle, cls: 'bg-destructive/10 text-destructive' },
  REVIEW_REQUIRED: { label: 'Review', icon: Clock, cls: 'bg-warning/12 text-warning' },
};

function ReviewBadge({ decision }: { decision?: string }) {
  const b = decision ? REVIEW[decision] : undefined;
  if (!b) return <span className="text-muted-foreground text-xs">None</span>;
  const Icon = b.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${b.cls}`}>
      <Icon className="size-3" /> {b.label}
    </span>
  );
}

function Labels({ labels }: { labels?: { name: string }[] }) {
  if (!labels || labels.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {labels.slice(0, 3).map((l, i) => (
        <span key={i} className="bg-muted text-muted-foreground rounded-full border px-2 py-0.5 text-[0.65rem]">
          {l.name}
        </span>
      ))}
    </div>
  );
}

function TitleCell({ item, kind }: { item: any; kind: Kind }) {
  return (
    <div className="flex items-start gap-2">
      <Badge variant={kind === 'prs' ? 'blue' : 'orange'} className="shrink-0 px-1.5 py-0.5 text-[0.68rem]">
        #{item.number}
      </Badge>
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="hover:text-primary min-w-0 flex-1 font-medium break-words"
        title={item.title}
      >
        {item.title}
      </a>
      <ExternalLink className="text-muted-foreground mt-1 size-3.5 shrink-0" aria-hidden />
    </div>
  );
}

function Pagination({ page, totalPages, onPrev, onNext }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="xs" onClick={onPrev} disabled={page === 0} aria-label="Previous page">
        <ChevronLeft /> Prev
      </Button>
      <span className="text-muted-foreground text-xs tabular-nums">
        {page + 1} / {totalPages}
      </span>
      <Button variant="outline" size="xs" onClick={onNext} disabled={page >= totalPages - 1} aria-label="Next page">
        Next <ChevronRight />
      </Button>
    </div>
  );
}

export default function ActivityTable({
  prs,
  issues,
  repoNames,
  loading,
}: {
  prs: any[];
  issues: any[];
  repoNames: string[];
  loading: boolean;
}) {
  const [kind, setKind] = useState<Kind>('prs');
  const [selectedRepo, setSelectedRepo] = useState(ALL);
  const [page, setPage] = useState(0);

  const filterByRepo = (items: any[]) =>
    selectedRepo === ALL ? items : items.filter((i) => i.repository?.name?.toLowerCase() === selectedRepo.toLowerCase());
  const filteredPrs = useMemo(() => filterByRepo(prs), [prs, selectedRepo]);
  const filteredIssues = useMemo(() => filterByRepo(issues), [issues, selectedRepo]);

  const items = kind === 'prs' ? filteredPrs : filteredIssues;
  const totalPages = Math.max(1, Math.ceil(items.length / ROWS_PER_PAGE));
  const start = page * ROWS_PER_PAGE;
  const end = Math.min(start + ROWS_PER_PAGE, items.length);
  const visible = items.slice(start, end);
  const noun = kind === 'prs' ? 'pull requests' : 'issues';

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={kind}
          onValueChange={(v) => {
            setKind(v as Kind);
            setPage(0);
          }}
        >
          <TabsList>
            <TabsTrigger value="prs" className="gap-2">
              <GitPullRequest /> Pull Requests
              {!loading && <span className="bg-background/70 rounded-full px-1.5 text-[0.7rem]">{filteredPrs.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="issues" className="gap-2">
              <AlertCircle /> Issues
              {!loading && <span className="bg-background/70 rounded-full px-1.5 text-[0.7rem]">{filteredIssues.length}</span>}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Filter className="text-muted-foreground size-4 shrink-0" />
          <Select
            value={selectedRepo}
            onValueChange={(v) => {
              setSelectedRepo(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-full sm:w-60" aria-label="Filter by repository">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Repositories ({repoNames.length})</SelectItem>
              {repoNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={kind === 'prs' ? 'No pull requests found' : 'No issues found'}
          description={
            selectedRepo === ALL
              ? `All clear! No open ${noun} across your repositories.`
              : `No open ${noun} found for repository "${selectedRepo}".`
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">{kind === 'prs' ? 'Pull Request' : 'Issue'}</TableHead>
                  <TableHead>Repository</TableHead>
                  {kind === 'prs' ? (
                    <>
                      <TableHead>Author</TableHead>
                      <TableHead>Review</TableHead>
                    </>
                  ) : (
                    <TableHead>Labels</TableHead>
                  )}
                  <TableHead className="text-right">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((item, i) => (
                  <TableRow key={`${item.number}-${i}`}>
                    <TableCell className="whitespace-normal">
                      <TitleCell item={item} kind={kind} />
                      {kind === 'prs' && <Labels labels={item.labels} />}
                    </TableCell>
                    <TableCell>
                      {item.repository?.name ? (
                        <Badge variant={kind === 'prs' ? 'blue' : 'orange'} className="text-[0.72rem]">
                          {item.repository.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {kind === 'prs' ? (
                      <>
                        <TableCell className="text-muted-foreground text-sm">
                          {item.author?.login ? `@${item.author.login}` : '—'}
                        </TableCell>
                        <TableCell>
                          <ReviewBadge decision={item.reviewDecision} />
                        </TableCell>
                      </>
                    ) : (
                      <TableCell className="whitespace-normal">
                        {item.labels?.length ? <Labels labels={item.labels} /> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <AgeBadge date={item.createdAt} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile list */}
          <ul className="divide-y md:hidden">
            {visible.map((item, i) => (
              <li key={`${item.number}-${i}`} className="flex flex-col gap-2 p-4">
                <TitleCell item={item} kind={kind} />
                <div className="flex flex-wrap items-center gap-2 pl-0.5">
                  {item.repository?.name && (
                    <Badge variant={kind === 'prs' ? 'blue' : 'orange'} className="text-[0.68rem]">
                      {item.repository.name}
                    </Badge>
                  )}
                  {kind === 'prs' && item.author?.login && (
                    <span className="text-muted-foreground text-xs">@{item.author.login}</span>
                  )}
                  {kind === 'prs' && item.reviewDecision && <ReviewBadge decision={item.reviewDecision} />}
                  <AgeBadge date={item.createdAt} />
                </div>
                <Labels labels={item.labels} />
              </li>
            ))}
          </ul>

          <div className="bg-muted/30 flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-muted-foreground text-xs">
              Showing <strong className="text-foreground">{start + 1}</strong>–<strong className="text-foreground">{end}</strong> of{' '}
              <strong className="text-foreground">{items.length}</strong> {noun}
            </span>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPrev={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            />
          </div>
        </>
      )}
    </Card>
  );
}
