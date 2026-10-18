import { Badge } from '@/components/ui/Badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ENERGY_CONFIG } from '@/lib/energy';
import { cn } from '@/lib/utils';
import Icon from '../Icon';

export default function NavList({ tabs, activeTab, collapsed = false, onSelect }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const energy = ENERGY_CONFIG[tab.energy] ?? ENERGY_CONFIG.all;
        const button = (
          <button
            key={tab.id}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onSelect(tab.id)}
            className={cn(
              'focus-visible:ring-ring/50 group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px]',
              collapsed && 'justify-center px-0',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon name={tab.icon} size={18} />
            {!collapsed && (
              <>
                <span className="flex-1 truncate text-left">{tab.label}</span>
                <Badge variant={tab.energy === 'all' ? 'default' : energy.badge} className="bg-muted/60 px-2 py-0.5 text-[0.6rem]">
                  {tab.energy === 'all' ? 'All' : tab.energy}
                </Badge>
              </>
            )}
          </button>
        );
        return collapsed ? (
          <Tooltip key={tab.id}>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="right">{tab.label}</TooltipContent>
          </Tooltip>
        ) : (
          button
        );
      })}
    </nav>
  );
}
