import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Search, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { daysSince, formatBytes, formatCount, formatDate, timeAgo } from './format';
import type { SessionInfo } from './types';

type Filter = 'all' | 'stale' | 'empty' | 'large';
type SortKey = 'lastActive' | 'created' | 'bytes' | 'files';

const PAGE = 50;
const RECENT_MINUTES = 15;
const LARGE_BYTES = 10 * 1024 * 1024;

const FILTERS: { id: Filter; label: string; test: (s: SessionInfo) => boolean }[] = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'stale', label: 'Stale 30d+', test: (s) => daysSince(s.lastActive) >= 30 },
  { id: 'empty', label: 'Empty', test: (s) => s.bytes < 4096 },
  { id: 'large', label: 'Large 10MB+', test: (s) => s.bytes >= LARGE_BYTES },
];

const isLive = (s: SessionInfo) => daysSince(s.lastActive) * 1440 < RECENT_MINUTES;

/** Filterable, sortable session list with multi-select delete. */
export default function SessionsTable({
  sessions,
  truncated,
  onDelete,
}: {
  sessions: SessionInfo[];
  truncated: boolean;
  onDelete: (ids: string[], label: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [group, setGroup] = useState('__all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'lastActive', desc: true });
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const groups = useMemo(
    () => [...new Set(sessions.map((s) => s.group).filter(Boolean))].sort(),
    [sessions],
  );
  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, sessions.filter(f.test).length])),
    [sessions],
  );

  const rows = useMemo(() => {
    const test = FILTERS.find((f) => f.id === filter)!.test;
    const q = query.trim().toLowerCase();
    const list = sessions.filter(
      (s) =>
        test(s) &&
        (group === '__all' || s.group === group) &&
        (!q || s.name.toLowerCase().includes(q) || s.group.toLowerCase().includes(q)),
    );
    const val = (s: SessionInfo) =>
      sort.key === 'lastActive' || sort.key === 'created' ? new Date(s[sort.key]).getTime() || 0 : s[sort.key];
    return list.sort((a, b) => (sort.desc ? val(b) - val(a) : val(a) - val(b)));
  }, [sessions, filter, group, query, sort]);

  const visible = rows.slice(0, limit);
  const selectable = rows.filter((s) => !isLive(s));
  const selectedRows = sessions.filter((s) => selected.has(s.id));
  const selectedBytes = selectedRows.reduce((a, s) => a + s.bytes, 0);
  const allSelected = selectable.length > 0 && selectable.every((s) => selected.has(s.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      selectable.forEach((s) => (allSelected ? next.delete(s.id) : next.add(s.id)));
      return next;
    });

  const SortHead = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <TableHead className={className}>
      <button
        className={cn('inline-flex items-center gap-1 hover:text-foreground', sort.key === k && 'text-foreground')}
        onClick={() => setSort((s) => ({ key: k, desc: s.key === k ? !s.desc : true }))}
      >
        {label}
        {sort.key === k && (sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
      </button>
    </TableHead>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={filter} onValueChange={(v) => { setFilter(v as Filter); setLimit(PAGE); }}>
          <TabsList className="flex-wrap">
            {FILTERS.map((f) => (
              <TabsTrigger key={f.id} value={f.id} className="px-3 text-xs">
                {f.label} <span className="text-muted-foreground tabular-nums">{counts[f.id]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-2">
          {groups.length > 1 && (
            <Select value={group} onValueChange={(v) => { setGroup(v); setLimit(PAGE); }}>
              <SelectTrigger size="sm" className="max-w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All projects</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search id or project…"
              className="h-8 w-52 pl-8 text-sm"
            />
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="bg-primary/5 border-primary/20 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
          <span>
            <strong>{selected.size}</strong> selected · {formatBytes(selectedBytes)}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onDelete([...selected], `Delete ${selected.size} selected session${selected.size > 1 ? 's' : ''}`)}
            >
              <Trash2 /> Delete selected
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" disabled={!selectable.length} />
              </TableHead>
              <TableHead>Session</TableHead>
              <SortHead k="lastActive" label="Last active" />
              <SortHead k="created" label="Started" className="hidden md:table-cell" />
              <SortHead k="files" label="Files" className="hidden text-right sm:table-cell" />
              <SortHead k="bytes" label="Size" className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-8 text-center text-sm">
                  No sessions match.
                </TableCell>
              </TableRow>
            )}
            {visible.map((s) => {
              const live = isLive(s);
              return (
                <TableRow key={s.id} data-state={selected.has(s.id) ? 'selected' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(s.id)}
                      onCheckedChange={() => toggle(s.id)}
                      disabled={live}
                      aria-label={`Select ${s.name}`}
                    />
                  </TableCell>
                  <TableCell className="max-w-0 min-w-48">
                    <div className="truncate font-mono text-xs" title={s.id}>
                      {s.name}
                    </div>
                    <div className="text-muted-foreground truncate text-xs" title={s.group}>
                      {s.group || '—'}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap" title={formatDate(s.lastActive)}>
                    {live ? <span className="text-success font-medium">Active now</span> : timeAgo(s.lastActive)}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-sm whitespace-nowrap md:table-cell">
                    {formatDate(s.created)}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-right text-sm tabular-nums sm:table-cell">
                    {formatCount(s.files)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">{formatBytes(s.bytes)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span>
          Showing {visible.length} of {rows.length}
          {truncated && ' (most recent 1,000 sessions loaded)'}
        </span>
        {rows.length > limit && (
          <Button size="sm" variant="ghost" onClick={() => setLimit((l) => l + PAGE)}>
            Show more
          </Button>
        )}
      </div>
    </div>
  );
}
