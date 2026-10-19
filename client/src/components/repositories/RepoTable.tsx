import {
  ArrowUpFromLine,
  Code,
  Copy,
  EllipsisVertical,
  ExternalLink,
  FilePen,
  FolderOpen,
  GitBranch,
  Globe,
  Laptop,
  LayoutDashboard,
  SquareTerminal,
  Star,
  Target,
  Trash2,
} from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ageOf } from '@/lib/age';
import { STATUS_META, type RepoRow } from '@/lib/repoHealth';
import { cn } from '@/lib/utils';
import { Sparkline } from '../overview/charts';

export interface RowActions {
  focus: (row: RepoRow) => void;
  toggleStar: (row: RepoRow) => void;
  open: (row: RepoRow, target: 'editor' | 'terminal' | 'finder') => void;
  copyPath: (row: RepoRow) => void;
  openWorkspace: (row: RepoRow) => void;
  untrack: (row: RepoRow) => void;
}

const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent);

function KindIcon({ row }: { row: RepoRow }) {
  const label = row.kind === 'both' ? 'Local clone + GitHub' : row.kind === 'local' ? 'Local clone' : 'GitHub only';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-muted-foreground relative inline-flex size-5 shrink-0 items-center justify-center" aria-label={label}>
          {row.kind === 'github' ? <Globe className="size-4" /> : <Laptop className="size-4" />}
          {row.kind === 'both' && <Globe className="bg-card absolute -right-1 -bottom-1 size-3 rounded-full" />}
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function NameCell({ row }: { row: RepoRow }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <KindIcon row={row} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">{row.name}</span>
          {row.isFocus && (
            <Badge variant="blue" className="px-1.5 py-0 text-[0.6rem]">
              <Target /> Focus
            </Badge>
          )}
          {row.isExternal && row.slug && (
            <Badge variant="orange" className="px-1.5 py-0 text-[0.6rem] normal-case">
              External
            </Badge>
          )}
        </div>
        <div className="text-muted-foreground truncate font-mono text-[0.7rem]" title={row.path ?? row.slug}>
          {row.slug ?? row.path}
        </div>
      </div>
    </div>
  );
}

function StatusCell({ row }: { row: RepoRow }) {
  const st = STATUS_META[row.status];
  return (
    <div className="text-xs">
      <span className={cn('inline-flex items-center gap-1.5 font-semibold', st.text)}>
        <span className={cn('size-2 rounded-full', st.dot)} /> {st.label}
      </span>
      <div className="text-muted-foreground">{row.lastCommit ? `last commit ${ageOf(row.lastCommit).label.toLowerCase()}` : row.kind === 'github' ? 'no local clone' : 'no commits yet'}</div>
    </div>
  );
}

function WorkingTree({ row }: { row: RepoRow }) {
  return (
    <div className="flex flex-col gap-1 text-xs">
      {row.branch && row.kind !== 'github' && (
        <span className="text-muted-foreground inline-flex items-center gap-1 font-mono">
          <GitBranch className="size-3" /> {row.branch}
        </span>
      )}
      <div className="flex flex-wrap gap-1">
        {row.uncommitted > 0 && (
          <span title={`${row.uncommitted} uncommitted file(s)`} className="bg-warning/12 text-warning inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold">
            <FilePen className="size-3" /> {row.uncommitted}
          </span>
        )}
        {row.unpushed > 0 && (
          <span title={`${row.unpushed} unpushed commit(s)`} className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold">
            <ArrowUpFromLine className="size-3" /> {row.unpushed}
          </span>
        )}
        {row.kind !== 'github' && row.status !== 'missing' && !row.hasUpstream && (
          <span title="Branch has no upstream — commits are not backed up" className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold">
            no upstream
          </span>
        )}
      </div>
    </div>
  );
}

function RowMenu({ row, actions }: { row: RepoRow; actions: RowActions }) {
  const local = row.kind !== 'github' && row.status !== 'missing';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label={`More actions for ${row.name}`}>
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {local && (
          <>
            <DropdownMenuItem onSelect={() => actions.open(row, 'editor')}>
              <Code /> Open in VS Code
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.open(row, 'terminal')}>
              <SquareTerminal /> Open in Terminal
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.open(row, 'finder')}>
              <FolderOpen /> {isMac ? 'Reveal in Finder' : 'Open folder'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.copyPath(row)}>
              <Copy /> Copy path
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {row.slug && (
          <DropdownMenuItem onSelect={() => actions.openWorkspace(row)}>
            <LayoutDashboard /> Project workspace
          </DropdownMenuItem>
        )}
        {row.githubUrl && (
          <DropdownMenuItem asChild>
            <a href={row.githubUrl} target="_blank" rel="noreferrer">
              <ExternalLink /> Open on GitHub
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => actions.untrack(row)}>
          <Trash2 /> Stop tracking
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function QuickActions({ row, actions }: { row: RepoRow; actions: RowActions }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        size="xs"
        variant="ghost"
        disabled={row.isFocus || row.status === 'missing'}
        onClick={() => actions.focus(row)}
        aria-label={`Focus ${row.name}`}
      >
        <Target /> Focus
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => actions.toggleStar(row)}
        aria-label={row.isMajor ? `Unstar ${row.name}` : `Star ${row.name} as a major project`}
        aria-pressed={row.isMajor}
        className={cn(row.isMajor ? 'text-amber-500' : 'text-muted-foreground')}
      >
        <Star className={cn(row.isMajor && 'fill-current')} />
      </Button>
      <RowMenu row={row} actions={actions} />
    </div>
  );
}

export default function RepoTable({ rows, actions, activityLabel }: { rows: RepoRow[]; actions: RowActions; activityLabel: string }) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[32%] pl-6">Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>{activityLabel}</TableHead>
              <TableHead>Working tree</TableHead>
              <TableHead>Language</TableHead>
              <TableHead className="pr-6 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key} className={cn(row.status === 'missing' && 'opacity-70')}>
                <TableCell className="max-w-0 pl-6">
                  <NameCell row={row} />
                </TableCell>
                <TableCell>
                  <StatusCell row={row} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {row.weekly ? <Sparkline values={row.weekly} /> : <div className="w-[84px]" />}
                    <span className="text-xs tabular-nums">
                      {row.commits !== null ? (
                        <>
                          <strong className="text-sm">{row.commits}</strong>
                          {row.kind === 'github' && <span className="text-muted-foreground"> /30d</span>}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <WorkingTree row={row} />
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{row.topLanguage ?? '—'}</TableCell>
                <TableCell className="pr-6">
                  <QuickActions row={row} actions={actions} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile list */}
      <ul className="divide-y md:hidden">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <NameCell row={row} />
              <QuickActions row={row} actions={actions} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 pl-7">
              <StatusCell row={row} />
              {row.weekly && <Sparkline values={row.weekly} />}
            </div>
            <div className="pl-7">
              <WorkingTree row={row} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
