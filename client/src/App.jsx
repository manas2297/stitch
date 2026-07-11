import { useState, useEffect, useRef } from 'react';
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

const ENERGY_CONFIG = {
  all: {
    label: 'All Modes',
    emoji: '⚡',
    desc: 'Show every section regardless of energy level.',
    color: 'rgba(255,255,255,0.85)',
    bg: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.1)',
    glow: 'rgba(255,255,255,0.08)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    ),
  },
  low: {
    label: 'Low Energy',
    emoji: '🌤',
    desc: 'Light review & triage tasks. Easy focus.',
    color: '#38bdf8',
    bg: 'rgba(56,189,248,0.1)',
    border: 'rgba(56,189,248,0.25)',
    glow: 'rgba(56,189,248,0.18)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
      </svg>
    ),
  },
  medium: {
    label: 'Medium Energy',
    emoji: '⚡',
    desc: 'Releases, projects & balanced workload.',
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.1)',
    border: 'rgba(251,191,36,0.25)',
    glow: 'rgba(251,191,36,0.18)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  high: {
    label: 'High Energy',
    emoji: '🔥',
    desc: 'Deep work: builds, focus, and active dev.',
    color: '#f43f5e',
    bg: 'rgba(244,63,94,0.1)',
    border: 'rgba(244,63,94,0.25)',
    glow: 'rgba(244,63,94,0.18)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
      </svg>
    ),
  },
};

/** Floating energy mode chooser — chat-panel style, anchored bottom-right */
function EnergyPanel({ activeEnergy, setActiveEnergy }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const cfg = ENERGY_CONFIG[activeEnergy];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="energy-float-root" ref={panelRef}>
      {/* ── Panel ─────────────────────────────────────── */}
      <div className={`energy-float-panel ${open ? 'open' : ''}`}>
        {/* Panel header */}
        <div className="efp-header">
          <div className="efp-header-left">
            <div className="efp-header-dot" style={{ background: cfg.color, boxShadow: `0 0 10px ${cfg.glow}` }} />
            <span className="efp-header-title">Energy Mode</span>
          </div>
          <button className="efp-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
        </div>

        {/* Active mode hero */}
        <div className="efp-active-hero" style={{ background: cfg.bg, borderColor: cfg.border }}>
          <div className="efp-active-left">
            <span className="efp-active-emoji">{cfg.emoji}</span>
            <div>
              <div className="efp-active-label" style={{ color: cfg.color }}>{cfg.label}</div>
              <div className="efp-active-desc">{cfg.desc}</div>
            </div>
          </div>
          <svg className="efp-active-check" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke={cfg.color} strokeWidth="1.5" opacity="0.4" />
            <path d="M5 8l2 2 4-4" stroke={cfg.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Divider */}
        <div className="efp-divider">
          <span>Switch Mode</span>
        </div>

        {/* Mode options */}
        <div className="efp-options">
          {Object.entries(ENERGY_CONFIG).map(([key, conf]) => {
            const isActive = key === activeEnergy;
            return (
              <button
                key={key}
                className={`efp-option ${isActive ? 'active' : ''}`}
                style={isActive ? { background: conf.bg, borderColor: conf.border } : {}}
                onClick={() => { setActiveEnergy(key); setOpen(false); }}
              >
                <span className="efp-option-icon" style={{ color: conf.color, stroke: conf.color }}>
                  {conf.icon}
                </span>
                <div className="efp-option-text">
                  <span className="efp-option-label" style={isActive ? { color: conf.color } : {}}>{conf.label}</span>
                  <span className="efp-option-desc">{conf.desc}</span>
                </div>
                {isActive && (
                  <svg className="efp-option-check" viewBox="0 0 16 16" fill="none">
                    <path d="M4 8l3 3 5-5" stroke={conf.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="efp-footer">
          Press <kbd>Esc</kbd> to close · Tab visibility updates instantly
        </div>
      </div>

      {/* ── Trigger FAB ───────────────────────────────── */}
      <button
        className={`energy-fab ${open ? 'fab-open' : ''}`}
        style={{
          '--fab-color': cfg.color,
          '--fab-glow': cfg.glow,
          '--fab-bg': cfg.bg,
          '--fab-border': cfg.border,
        }}
        onClick={() => setOpen(v => !v)}
        aria-label={`Energy mode: ${cfg.label}`}
        title={`Current mode: ${cfg.label}. Click to switch.`}
      >
        <span className="fab-icon" style={{ color: cfg.color }}>
          {cfg.icon}
        </span>
        <span className="fab-label" style={{ color: cfg.color }}>{cfg.label}</span>
        <span className="fab-chevron" style={{ color: cfg.color }}>
          {open ? '▾' : '▴'}
        </span>
      </button>
    </div>
  );
}

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
    githubRepoCount,
  } = useAppStore();

  useEffect(() => {
    loadRepos();

    // Intercept clicks on external links when running inside Wails desktop app
    const handleExternalLinks = (e) => {
      const anchor = e.target.closest('a');
      if (anchor && (anchor.target === '_blank' || anchor.href.startsWith('http'))) {
        if (window.go?.main?.App) {
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
      </header>

      <main className={sidebarCollapsed ? 'sidebar-collapsed' : ''}>
        <Sidebar tabs={tabsWithEnergy} visibleTabs={visibleTabs} />
        <div className="content-panel">{renderSection()}</div>
      </main>

      {/* Floating energy mode panel — always on top, bottom-right */}
      <EnergyPanel activeEnergy={activeEnergy} setActiveEnergy={setActiveEnergy} />
    </ToastProvider>
  );
}
