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
  { id: 'overview',     label: 'Overview',       icon: 'overview',     energy: 'all'    },
  { id: 'repositories', label: 'Repositories',   icon: 'repositories', energy: 'all'    },
  { id: 'focus',        label: 'Focus Area',      icon: 'focus',        energy: 'high'   },
  { id: 'projects',     label: 'Major Projects',  icon: 'projects',     energy: 'medium' },
  { id: 'releases',     label: 'Cut Release',     icon: 'releases',     energy: 'medium' },
  { id: 'pr-reviews',   label: 'PR Reviews',      icon: 'pr-reviews',   energy: 'low'    },
  { id: 'issues',       label: 'Issues',          icon: 'issues',       energy: 'low'    },
  { id: 'builds',       label: 'Fix Builds',      icon: 'builds',       energy: 'high'   },
  { id: 'profile',      label: 'Profile',         icon: 'profile',      energy: 'all'    },
];

export default function App() {
  const { repos, activeTab, activeEnergy, setActiveTab, setActiveEnergy, loadRepos, sidebarCollapsed } = useAppStore();

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

  const visibleTabs = TABS.filter(
    (t) => activeEnergy === 'all' || t.energy === 'all' || t.energy === activeEnergy
  );

  // If active tab is hidden, switch to first visible
  useEffect(() => {
    if (!visibleTabs.find((t) => t.id === activeTab) && visibleTabs.length > 0) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [activeEnergy]);

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

  return (
    <ToastProvider>
      <header>
        <div className="brand">
          <div className="logo-glow" />
          <h1>Stitch</h1>
        </div>

        {repos.length > 0 && (
          <div className="header-stats">
            <div className="header-stat">
              <span>📦</span> <strong>{repos.length}</strong> repos
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
              <span>🌐</span> <strong>{repos.filter(r => r.type !== 'local').length}</strong> web
            </div>
          </div>
        )}

        <div className="energy-selector">
          <div className="energy-bar">
            {['all', 'low', 'medium', 'high'].map((e) => (
              <button
                key={e}
                data-energy={e}
                className={`energy-btn ${activeEnergy === e ? 'active' : ''}`}
                onClick={() => setActiveEnergy(e)}
              >
                {e === 'all' ? 'All Modes' : `${e.charAt(0).toUpperCase() + e.slice(1)} Energy`}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className={sidebarCollapsed ? 'sidebar-collapsed' : ''}>
        <Sidebar tabs={TABS} visibleTabs={visibleTabs} />
        <div className="content-panel">{renderSection()}</div>
      </main>
    </ToastProvider>
  );
}
