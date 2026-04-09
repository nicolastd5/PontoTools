import { useState }       from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth }         from '../../contexts/AuthContext';
import { useToast }        from '../../contexts/ToastContext';

const NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'Dashboard',     icon: '▦' },
  { to: '/admin/employees', label: 'Funcionários',  icon: '👤' },
  { to: '/admin/clocks',    label: 'Registros',     icon: '🕐' },
  { to: '/admin/blocked',   label: 'Bloqueios',     icon: '⛔' },
  { to: '/admin/units',     label: 'Unidades',      icon: '📍' },
  { to: '/admin/export',    label: 'Exportar',      icon: '📄' },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout }  = useAuth();
  const { success }       = useToast();
  const navigate          = useNavigate();

  async function handleLogout() {
    await logout();
    success('Até logo!');
    navigate('/login');
  }

  return (
    <div style={styles.root}>
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div style={styles.overlay} onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside style={{ ...styles.sidebar, transform: sidebarOpen ? 'translateX(0)' : undefined }}>
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
      <div style={styles.main}>
        {/* Header mobile */}
        <header style={styles.mobileHeader}>
          <button onClick={() => setSidebarOpen(true)} style={styles.menuBtn}>☰</button>
          <span style={styles.headerTitle}>Ponto Eletrônico</span>
          <div />
        </header>

        <main style={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const SIDEBAR_WIDTH = 240;

const styles = {
  root: { display: 'flex', minHeight: '100vh', background: '#f1f5f9' },
  overlay: {
    display:  'none',
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.4)',
    zIndex: 40,
    '@media(maxWidth:768px)': { display: 'block' },
  },
  sidebar: {
    width:     SIDEBAR_WIDTH,
    minHeight: '100vh',
    background: '#0f172a',
    display:   'flex',
    flexDirection: 'column',
    position:  'fixed',
    top: 0, left: 0, bottom: 0,
    zIndex:    50,
    transition: 'transform 0.25s',
  },
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
  main: {
    marginLeft: SIDEBAR_WIDTH,
    flex: 1,
    display:    'flex',
    flexDirection: 'column',
    minHeight:  '100vh',
    // Mobile: sem margem (sidebar flutua)
    '@media(maxWidth:768px)': { marginLeft: 0 },
  },
  mobileHeader: {
    display:        'none',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '14px 20px',
    background:     '#fff',
    borderBottom:   '1px solid #e2e8f0',
    position:       'sticky', top: 0, zIndex: 30,
  },
  menuBtn: {
    background: 'none', border: 'none',
    fontSize: 22, cursor: 'pointer', color: '#374151',
  },
  headerTitle: { fontWeight: 700, fontSize: 16, color: '#0f172a' },
  content: { padding: '24px', flex: 1 },
};
