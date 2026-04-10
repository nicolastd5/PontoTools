import { useState }       from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth }         from '../../contexts/AuthContext';
import { useToast }        from '../../contexts/ToastContext';
import './AdminLayout.css';

const ADMIN_NAV = [
  { to: '/admin/dashboard', label: 'Dashboard',     icon: '▦' },
  { to: '/admin/employees', label: 'Funcionários',  icon: '👤' },
  { to: '/admin/clocks',    label: 'Registros',     icon: '🕐' },
  { to: '/admin/blocked',   label: 'Bloqueios',     icon: '⛔' },
  { to: '/admin/contracts', label: 'Contratos',     icon: '📋' },
  { to: '/admin/export',    label: 'Exportar',      icon: '📄' },
];

const GESTOR_NAV = [
  { to: '/admin/employees', label: 'Funcionários',  icon: '👤' },
  { to: '/admin/clocks',    label: 'Registros',     icon: '🕐' },
  { to: '/admin/contracts', label: 'Contratos',     icon: '📋' },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout }  = useAuth();
  const { success }       = useToast();
  const navigate          = useNavigate();
  const NAV_ITEMS = user?.role === 'gestor' ? GESTOR_NAV : ADMIN_NAV;

  async function handleLogout() {
    await logout();
    success('Até logo!');
    navigate('/login');
  }

  return (
    <div className="admin-root">
      {/* Overlay mobile */}
      <div
        className={`admin-overlay${sidebarOpen ? ' open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`admin-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div style={styles.sidebarHeader}>
          <span style={styles.logo}>P</span>
          <span style={styles.logoText}>Ponto Eletrônico</span>
        </div>

        <nav style={styles.nav}>
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
              })}
            >
              <span style={styles.navIcon}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={styles.userInfo}>
            <div style={styles.avatar}>{user?.name?.[0]?.toUpperCase()}</div>
            <div>
              <div style={styles.userName}>{user?.name}</div>
              <div style={styles.userRole}>Administrador</div>
            </div>
          </div>
          <button onClick={handleLogout} style={styles.logoutBtn}>Sair</button>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <div className="admin-main">
        {/* Header mobile */}
        <header className="admin-mobile-header">
          <button onClick={() => setSidebarOpen(true)} style={styles.menuBtn}>☰</button>
          <span style={styles.headerTitle}>Ponto Eletrônico</span>
          <div />
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const styles = {
  sidebarHeader: {
    display:    'flex',
    alignItems: 'center',
    gap:        10,
    padding:    '20px 20px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  logo: {
    width: 36, height: 36,
    background: '#1d4ed8',
    borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 800, fontSize: 18,
  },
  logoText: { color: '#f8fafc', fontWeight: 700, fontSize: 15 },
  nav: { flex: 1, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: {
    display:    'flex',
    alignItems: 'center',
    gap:         10,
    padding:    '9px 12px',
    borderRadius: 8,
    color:      '#94a3b8',
    textDecoration: 'none',
    fontSize:   14,
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  navItemActive: { background: '#1d4ed8', color: '#fff' },
  navIcon: { fontSize: 16 },
  sidebarFooter: {
    padding:      '16px 16px',
    borderTop:    '1px solid rgba(255,255,255,0.08)',
    display:      'flex',
    flexDirection:'column',
    gap:          10,
  },
  userInfo:  { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34, height: 34,
    background: '#1d4ed8',
    borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 700, fontSize: 15,
  },
  userName: { color: '#f1f5f9', fontSize: 13, fontWeight: 600 },
  userRole: { color: '#64748b', fontSize: 11 },
  logoutBtn: {
    background:   'transparent',
    border:       '1px solid rgba(255,255,255,0.15)',
    borderRadius: 6,
    color:        '#94a3b8',
    fontSize:     13,
    padding:      '7px',
    cursor:       'pointer',
    width:        '100%',
    transition:   'all 0.15s',
  },
  menuBtn: {
    background: 'none', border: 'none',
    fontSize: 22, cursor: 'pointer', color: '#374151',
  },
  headerTitle: { fontWeight: 700, fontSize: 16, color: '#0f172a' },
};
