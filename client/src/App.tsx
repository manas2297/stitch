import { useState, useEffect } from 'react';
import useAppStore from './store/useAppStore';
import { ToastProvider } from './components/Toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import EnergyPanel from './components/layout/EnergyPanel';
import ConfirmDialog from './components/layout/ConfirmDialog';
import TopBar from './components/layout/TopBar';
import Sidebar from './components/Sidebar';
import Overview from './components/Overview';
import FocusWorkspace from './components/FocusWorkspace';
import Releases from './components/Releases';
import PRReviews from './components/PRReviews';
import Issues from './components/Issues';
import Builds from './components/Builds';
import Repositories from './components/Repositories';
import Profile from './components/Profile';
import AIMonitor from './components/AIMonitor';
import Architecture from './components/Architecture';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'overview',     label: 'Overview',       icon: 'overview'     },
  { id: 'repositories', label: 'Repositories',   icon: 'repositories' },
  { id: 'focus',        label: 'Focus Area',      icon: 'focus'        },
  { id: 'architecture', label: 'Architecture',    icon: 'architecture' },
  { id: 'releases',     label: 'Cut Release',     icon: 'releases'     },
  { id: 'pr-reviews',   label: 'PR Reviews',      icon: 'pr-reviews'   },
  { id: 'issues',       label: 'Issues',          icon: 'issues'       },
  { id: 'builds',       label: 'Fix Builds',      icon: 'builds'       },
  { id: 'ai-monitor',   label: 'AI Monitor',      icon: 'gemini-monitor'},
  { id: 'profile',      label: 'Profile',         icon: 'profile'      },
];

export default function App() {
  const {
    activeTab,
    activeEnergy,
    setActiveTab,
    setActiveEnergy,
    loadRepos,
    tabEnergies,
  } = useAppStore();

  useEffect(() => {
    loadRepos();

    // Deep link to a tab, e.g. /#releases
    // Major Projects now lives inside Repositories; keep old links working.
    const hashTab = window.location.hash.slice(1) === 'projects' ? 'repositories' : window.location.hash.slice(1);
    if (TABS.some((t) => t.id === hashTab)) setActiveTab(hashTab);

    // Intercept clicks on external links when running inside Wails desktop app
    const handleExternalLinks = (e) => {
      const anchor = e.target.closest('a');
      if (anchor && (anchor.target === '_blank' || anchor.href.startsWith('http'))) {
        const appBinding = window.go?.desktop?.App;
        if (appBinding) {
          e.preventDefault();
          appBinding.OpenURL(anchor.href);
        }
      }
    };

    window.addEventListener('click', handleExternalLinks);
    return () => window.removeEventListener('click', handleExternalLinks);
  }, []);

  const tabsWithEnergy = TABS.map((t) => ({
    ...t,
    energy: tabEnergies[t.id] || 'all',
  }));

  const visibleTabs = tabsWithEnergy.filter(
    (t) => activeEnergy === 'all' || t.energy === 'all' || t.energy === activeEnergy
  );

  // If active tab is hidden by mode filter, switch to first visible
  useEffect(() => {
    if (!visibleTabs.find((t) => t.id === activeTab) && visibleTabs.length > 0) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [activeEnergy, visibleTabs]);

  const renderSection = () => {
    switch (activeTab) {
      case 'overview':     return <Overview />;
      case 'repositories': return <Repositories />;
      case 'focus':        return <FocusWorkspace />;
      case 'releases':     return <Releases />;
      case 'pr-reviews':   return <PRReviews />;
      case 'issues':       return <Issues />;
      case 'builds':       return <Builds />;
      case 'ai-monitor':   return <AIMonitor />;
      case 'architecture': return <Architecture />;
      case 'profile':      return <Profile />;
      default:             return null;
    }
  };

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <ToastProvider>
      <TooltipProvider delayDuration={150}>
        <div className="flex min-h-screen flex-col">
          <TopBar tabs={visibleTabs} onOpenMobileNav={() => setMobileNavOpen(true)} />

          <div className="flex min-w-0 flex-1">
            <Sidebar visibleTabs={visibleTabs} mobileOpen={mobileNavOpen} onMobileOpenChange={setMobileNavOpen} />
            <main className="min-w-0 flex-1 p-3 sm:p-5 lg:p-8">
              <div className={cn('mx-auto w-full', activeTab !== 'architecture' && 'max-w-7xl')}>{renderSection()}</div>
            </main>
          </div>
        </div>

        {/* Hidden on the whiteboard, where it would cover Excalidraw's controls. */}
        {activeTab !== 'architecture' && <EnergyPanel activeEnergy={activeEnergy} setActiveEnergy={setActiveEnergy} />}
        <ConfirmDialog />
      </TooltipProvider>
    </ToastProvider>
  );
}
