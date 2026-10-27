import { ChevronRight, File, FileCode2, Folder, FolderOpen } from 'lucide-react';

import { cn } from '@/lib/utils';

export type FsEntry = { name: string; path: string; type: 'dir' | 'file' };

const STATUS_STYLE: Record<string, string> = {
  M: 'text-amber-600 dark:text-amber-400',
  A: 'text-emerald-600 dark:text-emerald-400',
  U: 'text-emerald-600 dark:text-emerald-400',
  D: 'text-red-600 dark:text-red-400',
  R: 'text-sky-600 dark:text-sky-400',
};

/** Marks a directory as changed when any file under it is. */
function dirChanged(path: string, status: Record<string, string>) {
  const prefix = path + '/';
  return Object.keys(status).some((p) => p.startsWith(prefix));
}

type Props = {
  entries: Record<string, FsEntry[] | undefined>;
  expanded: Set<string>;
  activePath: string | null;
  status: Record<string, string>;
  onToggle: (dir: string) => void;
  onOpen: (path: string) => void;
};

function Level({ dir, depth, ...p }: Props & { dir: string; depth: number }) {
  const items = p.entries[dir];
  if (!items) return <div className="text-muted-foreground py-1 text-xs" style={{ paddingLeft: depth * 12 + 28 }}>Loading…</div>;
  return (
    <ul>
      {items.map((e) => {
        const isDir = e.type === 'dir';
        const open = isDir && p.expanded.has(e.path);
        const st = p.status[e.path];
        const changed = isDir ? dirChanged(e.path, p.status) : !!st;
        const Icon = isDir ? (open ? FolderOpen : Folder) : /\.(tsx?|jsx?|go|py|rs|css|json|html|ya?ml|sh)$/i.test(e.name) ? FileCode2 : File;
        return (
          <li key={e.path}>
            <button
              type="button"
              onClick={() => (isDir ? p.onToggle(e.path) : p.onOpen(e.path))}
              style={{ paddingLeft: depth * 12 + 6 }}
              className={cn(
                'hover:bg-muted flex w-full items-center gap-1 rounded-md py-1 pr-2 text-left text-[13px]',
                p.activePath === e.path && 'bg-primary/10 text-foreground font-medium',
              )}
            >
              <ChevronRight className={cn('text-muted-foreground size-3.5 shrink-0 transition-transform', open && 'rotate-90', !isDir && 'invisible')} />
              <Icon className={cn('size-4 shrink-0', isDir ? 'text-primary' : 'text-muted-foreground')} />
              <span className={cn('truncate', st && STATUS_STYLE[st])}>{e.name}</span>
              {changed && (
                <span className={cn('ml-auto shrink-0 pl-2 text-[0.65rem] font-semibold', isDir ? 'text-amber-600 dark:text-amber-400' : STATUS_STYLE[st])}>
                  {isDir ? '●' : st}
                </span>
              )}
            </button>
            {open && <Level {...p} dir={e.path} depth={depth + 1} />}
          </li>
        );
      })}
    </ul>
  );
}

export default function FileTree(props: Props) {
  return <Level {...props} dir="" depth={0} />;
}
