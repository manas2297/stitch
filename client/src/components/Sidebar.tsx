import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import useAppStore from '../store/useAppStore';
import NavList from './layout/NavList';

export default function Sidebar({ visibleTabs, mobileOpen, onMobileOpenChange }) {
  const { activeTab, setActiveTab, sidebarCollapsed, toggleSidebarCollapsed } = useAppStore();

  return (
    <>
      {/* Desktop: persistent, collapsible rail */}
      <aside
        className={cn(
          'bg-card/70 sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 flex-col gap-4 overflow-y-auto border-r p-3 transition-[width] duration-200 lg:flex',
          sidebarCollapsed ? 'w-16' : 'w-64',
        )}
      >
        <div className={cn('flex items-center', sidebarCollapsed ? 'justify-center' : 'justify-between px-1')}>
          {!sidebarCollapsed && (
            <div>
              <div className="text-muted-foreground text-[0.68rem] font-semibold tracking-wider uppercase">
                Workspace Portal
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
                <span className="bg-success size-1.5 rounded-full" /> Developer Console
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleSidebarCollapsed}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        </div>
        <NavList tabs={visibleTabs} activeTab={activeTab} collapsed={sidebarCollapsed} onSelect={setActiveTab} />
      </aside>

      {/* Mobile / tablet: slide-in drawer */}
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-72 gap-0 p-0">
          <SheetHeader className="border-b">
            <SheetTitle>Stitch</SheetTitle>
            <SheetDescription>Workspace navigation</SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto p-3">
            <NavList
              tabs={visibleTabs}
              activeTab={activeTab}
              onSelect={(id) => {
                setActiveTab(id);
                onMobileOpenChange(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
