import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, EllipsisVertical, FilePlus2, Loader2, Pin, PinOff, Search, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ageOf } from '@/lib/age';
import type { Page } from '@/lib/planner';
import type { Planner } from '@/lib/usePlanner';
import { cn } from '@/lib/utils';
import { confirmDialog } from '../../../helper/confirm';
import { useToast } from '../../Toast';
import { PAGE_ICONS, TEMPLATES } from './commands';
import RichEditor, { plainText } from './RichEditor';

const pageTitle = (p: Page) => p.title || 'Untitled';
const storageKey = (project: string) => `stitch.notes.page.${project}`;

function NewPageMenu({ onCreate, children }: { onCreate: (templateId: string) => void; children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-muted-foreground text-xs">Start from</DropdownMenuLabel>
        {TEMPLATES.map((t) => (
          <DropdownMenuItem key={t.id} onSelect={() => onCreate(t.id)}>
            <span className="w-5 text-center">{t.icon}</span> {t.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PageRow({ page, active, onOpen, onPin, onDelete }: { page: Page; active: boolean; onOpen: () => void; onPin: () => void; onDelete: () => void }) {
  return (
    <li className={cn('group flex items-center rounded-md', active ? 'bg-accent' : 'hover:bg-muted/60')}>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left">
        <span className="w-5 shrink-0 text-center">{page.icon || '📄'}</span>
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-sm', active && 'font-semibold', !page.title && 'text-muted-foreground')}>{pageTitle(page)}</span>
          <span className="text-muted-foreground block text-[0.65rem]">{ageOf(page.updatedAt).label}</span>
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-xs" variant="ghost" className="mr-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100" aria-label={`Actions for ${pageTitle(page)}`}>
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onPin}>{page.pinned ? <><PinOff /> Unpin</> : <><Pin /> Pin to top</>}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            <Trash2 /> Delete page
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function PageView({ page, planner, onDelete }: { page: Page; planner: Planner; onDelete: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(page.title);
  const [words, setWords] = useState(0);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => setTitle(page.title), [page.id]);

  const save = async (patch: Partial<Page>) => {
    setSaving('saving');
    try {
      await planner.updatePage(page.id, patch);
      setSaving('saved');
    } catch (err) {
      setSaving('error');
      toast(`Not saved: ${err.message}`, 'error');
    }
  };

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-1 px-2 sm:px-8">
      <div className="flex items-start justify-between gap-3 pt-2">
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="hover:bg-muted/60 -ml-2 rounded-lg px-2 text-5xl leading-tight" aria-label="Change page icon">
              {page.icon || '📄'}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72">
            <div className="grid grid-cols-8 gap-1">
              {PAGE_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => save({ icon })}
                  className={cn('hover:bg-accent rounded-md p-1 text-xl', page.icon === icon && 'bg-accent ring-primary ring-1')}
                  aria-label={`Use ${icon}`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <div className="text-muted-foreground flex items-center gap-2 pt-3 text-xs">
          <span>
            Edited {ageOf(page.updatedAt).label.toLowerCase()} · {words} word{words === 1 ? '' : 's'}
          </span>
          {saving === 'saving' && <Loader2 className="size-3.5 animate-spin" aria-label="Saving" />}
          {saving === 'saved' && <Check className="text-success size-3.5" aria-label="Saved" />}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-xs" variant="ghost" aria-label="Page actions">
                <EllipsisVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => save({ pinned: !page.pinned })}>{page.pinned ? <><PinOff /> Unpin</> : <><Pin /> Pin to top</>}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <Trash2 /> Delete page
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <textarea
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title !== page.title && save({ title })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.currentTarget.closest('article')?.querySelector('.notion-editor') as HTMLElement | null)?.focus();
          }
        }}
        rows={1}
        placeholder="Untitled"
        className="placeholder:text-muted-foreground/50 field-sizing-content w-full resize-none bg-transparent text-4xl leading-tight font-bold tracking-tight outline-none"
        aria-label="Page title"
      />
      <div className="pt-3 pb-24">
        <RichEditor
          key={page.id}
          content={page.content}
          autoFocus={!page.content}
          onStats={(s) => setWords(s.words)}
          onChange={(content) => save({ content })}
          onCreateTask={async (taskTitle) => {
            try {
              await planner.createTasks([{ title: taskTitle, status: 'todo', tags: ['notes'] }]);
              toast(`Task created: ${taskTitle}`, 'success');
            } catch (err) {
              toast(err.message, 'error');
            }
          }}
        />
      </div>
    </article>
  );
}

export default function NotesWorkspace({ planner, project }: { planner: Planner; project: string }) {
  const toast = useToast();
  const pages = planner.board?.pages ?? [];
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(storageKey(project));
    } catch {
      return null;
    }
  });

  const select = (id: string | null) => {
    setSelectedId(id);
    try {
      if (id) localStorage.setItem(storageKey(project), id);
    } catch {
      /* preference only */
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? pages.filter((p) => pageTitle(p).toLowerCase().includes(q) || plainText(p.content).toLowerCase().includes(q)) : pages;
    return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [pages, query]);
  const pinned = filtered.filter((p) => p.pinned);
  const others = filtered.filter((p) => !p.pinned);
  const current = pages.find((p) => p.id === selectedId) ?? pinned[0] ?? others[0] ?? null;

  const create = async (templateId: string) => {
    const t = TEMPLATES.find((x) => x.id === templateId) ?? TEMPLATES[0];
    try {
      const page = await planner.createPage({ title: templateId === 'blank' ? '' : t.title, icon: t.icon, content: t.html });
      select(page.id);
      setQuery('');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const remove = async (page: Page) => {
    if (!(await confirmDialog('Delete page', `Delete "${pageTitle(page)}"? This can't be undone.`))) return;
    try {
      await planner.deletePage(page.id);
      if (current?.id === page.id) select(null);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const row = (p: Page) => (
    <PageRow key={p.id} page={p} active={current?.id === p.id} onOpen={() => select(p.id)} onPin={() => planner.updatePage(p.id, { pinned: !p.pinned }).catch((e) => toast(e.message, 'error'))} onDelete={() => remove(p)} />
  );

  if (pages.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-10 text-center">
        <div>
          <h3 className="text-xl font-bold">Your project notebook</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Rich pages with headings, to-dos, code blocks and tables. Type <kbd className="bg-muted rounded border px-1">/</kbd> for blocks, or use markdown like <code>#</code>, <code>-</code>, <code>[ ]</code>.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
          {TEMPLATES.map((t) => (
            <button key={t.id} type="button" onClick={() => create(t.id)} className="bg-card hover:border-primary/40 flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors">
              <span className="text-2xl">{t.icon}</span>
              <span className="text-sm font-semibold">{t.title}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card grid min-h-[70vh] grid-cols-1 overflow-hidden rounded-xl border md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="bg-muted/30 flex flex-col gap-2 border-b p-3 md:border-r md:border-b-0">
        <NewPageMenu onCreate={create}>
          <Button size="sm" variant="outline" className="w-full justify-between">
            <span className="inline-flex items-center gap-2">
              <FilePlus2 /> New page
            </span>
            <ChevronDown className="opacity-60" />
          </Button>
        </NewPageMenu>
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pages…" className="h-8 pl-8 text-sm" aria-label="Search pages" />
        </div>
        <nav aria-label="Pages" className="flex max-h-48 flex-col gap-3 overflow-y-auto md:max-h-none">
          {pinned.length > 0 && (
            <div>
              <p className="text-muted-foreground px-2 pb-1 text-[0.65rem] font-semibold tracking-wider uppercase">Pinned</p>
              <ul className="flex flex-col gap-0.5">{pinned.map(row)}</ul>
            </div>
          )}
          <div>
            {pinned.length > 0 && <p className="text-muted-foreground px-2 pb-1 text-[0.65rem] font-semibold tracking-wider uppercase">Pages</p>}
            <ul className="flex flex-col gap-0.5">{others.map(row)}</ul>
            {filtered.length === 0 && <p className="text-muted-foreground px-2 py-3 text-xs">No pages match “{query}”.</p>}
          </div>
        </nav>
      </aside>
      <div className="min-w-0 overflow-y-auto py-6">{current && <PageView key={current.id} page={current} planner={planner} onDelete={() => remove(current)} />}</div>
    </div>
  );
}
