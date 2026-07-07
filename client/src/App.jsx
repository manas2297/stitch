import { useEffect } from 'react';
import useAppStore from './store/useAppStore';
import { ToastProvider } from './components/Toast';
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

const TABS = [
  { id: 'overview',     label: 'Overview',       icon: 'overview'     },
  { id: 'repositories', label: 'Repositories',   icon: 'repositories' },
  { id: 'focus',        label: 'Focus Area',      icon: 'focus'        },
  { id: 'projects',     label: 'Major Projects',  icon: 'projects'     },
  { id: 'releases',     label: 'Cut Release',     icon: 'releases'     },
  { id: 'pr-reviews',   label: 'PR Reviews',      icon: 'pr-reviews'   },
  { id: 'issues',       label: 'Issues',          icon: 'issues'       },
  { id: 'builds',       label: 'Fix Builds',      icon: 'builds'       },
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
    sidebarCollapsed,
    tabEnergies,
    githubRepoCount
  } = useAppStore();

  useEffect(() => { 
    loadRepos(); 

    // Intercept clicks on external links when running inside Wails desktop app
    const handleExternalLinks = (e) => {
      const anchor = e.target.closest('a');
      if (anchor && (anchor.target === '_blank' || anchor.href.startsWith('http'))) {
        if (window.go && window.go.main && window.go.main.App) {
          e.preventDefault();
          window.go.main.App.OpenURL(anchor.href);
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

  // If active tab is hidden, switch to first visible
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
      case 'profile':      return <Profile />;
      default:             return null;
    }
  };

  const energyOptions = ['all', 'low', 'medium', 'high'];
  const activeIndex = energyOptions.indexOf(activeEnergy);

  return (
    <ToastProvider>
      <header>
        <div className="brand">
          <div className="logo-glow" />
          <h1>Stitch</h1>
        </div>

        {(repos.length > 0 || githubRepoCount > 0) && (
          <div className="header-stats">
            <div className="header-stat">
              <span>📦</span> <strong>{githubRepoCount > 0 ? githubRepoCount : repos.length}</strong> repos
            </div>
            <div className="header-stat-divider" />
            <div className="header-stat">
              <span>⭐</span> <strong>{majorCount}</strong> major
            </div>
            <div className="header-stat-divider" />
            <div className="header-stat">
              <span>💻</span> <strong>{repos.filter(r => r.type === 'local').length}</strong> local
            </div>
            <div className="header-stat-divider" />
            <div className="header-stat">
              <span>🌐</span> <strong>{repos.length}</strong> tracked
            </div>
          </div>
        )}

        <div className="energy-selector">
          <div className="energy-bar" style={{ '--active-index': activeIndex }}>
            <div className="energy-indicator" />
            {energyOptions.map((e) => (
              <button
                key={e}
                data-energy={e}
                className={`energy-btn ${activeEnergy === e ? 'active' : ''}`}
                onClick={() => setActiveEnergy(e)}
              >
                {e === 'all' && (
                  <svg className="energy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
                {e === 'low' && (
                  <svg className="energy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                  </svg>
                )}
                {e === 'medium' && (
                  <svg className="energy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
                {e === 'high' && (
                  <svg className="energy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  </svg>
                )}
                <span>
                  {e === 'all' ? 'All Modes' : `${e.charAt(0).toUpperCase() + e.slice(1)}`}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className={sidebarCollapsed ? 'sidebar-collapsed' : ''}>
        <Sidebar tabs={tabsWithEnergy} visibleTabs={visibleTabs} />
        <div className="content-panel">{renderSection()}</div>
      </main>
    </ToastProvider>
  );
}
