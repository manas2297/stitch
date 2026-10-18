import { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import useAppStore from './store/useAppStore';
import { ToastProvider } from './components/Toast';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import EnergyPanel from './components/layout/EnergyPanel';
import ConfirmDialog from './components/layout/ConfirmDialog';
import Sidebar from './components/Sidebar';
import Overview from './components/Overview';
import FocusWorkspace from './components/FocusWorkspace';
import MajorProjects from './components/MajorProjects';
import Releases from './components/Releases';
import PRReviews from './components/PRReviews';
import Issues from './components/Issues';
import Builds from './components/Builds';
import Repositories from './components/Repositories';
import Profile from './components/Profile';
import AIMonitor from './components/AIMonitor';

const TABS = [
  { id: 'overview',     label: 'Overview',       icon: 'overview'     },
  { id: 'repositories', label: 'Repositories',   icon: 'repositories' },
  { id: 'focus',        label: 'Focus Area',      icon: 'focus'        },
  { id: 'projects',     label: 'Major Projects',  icon: 'projects'     },
  { id: 'releases',     label: 'Cut Release',     icon: 'releases'     },
  { id: 'pr-reviews',   label: 'PR Reviews',      icon: 'pr-reviews'   },
  { id: 'issues',       label: 'Issues',          icon: 'issues'       },
  { id: 'builds',       label: 'Fix Builds',      icon: 'builds'       },
  { id: 'ai-monitor',   label: 'AI Monitor',      icon: 'gemini-monitor'},
  { id: 'profile',      label: 'Profile',         icon: 'profile'      },
];

export default function App() {
  const {
    repos,
    activeTab,
    activeEnergy,
    setActiveTab,
    setActiveEnergy,
    loadRepos,
    tabEnergies,
    githubRepoCount,
  } = useAppStore();

  useEffect(() => {
    loadRepos();

    // Deep link to a tab, e.g. /#releases
    const hashTab = window.location.hash.slice(1);
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

  const majorCount = repos.filter((r) => r.isMajorProject).length;

  const renderSection = () => {
    switch (activeTab) {
      case 'overview':     return <Overview />;
      case 'repositories': return <Repositories />;
      case 'focus':        return <FocusWorkspace />;
      case 'projects':     return <MajorProjects />;
      case 'releases':     return <Releases />;
      case 'pr-reviews':   return <PRReviews />;
      case 'issues':       return <Issues />;
      case 'builds':       return <Builds />;
      case 'ai-monitor':   return <AIMonitor />;
      case 'profile':      return <Profile />;
      default:             return null;
    }
  };

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const trackedStats = [
    { icon: '📦', value: githubRepoCount > 0 ? githubRepoCount : repos.length, label: 'repos' },
    { icon: '⭐', value: majorCount, label: 'major' },
    { icon: '💻', value: repos.filter((r) => r.type === 'local').length, label: 'local' },
    { icon: '🌐', value: repos.length, label: 'tracked' },
  ];

  return (
    <ToastProvider>
      <TooltipProvider delayDuration={150}>
        <div className="flex min-h-screen flex-col">
          <div
            role="banner"
            className="bg-background/85 sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b px-3 backdrop-blur sm:px-5"
          >
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation"
              >
                <Menu />
              </Button>
              <div className="flex items-center gap-2.5">
                <div className="from-primary to-accent size-3 rounded-full bg-gradient-to-br shadow-[0_0_12px_rgba(37,99,235,0.45)]" />
                <h1 className="text-xl font-bold tracking-tight">Stitch</h1>
              </div>
            </div>

            {(repos.length > 0 || githubRepoCount > 0) && (
              <div className="text-muted-foreground hidden items-center gap-4 text-sm md:flex">
                {trackedStats.map((stat, i) => (
                  <div key={stat.label} className="flex items-center gap-4">
                    {i > 0 && <span className="bg-border h-4 w-px" />}
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden>{stat.icon}</span>
                      <strong className="text-foreground">{stat.value}</strong> {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1">
            <Sidebar visibleTabs={visibleTabs} mobileOpen={mobileNavOpen} onMobileOpenChange={setMobileNavOpen} />
            <main className="min-w-0 flex-1 p-3 sm:p-5 lg:p-8">
              <div className="mx-auto w-full max-w-7xl">{renderSection()}</div>
            </main>
          </div>
        </div>

        <EnergyPanel activeEnergy={activeEnergy} setActiveEnergy={setActiveEnergy} />
        <ConfirmDialog />
      </TooltipProvider>
    </ToastProvider>
  );
}
