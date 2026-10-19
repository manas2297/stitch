import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Crosshair, Flame, Menu, Search, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { computeStreaks, type ContributionGraph } from '@/lib/contributions';
import { cn } from '@/lib/utils';
import useAppStore from '../../store/useAppStore';
import Icon from '../Icon';
import { isFocusRepo } from '@/lib/focus';
import CommandPalette, { Kbd, MOD_KEY } from './CommandPalette';
import ThemeToggle from './ThemeToggle';

const chip =
  'border-border/70 bg-card/60 hover:bg-muted text-foreground focus-visible:ring-ring/50 inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px]';

/**
 * App header: page breadcrumb, command palette trigger (⌘K / Ctrl+K), current
 * focus, contribution streak and the signed-in GitHub user.
 */
export default function TopBar({ tabs, onOpenMobileNav }) {
  const repos = useAppStore((s) => s.repos);
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const focusProject: string = useAppStore((s) => s.focusProject);
  const currentUser: string = useAppStore((s) => s.currentUser);
  const github: ContributionGraph | null = useAppStore((s) => s.overviewContributions);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => setAvatarFailed(false), [currentUser]);

  // Global ⌘K / Ctrl+K. Left alone inside the whiteboard, where Excalidraw
  // binds the same chord to "add link".
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      if ((e.target as HTMLElement | null)?.closest?.('.excalidraw')) return;
      e.preventDefault();
      setPaletteOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const tab = tabs.find((t) => t.id === activeTab);

  const focusRepo = focusProject ? repos.find((r) => isFocusRepo(r, focusProject)) : null;
  const focusLabel = focusRepo
    ? focusRepo.name
    : focusProject
      ? focusProject.split('/').filter(Boolean).pop()
      : '';
  const focusFull = focusRepo
    ? focusRepo.owner
      ? `${focusRepo.owner}/${focusRepo.name}`
      : focusRepo.path
    : focusProject;

  const hasCalendar = !!github?.weeks?.length;
  const streaks = useMemo(() => (hasCalendar ? computeStreaks(github!.weeks) : null), [github, hasCalendar]);

  return (
    <>
      <header
        role="banner"
        className="bg-background/85 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-3 backdrop-blur sm:gap-3 sm:px-5"
      >
        {/* Left: nav + brand + breadcrumb */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobileNav} aria-label="Open navigation">
            <Menu />
          </Button>
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className="focus-visible:ring-ring/50 flex shrink-0 items-center gap-2 rounded-md px-1 outline-none focus-visible:ring-[3px]"
            aria-label="Stitch — go to Overview"
          >
            <span className="from-primary to-brand-accent size-3 rounded-full bg-gradient-to-br shadow-[0_0_12px_color-mix(in_oklab,var(--primary)_45%,transparent)]" />
            <span className="text-lg font-bold tracking-tight">Stitch</span>
          </button>
          {tab && (
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5">
              <ChevronRight className="text-muted-foreground/60 size-4 shrink-0" aria-hidden />
              <h1 className="flex min-w-0 items-center gap-1.5 text-sm font-medium" aria-current="page">
                <Icon name={tab.icon} size={15} className="text-muted-foreground hidden shrink-0 sm:block" />
                <span className="truncate">{tab.label}</span>
              </h1>
            </nav>
          )}
        </div>

        {/* Right: palette + context chips + user */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="border-input bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 hidden h-8 w-56 items-center gap-2 rounded-md border px-2.5 text-sm transition-colors outline-none focus-visible:ring-[3px] md:flex lg:w-64"
            aria-label={`Open command palette (${MOD_KEY}+K)`}
          >
            <Search className="size-4 shrink-0" />
            <span className="flex-1 truncate text-left">Jump to…</span>
            <span className="flex items-center gap-0.5">
              <Kbd>{MOD_KEY}</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setPaletteOpen(true)}
            aria-label="Open command palette"
          >
            <Search />
          </Button>

          {focusProject && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setActiveTab('focus')}
                  className={cn(chip, 'hidden max-w-48 sm:inline-flex', activeTab === 'focus' && 'border-primary/40 bg-primary/10')}
                >
                  <Crosshair className="text-primary size-3.5 shrink-0" />
                  <span className="truncate">{focusLabel}</span>
                  {focusRepo?.branch && (
                    <span className="text-muted-foreground hidden truncate font-mono text-[0.68rem] xl:inline">
                      {focusRepo.branch}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>Focus: {focusFull}</TooltipContent>
            </Tooltip>
          )}

          {streaks && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onClick={() => setActiveTab('overview')} className={cn(chip, 'hidden lg:inline-flex')}>
                  <Flame className={cn('size-3.5', streaks.current > 0 ? 'text-warning' : 'text-muted-foreground')} />
                  <span className="tabular-nums">{streaks.current}d</span>
                  <span className="text-muted-foreground">streak</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                GitHub streak: {streaks.current} day{streaks.current === 1 ? '' : 's'} · longest {streaks.longest}
              </TooltipContent>
            </Tooltip>
          )}

          <ThemeToggle />

          {currentUser && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  aria-label={`Profile — @${currentUser}`}
                  className={cn(
                    'focus-visible:ring-ring/50 bg-muted hidden size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border outline-none focus-visible:ring-[3px] sm:inline-flex',
                    activeTab === 'profile' && 'ring-primary/50 ring-2',
                  )}
                >
                  {avatarFailed ? (
                    <User className="text-muted-foreground size-4" />
                  ) : (
                    <img
                      src={`https://github.com/${encodeURIComponent(currentUser)}.png?size=64`}
                      alt=""
                      className="size-full object-cover"
                      onError={() => setAvatarFailed(true)}
                    />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>@{currentUser}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </header>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} tabs={tabs} />
    </>
  );
}
