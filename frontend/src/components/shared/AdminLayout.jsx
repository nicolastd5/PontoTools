import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate }      from 'react-router-dom';
import { useAuth }   from '../../contexts/AuthContext';
import { useToast }  from '../../contexts/ToastContext';
import './AdminLayout.css';

const ADMIN_NAV = [
  { to: '/admin/dashboard',     label: 'Dashboard',     icon: '▦' },
  { to: '/admin/employees',     label: 'Funcionários',  icon: '👤' },
  { to: '/admin/clocks',        label: 'Registros',     icon: '🕐' },
  { to: '/admin/photos',        label: 'Galeria',       icon: '🖼️' },
  { to: '/admin/blocked',       label: 'Bloqueios',     icon: '⛔' },
  { to: '/admin/services',      label: 'Serviços',      icon: '🔧' },
  { to: '/admin/notifications', label: 'Notificações',  icon: '🔔' },
  { to: '/admin/contracts',     label: 'Contratos',     icon: '📋' },
  { to: '/admin/job-roles',     label: 'Cargos',        icon: '🏷️' },
  { to: '/admin/export',        label: 'Exportar',      icon: '📄' },
];

const GESTOR_NAV = [
  { to: '/admin/employees',     label: 'Funcionários',  icon: '👤' },
  { to: '/admin/clocks',        label: 'Registros',     icon: '🕐' },
  { to: '/admin/photos',        label: 'Galeria',       icon: '🖼️' },
  { to: '/admin/services',      label: 'Serviços',      icon: '🔧' },
  { to: '/admin/notifications', label: 'Notificações',  icon: '🔔' },
  { to: '/admin/contracts',     label: 'Contratos',     icon: '📋' },
];

function getInitialTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme]             = useState(getInitialTheme);
  const { user, logout }  = useAuth();
  const { success }       = useToast();
  const navigate          = useNavigate();
  const NAV_ITEMS = user?.role === 'gestor' ? GESTOR_NAV : ADMIN_NAV;

  // Aplica data-theme no <html> sempre que mudar
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => t === 'dark' ? 'light' : 'dark');
  }, []);

  function closeSidebar() { setSidebarOpen(false); }

  async function handleLogout() {
    await logout();
    success('Até logo!');
    navigate('/login');
  }

  const isDark = theme === 'dark';

  return (
    <div className="admin-root">
      {/* Overlay */}
      <div className={`admin-overlay${sidebarOpen ? ' open' : ''}`} onClick={closeSidebar} />

      {/* Sidebar */}
      <aside className={`admin-sidebar${sidebarOpen ? ' open' : ''}`}>
        {/* Logo + fechar */}
        <div style={s.sidebarHeader}>
          <span style={s.logo}>P</span>
          <span style={s.logoText}>Ponto Eletrônico</span>
          <button onClick={closeSidebar} style={s.closeBtn} title="Fechar menu">✕</button>
        </div>

        {/* Nav */}
        <nav style={s.nav}>
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={closeSidebar}
              style={({ isActive }) => ({ ...s.navItem, ...(isActive ? s.navItemActive : {}) })}
            >
              <span style={s.navIcon}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={s.sidebarFooter}>
          <div style={s.userInfo}>
            <div style={s.avatar}>{user?.name?.[0]?.toUpperCase()}</div>
            <div>
              <div style={s.userName}>{user?.name}</div>
              <div style={s.userRole}>{user?.role === 'gestor' ? 'Gestor' : 'Administrador'}</div>
            </div>
          </div>
          <NavLink
            to="/admin/profile"
            onClick={closeSidebar}
            style={({ isActive }) => ({ ...s.profileLink, background: isActive ? '#1e293b' : 'transparent' })}
          >
            Meu Perfil
          </NavLink>
          <button onClick={handleLogout} style={s.logoutBtn}>Sair</button>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="admin-main">
        {/* Header */}
        <header className="admin-mobile-header">
          <button onClick={() => setSidebarOpen(true)} style={s.menuBtn} title="Abrir menu">
            <span style={s.hamburgerLine} />
            <span style={s.hamburgerLine} />
            <span style={s.hamburgerLine} />
          </button>

          <span style={{ ...s.headerTitle, color: isDark ? '#f1f5f9' : '#0f172a' }}>
            Ponto Eletrônico
          </span>

          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            title={isDark ? 'Modo claro' : 'Modo escuro'}
            style={{
              ...s.themeBtn,
              background: isDark ? '#1e293b' : '#f1f5f9',
              border: `1.5px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              color: isDark ? '#f1f5f9' : '#374151',
            }}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const s = {
  sidebarHeader: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '16px 16px 14px',
    borderBottom: '1px solid var(--sidebar-sep)',
  },
  logo: {
    width: 34, height: 34, background: '#1d4ed8', borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 800, fontSize: 17, flexShrink: 0,
  },
  logoText: { color: '#f8fafc', fontWeight: 700, fontSize: 14, flex: 1 },
  closeBtn: {
    background: 'none', border: 'none', color: '#64748b',
    cursor: 'pointer', fontSize: 16, padding: '2px 4px', lineHeight: 1,
  },
  nav: {
    flex: 1, padding: '10px 10px', display: 'flex',
    flexDirection: 'column', gap: 2, overflowY: 'auto',
  },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 12px', borderRadius: 8,
    color: '#94a3b8', textDecoration: 'none',
    fontSize: 14, fontWeight: 500, transition: 'all 0.15s',
  },
  navItemActive: { background: '#1d4ed8', color: '#fff' },
  navIcon: { fontSize: 16, width: 20, textAlign: 'center', flexShrink: 0 },
  sidebarFooter: {
    padding: '14px 14px', borderTop: '1px solid var(--sidebar-sep)',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  userInfo:  { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34, height: 34, background: '#1d4ed8', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 700, fontSize: 15, flexShrink: 0,
  },
  userName: { color: '#f1f5f9', fontSize: 13, fontWeight: 600 },
  userRole: { color: '#64748b', fontSize: 11 },
  profileLink: {
    display: 'block', textAlign: 'center', padding: '7px',
    borderRadius: 6, color: '#94a3b8', fontSize: 13,
    textDecoration: 'none', fontWeight: 500, transition: 'all 0.15s',
  },
  logoutBtn: {
    background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 6, color: '#94a3b8', fontSize: 13,
    padding: '7px', cursor: 'pointer', width: '100%', transition: 'all 0.15s',
  },
  menuBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', gap: 5,
    padding: '6px', borderRadius: 6,
  },
  hamburgerLine: {
    display: 'block', width: 22, height: 2,
    background: 'var(--text-primary)', borderRadius: 2,
  },
  headerTitle: { fontWeight: 700, fontSize: 16 },
  themeBtn: {
    width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
    fontSize: 16, display: 'flex', alignItems: 'center',
    justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0,
  },
};
