import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useQuery }  from '@tanstack/react-query';
import { useAuth }  from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import api from '../../services/api';

export default function EmployeeLayout() {
  const { user, logout } = useAuth();
  const { success }      = useToast();
  const navigate         = useNavigate();

  const { data: notifData } = useQuery({
    queryKey: ['my-notifications'],
    queryFn:  () => api.get('/notifications').then((r) => r.data),
    refetchInterval: 30000,
  });
  const unreadCount = notifData?.unread ?? 0;

  const { data: todayData } = useQuery({
    queryKey: ['clock-today'],
    queryFn:  () => api.get('/clock/today', { params: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } }).then((r) => r.data),
    staleTime: 60000,
  });
  const servicesOnly = todayData?.servicesOnly ?? false;

  async function handleLogout() {
    await logout();
    success('Até logo!');
    navigate('/login');
  }

  return (
    <div style={styles.root}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <div style={styles.userName}>{user?.name}</div>
          <div style={styles.unitName}>{user?.unit?.name}</div>
        </div>
        <button onClick={handleLogout} style={styles.logoutBtn}>Sair</button>
      </header>

      {/* Conteúdo */}
      <main style={styles.content}>
        <Outlet />
      </main>

      {/* Barra de navegação inferior (mobile) */}
      <nav style={styles.bottomNav}>
        {!servicesOnly && (
          <NavLink to="/dashboard" style={({ isActive }) => ({ ...styles.navItem, ...(isActive ? styles.navItemActive : {}) })}>
            <span>🕐</span>
            <span style={styles.navLabel}>Ponto</span>
          </NavLink>
        )}
        {!servicesOnly && (
          <NavLink to="/history" style={({ isActive }) => ({ ...styles.navItem, ...(isActive ? styles.navItemActive : {}) })}>
            <span>📋</span>
            <span style={styles.navLabel}>Histórico</span>
          </NavLink>
        )}
        <NavLink to="/services" style={({ isActive }) => ({ ...styles.navItem, ...(isActive ? styles.navItemActive : {}) })}>
          <span>🔧</span>
          <span style={styles.navLabel}>Serviços</span>
        </NavLink>
        <NavLink to="/notifications" style={({ isActive }) => ({ ...styles.navItem, ...(isActive ? styles.navItemActive : {}) })}>
          <span style={{ position: 'relative', display: 'inline-block' }}>
            🔔
            {unreadCount > 0 && (
              <span style={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </span>
          <span style={styles.navLabel}>Avisos</span>
        </NavLink>
      </nav>
    </div>
  );
}

const styles = {
  root: {
    minHeight: '100vh',
    display:   'flex',
    flexDirection: 'column',
    background: '#f8fafc',
    maxWidth:   480,
    margin:     '0 auto',
    position:   'relative',
  },
  header: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '16px 20px',
    background:     '#1d4ed8',
    color:          '#fff',
  },
  userName: { fontWeight: 700, fontSize: 15 },
  unitName: { fontSize: 12, opacity: 0.8, marginTop: 2 },
  logoutBtn: {
    background:   'rgba(255,255,255,0.15)',
    border:       'none',
    borderRadius: 6,
    color:        '#fff',
    padding:      '6px 12px',
    fontSize:     13,
    cursor:       'pointer',
  },
  content: { flex: 1, padding: '20px 16px', paddingBottom: 80 },
  bottomNav: {
    position:       'fixed',
    bottom:         0, left: '50%',
    transform:      'translateX(-50%)',
    width:          '100%',
    maxWidth:       480,
    display:        'flex',
    background:     '#fff',
    borderTop:      '1px solid #e2e8f0',
    boxShadow:      '0 -4px 12px rgba(0,0,0,0.08)',
  },
  navItem: {
    flex:           1,
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    gap:            4,
    padding:        '10px 0',
    textDecoration: 'none',
    color:          '#94a3b8',
    fontSize:       20,
    transition:     'color 0.15s',
  },
  navItemActive: { color: '#1d4ed8' },
  navLabel: { fontSize: 11, fontWeight: 600 },
  badge: {
    position: 'absolute', top: -4, right: -6,
    background: '#ef4444', color: '#fff',
    borderRadius: 10, fontSize: 9, fontWeight: 700,
    padding: '1px 4px', lineHeight: 1.4,
  },
};
