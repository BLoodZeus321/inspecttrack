import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_LINKS = [
  { to: '/',            label: 'Dashboard',          icon: '📊', exact: true,  adminOnly: false },
  { to: '/equipment',   label: 'Equipment & Tools',   icon: '⚙️', exact: false, adminOnly: false },
  { to: '/categories',  label: 'Categories & Alerts', icon: '🏷️', exact: false, adminOnly: true  },
  { to: '/alerts',      label: 'Alert Logs',          icon: '🔔', exact: false, adminOnly: true  },
  { to: '/import',      label: 'Import',              icon: '📥', exact: false, adminOnly: false, repOnly: true },
  { to: '/certificates',label: 'Certificates',         icon: '📄', exact: false, adminOnly: false, repOnly: false },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <nav style={{
      background: '#0f172a',
      position: 'sticky', top: 0, zIndex: 200,
      boxShadow: '0 1px 0 rgba(255,255,255,.06)',
    }}>
      <div style={{
        maxWidth: 1400, margin: '0 auto', padding: '0 24px',
        display: 'flex', alignItems: 'center',
      }}>
        {/* Logo */}
        <div style={{ marginRight: 28, padding: '12px 0', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/bhdc-logo.png" alt="BHDC" style={{ height: 32, width: 'auto', filter: 'brightness(0) invert(1)' }} />
          <div style={{ borderLeft: '1px solid rgba(255,255,255,.2)', paddingLeft: 10 }}>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 13, letterSpacing: '-.2px', lineHeight: 1.1 }}>InspectTrack</div>
            <div style={{ color: '#64748b', fontSize: 10, fontWeight: 500, letterSpacing: '.3px' }}>BHDC Equipment Management</div>
          </div>
        </div>

        {/* Nav links */}
        <div style={{ display: 'flex', flex: 1, gap: 0, overflowX: 'auto' }}>
          {NAV_LINKS.filter(l => (!l.adminOnly || user?.role === 'admin') && (!l.repOnly || user?.role !== 'viewer')).map(({ to, label, icon, exact }) => (
            <NavLink key={to} to={to} end={exact} style={({ isActive }) => ({
              color: isActive ? '#fff' : '#94a3b8',
              fontWeight: 600, fontSize: 13,
              padding: '17px 15px',
              textDecoration: 'none',
              borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
              transition: 'color .15s',
              whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 5,
            })}>
              <span style={{ fontSize: 14 }}>{icon}</span> {label}
            </NavLink>
          ))}
          {user?.role === 'admin' && (
            <NavLink to="/users" style={({ isActive }) => ({
              color: isActive ? '#fff' : '#94a3b8',
              fontWeight: 600, fontSize: 13,
              padding: '17px 15px',
              textDecoration: 'none',
              borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
              whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 5,
            })}>
              <span style={{ fontSize: 14 }}>👥</span> Users
            </NavLink>
          )}
        </div>

        {/* User avatar + dropdown */}
        <div ref={menuRef} style={{ position: 'relative', marginLeft: 12 }}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'transparent', border: '1px solid rgba(255,255,255,.12)',
              borderRadius: 10, padding: '7px 12px', cursor: 'pointer',
              color: '#fff', fontFamily: 'inherit',
            }}
          >
            {/* Avatar circle */}
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 12, color: '#fff', flexShrink: 0,
            }}>
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'capitalize', lineHeight: 1.2 }}>{user?.role}</div>
            </div>
            <span style={{ color: '#64748b', fontSize: 10, marginLeft: 2 }}>▼</span>
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 8px)',
              background: '#1e293b', border: '1px solid rgba(255,255,255,.1)',
              borderRadius: 12, minWidth: 180, overflow: 'hidden',
              boxShadow: '0 16px 40px rgba(0,0,0,.4)', zIndex: 300,
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{user?.name}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{user?.email}</div>
              </div>

              {[
                { label: '👤 My Profile',    action: () => { navigate('/profile'); setMenuOpen(false); } },
                { label: '🔑 Change Password', action: () => { navigate('/profile'); setMenuOpen(false); } },
              ].map(item => (
                <button key={item.label} onClick={item.action} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '10px 16px', background: 'none', border: 'none',
                  color: '#cbd5e1', fontSize: 13, cursor: 'pointer',
                  fontFamily: 'inherit', fontWeight: 500,
                }}
                  onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,.06)'}
                  onMouseLeave={e => e.target.style.background = 'none'}
                >{item.label}</button>
              ))}

              <div style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
                <button onClick={handleLogout} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '10px 16px', background: 'none', border: 'none',
                  color: '#f87171', fontSize: 13, cursor: 'pointer',
                  fontFamily: 'inherit', fontWeight: 600,
                }}
                  onMouseEnter={e => e.target.style.background = 'rgba(239,68,68,.1)'}
                  onMouseLeave={e => e.target.style.background = 'none'}
                >
                  🚪 Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
