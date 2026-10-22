// UrbanPulse Dispatch — Sidebar Navigation Component
// Matches Reference Layout: Narrow 68px rail, electric blue active badge, icon tooltips

function SidebarNav({ currentView, onViewChange, currentUser }) {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard Overview',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      )
    },
    {
      id: 'booking',
      label: 'Customer Booking',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 8v8"></path>
          <path d="M8 12h8"></path>
        </svg>
      )
    },
    {
      id: 'driver',
      label: 'Driver Portal',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="m4.93 4.93 4.24 4.24"></path>
          <path d="m14.83 9.17 4.24-4.24"></path>
          <path d="m14.83 14.83 4.24 4.24"></path>
          <path d="m9.17 14.83-4.24 4.24"></path>
          <circle cx="12" cy="12" r="4"></circle>
        </svg>
      )
    },
    {
      id: 'fleet',
      label: 'Fleet & Operations',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1 .4-1 1v7c0 .6.4 1 1 1h2"></path>
          <circle cx="7" cy="17" r="2"></circle>
          <path d="M9 17h6"></path>
          <circle cx="17" cy="17" r="2"></circle>
        </svg>
      )
    },
    {
      id: 'inspector',
      label: 'System Inspector (30 Concepts)',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="2"></rect>
          <rect x="9" y="9" width="6" height="6"></rect>
          <path d="M9 1v3"></path>
          <path d="M15 1v3"></path>
          <path d="M9 20v3"></path>
          <path d="M15 20v3"></path>
          <path d="M20 9h3"></path>
          <path d="M20 14h3"></path>
          <path d="M1 9h3"></path>
          <path d="M1 14h3"></path>
        </svg>
      )
    }
  ];

  return (
    <aside className="ap-sidebar">
      {/* Brand Glyph */}
      <div className="ap-brand-icon" onClick={() => onViewChange('dashboard')} title="UrbanPulse Dispatch">
        ⚡
      </div>

      {/* Main Navigation Stack */}
      <nav className="ap-nav-group">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              className={`ap-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onViewChange(item.id)}
            >
              {item.icon}
              <span className="ap-tooltip">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User Avatar */}
      <div className="ap-user-avatar" title={`Signed in as: ${currentUser?.name || 'Aarav Sharma'}`}>
        {currentUser?.name ? currentUser.name.charAt(0) : 'A'}
      </div>
    </aside>
  );
}

window.SidebarNav = SidebarNav;

