import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { THEME_PREFERENCES, useTheme, type ThemePreference } from '@/lib/theme';

const OPTIONS: Record<ThemePreference, { label: string; icon: LucideIcon }> = {
  system: { label: 'System', icon: Monitor },
  light: { label: 'Light', icon: Sun },
  dark: { label: 'Dark', icon: Moon },
};

/** Compact System / Light / Dark switcher for the top bar. */
export default function ThemeToggle() {
  const { preference, resolved, setPreference } = useTheme();
  const TriggerIcon = preference === 'system' ? Monitor : resolved === 'dark' ? Moon : Sun;
  const current = preference === 'system' ? `System (${resolved})` : OPTIONS[preference].label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label={`Theme: ${current}. Change theme`} title={`Theme: ${current}`}>
          <TriggerIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel className="text-muted-foreground text-xs">Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={preference} onValueChange={(v) => setPreference(v as ThemePreference)}>
          {THEME_PREFERENCES.map((p) => {
            const { label, icon: Glyph } = OPTIONS[p];
            return (
              <DropdownMenuRadioItem key={p} value={p}>
                <Glyph className="text-muted-foreground" />
                {label}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
