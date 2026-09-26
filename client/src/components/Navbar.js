import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import HelpModal from './HelpModal';
import { LicenseStatus } from './common/LicenseStatus';
import { useFeature } from '../hooks/useFeature';
import axios from 'axios';
import logoSmall from '../utils/brandAssets';
import pulseLogo from '../pulse/assets/logo.svg';

function PulseNavLink() {
  const { isAvailable } = useFeature('project_management');
  const location = useLocation();
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!isAvailable) return undefined;
    axios.get('/api/pulse/status')
      .then((res) => setOn(res.data.enabled !== false))
      .catch(() => setOn(false));
    return undefined;
  }, [isAvailable]);

  if (!isAvailable || !on) return null;
  const active = location.pathname.startsWith('/pulse') ? 'nav-link active' : 'nav-link';
  return <Link to="/pulse" className={active}>Pulse</Link>;
}

function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [showHelp, setShowHelp] = useState(false);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path) ? 'nav-link active' : 'nav-link';
  };

  // Check if user has elevated privileges (admin or godmode)
  const hasElevatedPrivileges = user?.role === 'godmode' || user?.role === 'admin';

  // Get role badge class based on role
  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'godmode':
        return 'godmode';
      case 'admin':
        return 'admin';
      default:
        return 'user';
    }
  };

  // Get display name for role
  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'godmode':
        return '⚡ GOD MODE';
      case 'admin':
        return 'ADMIN';
      default:
        return role;
    }
  };

  const helpButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.85rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)',
  };

  const reportButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.85rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
    textDecoration: 'none',
  };

  return (
    <>
      <nav className="navbar">
        {location.pathname.startsWith('/pulse') ? (
          <Link to="/pulse" className="navbar-brand">
            <img src={pulseLogo} alt="Pulse" style={{ height: '28px', width: '28px', marginRight: '8px', verticalAlign: 'middle', borderRadius: '7px' }} />
            Pulse
          </Link>
        ) : (
          <Link to="/" className="navbar-brand">
            <img src={logoSmall} alt="Mertis" style={{ height: '28px', marginRight: '8px', verticalAlign: 'middle' }} />
            Mertis
          </Link>
        )}
        
        <div className="navbar-nav">
          <Link to="/" className={location.pathname === '/' ? 'nav-link active' : 'nav-link'}>
            Dashboard
          </Link>
          <Link to="/projects" className={isActive('/projects')}>
            Projects
          </Link>
          <Link to="/my-bugs" className={isActive('/my-bugs')}>
            My Bugs
          </Link>
          <PulseNavLink />
          <Link to="/integrations/trello" className={isActive('/integrations/trello')}>
            Trello
          </Link>
          {hasElevatedPrivileges && (
            <Link to="/users" className={isActive('/users')}>
              Users
            </Link>
          )}
	  {hasElevatedPrivileges && (
            <Link to="/email-config" className={isActive('/email-config')}>
              Email Config
            </Link>
          )}
          {hasElevatedPrivileges && (
            <Link to="/deployment" className={isActive('/deployment')}>
              Deployment
            </Link>
          )}
          {hasElevatedPrivileges && (
            <Link to="/reports" className={isActive('/reports')}>
              Reports
            </Link>
          )}
        </div>

        <div className="navbar-user">
          {/* Reports Button - Only for godmode/admin */}
          {hasElevatedPrivileges && (
            <Link 
              to="/reports"
              style={reportButtonStyle}
              onMouseOver={e => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
              }}
              onMouseOut={e => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
              }}
              title="Generate Reports"
            >
              <span style={{ fontSize: '1rem' }}>📊</span>
              <span>Reports</span>
            </Link>
          )}
          
          {/* Help Button - Opens Modal */}
          <button 
            style={helpButtonStyle}
            onClick={() => setShowHelp(true)}
            onMouseOver={e => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.4)';
            }}
            onMouseOut={e => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 2px 8px rgba(79, 70, 229, 0.3)';
            }}
            title="User Manual & Help"
          >
            <span style={{ fontSize: '1rem' }}>📖</span>
            <span>Help</span>
          </button>
          
          <span className="user-info">
            <LicenseStatus />
            {' '}
            {user?.username}
            <span className={`role-badge ${getRoleBadgeClass(user?.role)}`}>
              {getRoleDisplayName(user?.role)}
            </span>
          </span>
          <Link to="/change-password" className="btn btn-secondary btn-sm" style={{ marginRight: '0.5rem' }} title="Change Password">
            🔒
          </Link>
          <button className="btn btn-secondary btn-sm" onClick={logout}>
            Logout
          </button>
        </div>
      </nav>

      {/* Help Modal */}
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </>
  );
}

export default Navbar;
