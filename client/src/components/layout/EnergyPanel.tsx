import { Check, ChevronUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ENERGY_CONFIG, type EnergyMode } from '@/lib/energy';

/** Floating energy mode chooser, anchored bottom-right. */
export default function EnergyPanel({
  activeEnergy,
  setActiveEnergy,
}: {
  activeEnergy: EnergyMode;
  setActiveEnergy: (mode: EnergyMode) => void;
}) {
  const cfg = ENERGY_CONFIG[activeEnergy];
  const ActiveIcon = cfg.icon;

  return (
    <div className="fixed right-4 bottom-4 z-40 sm:right-6 sm:bottom-6">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-11 rounded-full bg-card/90 px-4 shadow-lg backdrop-blur"
            aria-label={`Energy mode: ${cfg.label}`}
            style={{ color: cfg.color }}
          >
            <ActiveIcon />
            <span className="hidden sm:inline">{cfg.label}</span>
            <ChevronUp className="opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-72">
          <DropdownMenuLabel>Energy Mode</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.entries(ENERGY_CONFIG) as [EnergyMode, (typeof ENERGY_CONFIG)[EnergyMode]][]).map(
            ([key, conf]) => {
              const Glyph = conf.icon;
              return (
                <DropdownMenuItem key={key} onSelect={() => setActiveEnergy(key)} className="items-start gap-3 py-2.5">
                  <Glyph className="mt-0.5" style={{ color: conf.color }} />
                  <div className="flex-1">
                    <div className="text-sm font-semibold" style={key === activeEnergy ? { color: conf.color } : undefined}>
                      {conf.label}
                    </div>
                    <div className="text-muted-foreground text-xs">{conf.desc}</div>
                  </div>
                  {key === activeEnergy && <Check style={{ color: conf.color }} />}
                </DropdownMenuItem>
              );
            },
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
