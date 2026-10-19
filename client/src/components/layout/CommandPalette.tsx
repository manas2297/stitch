import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, ExternalLink, FolderGit2, Globe, Laptop, RefreshCw, Search, Star } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import useAppStore from '../../store/useAppStore';
import Icon from '../Icon';
import { isFocusRepo, repoFocusValue } from '@/lib/focus';

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
export const MOD_KEY = isMac ? '⌘' : 'Ctrl';

type Item = {
  id: string;
  group: 'Pages' | 'Repositories' | 'Actions';
  label: string;
  hint?: string;
  icon: React.ReactNode;
  keywords: string;
  run: () => void;
  /** Optional secondary action (⌘/Ctrl+Enter). */
  alt?: { label: string; run: () => void };
  current?: boolean;
};

function matches(query: string, haystack: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const h = haystack.toLowerCase();
  // Every whitespace-separated term must appear somewhere.
  return q.split(/\s+/).every((term) => h.includes(term));
}

export default function CommandPalette({ open, onOpenChange, tabs }) {
  const repos = useAppStore((s) => s.repos);
  const activeTab = useAppStore((s) => s.activeTab);
  const focusProject = useAppStore((s) => s.focusProject);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const setFocusProject = useAppStore((s) => s.setFocusProject);
  const loadRepos = useAppStore((s) => s.loadRepos);

  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const close = () => onOpenChange(false);

  const items: Item[] = useMemo(() => {
    const pages: Item[] = tabs.map((t) => ({
      id: `tab:${t.id}`,
      group: 'Pages',
      label: t.label,
      hint: t.id === activeTab ? 'Current page' : 'Go to page',
      icon: <Icon name={t.icon} size={16} />,
      keywords: `${t.label} ${t.id} page tab`,
      current: t.id === activeTab,
      run: () => setActiveTab(t.id),
    }));

    const repoItems: Item[] = repos.map((r, i) => {
      const slug = r.owner ? `${r.owner}/${r.name}` : r.name;
      const focused = isFocusRepo(r, focusProject);
      const local = r.type === 'local';
      return {
        id: `repo:${i}:${slug}:${r.path}`,
        group: 'Repositories',
        label: slug,
        hint: focused ? 'Current focus' : local ? r.path : 'GitHub',
        icon: local ? <Laptop className="size-4" /> : <Globe className="size-4" />,
        keywords: `${slug} ${r.path || ''} ${r.branch || ''} ${r.type || ''} ${r.isMajorProject ? 'major' : ''} repo`,
        current: focused,
        run: async () => {
          await setFocusProject(repoFocusValue(r));
          setActiveTab('focus');
        },
        alt: r.owner
          ? {
              label: 'Open on GitHub',
              run: () => {
                const href = `https://github.com/${r.owner}/${r.name}`;
                const appBinding = (window as any).go?.desktop?.App;
                if (appBinding) appBinding.OpenURL(href);
                else window.open(href, '_blank', 'noopener');
              },
            }
          : undefined,
      };
    });

    const actions: Item[] = [
      {
        id: 'action:reload',
        group: 'Actions',
        label: 'Reload repositories',
        hint: 'Re-read tracked repos',
        icon: <RefreshCw className="size-4" />,
        keywords: 'reload refresh repositories repos sync',
        run: () => loadRepos(),
      },
    ];

    return [...pages, ...repoItems, ...actions];
  }, [tabs, repos, activeTab, focusProject, setActiveTab, setFocusProject, loadRepos]);

  const filtered = useMemo(() => items.filter((it) => matches(query, `${it.label} ${it.keywords}`)), [items, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const execute = (item: Item | undefined, alt = false) => {
    if (!item) return;
    close();
    if (alt && item.alt) item.alt.run();
    else item.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (filtered.length ? (i + 1) % filtered.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(Math.max(0, filtered.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      execute(filtered[active], e.metaKey || e.ctrlKey);
    }
  };

  let lastGroup = '';
  const activeItem = filtered[active];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[12vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
        onKeyDown={onKeyDown}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">Jump to a page or repository, or run an action.</DialogDescription>
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="text-muted-foreground size-4 shrink-0" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to a page or repository…"
            aria-label="Search commands"
            role="combobox"
            aria-expanded
            aria-controls="command-palette-list"
            aria-activedescendant={activeItem ? `cmd-${active}` : undefined}
            className="h-12 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <kbd className="text-muted-foreground bg-muted hidden rounded border px-1.5 py-0.5 font-mono text-[0.65rem] sm:inline">
            Esc
          </kbd>
        </div>

        <div ref={listRef} id="command-palette-list" role="listbox" className="max-h-[min(60vh,420px)] overflow-y-auto p-1.5">
          {filtered.length === 0 && (
            <div className="text-muted-foreground px-3 py-10 text-center text-sm">No matches for “{query}”.</div>
          )}
          {filtered.map((item, index) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            const isActive = index === active;
            return (
              <div key={item.id}>
                {header && (
                  <div className="text-muted-foreground px-2.5 pt-2.5 pb-1 text-[0.68rem] font-semibold tracking-wider uppercase">
                    {header}
                  </div>
                )}
                <div
                  id={`cmd-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isActive}
                  onMouseMove={() => !isActive && setActive(index)}
                  onClick={(e) => execute(item, e.metaKey || e.ctrlKey)}
                  className={cn(
                    'group flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm',
                    isActive ? 'bg-primary/10 text-foreground' : 'text-foreground/90',
                  )}
                >
                  <span className={cn('text-muted-foreground shrink-0', isActive && 'text-primary')}>{item.icon}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                  {item.current && item.group === 'Repositories' && <Star className="text-warning size-3.5 shrink-0" aria-label="Current focus" />}
                  {item.hint && (
                    <span className="text-muted-foreground hidden max-w-[45%] truncate text-xs sm:inline">{item.hint}</span>
                  )}
                  {item.alt && (
                    <button
                      type="button"
                      title={item.alt.label}
                      aria-label={item.alt.label}
                      onClick={(e) => {
                        e.stopPropagation();
                        execute(item, true);
                      }}
                      className="text-muted-foreground hover:text-foreground rounded p-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <ExternalLink className="size-3.5" />
                    </button>
                  )}
                  {isActive && <CornerDownLeft className="text-muted-foreground size-3.5 shrink-0" aria-hidden />}
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-muted-foreground bg-muted/40 flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-3 py-2 text-[0.7rem]">
          <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate</span>
          <span><Kbd>↵</Kbd> {activeItem?.group === 'Repositories' ? 'set as focus' : 'open'}</span>
          {activeItem?.alt && (
            <span><Kbd>{MOD_KEY}</Kbd> <Kbd>↵</Kbd> {activeItem.alt.label.toLowerCase()}</span>
          )}
          <span className="ml-auto hidden items-center gap-1 sm:inline-flex">
            <FolderGit2 className="size-3" /> {repos.length} tracked
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Kbd({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={cn('bg-background rounded border px-1 py-px font-sans text-[0.7rem] leading-none', className)}>{children}</kbd>
  );
}
