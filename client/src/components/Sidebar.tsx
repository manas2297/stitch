import useAppStore from '../store/useAppStore';
import Icon from './Icon';

export default function Sidebar({ tabs, visibleTabs }) {
  const { activeTab, setActiveTab, sidebarCollapsed, toggleSidebarCollapsed } = useAppStore();

  return (
    <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      {/* Dynamic Collapser Handle */}
      <button 
        className="sidebar-toggle-handle"
        onClick={toggleSidebarCollapsed}
        title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      >
        {sidebarCollapsed ? '›' : '‹'}
      </button>

      {/* Profile/Platform Header Brand (Only shown when expanded) */}
      {!sidebarCollapsed && (
        <div style={{ padding: '0 8px 12px 8px', borderBottom: '1px solid rgba(255,255,255,0.03)', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 600 }}>
            Workspace Portal
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-color)' }}>Developer Console</span>
          </div>
        </div>
      )}

      {/* Navigation Menu */}
      <ul className="menu-list">
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <li
              key={tab.id}
              className={`menu-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              title={sidebarCollapsed ? tab.label : ''}
              style={{ justifyContent: sidebarCollapsed ? 'center' : 'space-between', padding: sidebarCollapsed ? '14px 0' : '12px 16px' }}
            >
              <span className="menu-label" style={{ gap: sidebarCollapsed ? 0 : 12 }}>
                <span className="menu-icon-slot" style={{ transform: isActive ? 'scale(1.1)' : 'none' }}>
                  <Icon name={tab.icon} size={18} />
                </span> 
                {!sidebarCollapsed && <span className="menu-text-label">{tab.label}</span>}
              </span>
              {!sidebarCollapsed && (
                <span className={`menu-badge badge-${tab.energy === 'all' ? 'all' : tab.energy}`}>
                  {tab.energy === 'all' ? 'All' : tab.energy.charAt(0).toUpperCase() + tab.energy.slice(1)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
