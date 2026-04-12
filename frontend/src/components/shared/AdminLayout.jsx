import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, NavLink, useNavigate }              from 'react-router-dom';
import { useQuery, useMutation, useQueryClient }     from '@tanstack/react-query';
import { useAuth }  from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import api from '../../services/api';
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

const TYPE_LABEL = {
  service_assigned: 'Serviço',
  service_late:     'Atraso',
  service_problem:  'Problema',
  manual:           'Manual',
};
const TYPE_COLOR = {
  service_assigned: '#1d4ed8',
  service_late:     '#d97706',
  service_problem:  '#dc2626',
  manual:           '#7c3aed',
};

function useAdminNotifications() {
  return useQuery({
    queryKey: ['admin-notifications'],
    queryFn:  () => api.get('/notifications').then((r) => r.data),
    refetchInterval: 30000,
  });
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bellOpen, setBellOpen]       = useState(false);
  const [selected, setSelected]       = useState(null); // notificação aberta
  const bellRef  = useRef(null);
  const panelRef = useRef(null);

  const { user, logout } = useAuth();
  const { success }      = useToast();
  const navigate         = useNavigate();
  const queryClient      = useQueryClient();
  const NAV_ITEMS = user?.role === 'gestor' ? GESTOR_NAV : ADMIN_NAV;

  const { data: notifData } = useAdminNotifications();
  const notifications = notifData?.notifications || [];
  const unread        = notifData?.unread ?? 0;

  const markRead = useMutation({
    mutationFn: (id) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries(['admin-notifications']),
  });

  // Fecha painel ao clicar fora
  useEffect(() => {
    function handleClick(e) {
      if (
        bellRef.current  && !bellRef.current.contains(e.target) &&
        panelRef.current && !panelRef.current.contains(e.target)
      ) {
        setBellOpen(false);
        setSelected(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function openNotif(n) {
    setSelected(n);
    if (!n.read) markRead.mutate(n.id);
  }

  function fmtDate(dt) {
    const d   = new Date(dt);
    const now = new Date();
    const diffMin = Math.floor((now - d) / 60000);
    if (diffMin < 1)   return 'agora mesmo';
    if (diffMin < 60)  return `há ${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24)    return `há ${diffH}h`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  async function handleLogout() {
    await logout();
    success('Até logo!');
    navigate('/login');
  }

  return (
    <div className="admin-root">
      {/* Overlay sidebar */}
      <div className={`admin-overlay${sidebarOpen ? ' open' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`admin-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div style={s.sidebarHeader}>
          <span style={s.logo}>P</span>
          <span style={s.logoText}>Ponto Eletrônico</span>
        </div>

        <nav style={s.nav}>
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              style={({ isActive }) => ({ ...s.navItem, ...(isActive ? s.navItemActive : {}) })}
            >
              <span style={s.navIcon}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={s.sidebarFooter}>
          <div style={s.userInfo}>
            <div style={s.avatar}>{user?.name?.[0]?.toUpperCase()}</div>
            <div>
              <div style={s.userName}>{user?.name}</div>
              <div style={s.userRole}>Administrador</div>
            </div>
          </div>
          <NavLink to="/admin/profile" onClick={() => setSidebarOpen(false)}
            style={({ isActive }) => ({ ...s.profileLink, background: isActive ? '#1e293b' : 'transparent' })}>
            Meu Perfil
          </NavLink>
          <button onClick={handleLogout} style={s.logoutBtn}>Sair</button>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="admin-main">
        {/* Header — sempre visível (sino em desktop e mobile) */}
        <header className="admin-mobile-header">
          <button onClick={() => setSidebarOpen(true)} style={s.menuBtn} className="admin-header-menu-btn">☰</button>
          <span style={s.headerTitle} className="admin-header-title">Ponto Eletrônico</span>

          {/* Sino de notificações */}
          <div style={{ position: 'relative' }} ref={bellRef}>
            <button
              onClick={() => { setBellOpen((o) => !o); setSelected(null); }}
              style={s.bellBtn}
              title="Notificações"
            >
              🔔
              {unread > 0 && (
                <span style={s.bellBadge}>{unread > 9 ? '9+' : unread}</span>
              )}
            </button>

            {/* Painel dropdown */}
            {bellOpen && (
              <div ref={panelRef} style={s.panel}>
                {selected ? (
                  /* Detalhe da notificação */
                  <NotifDetail n={selected} onBack={() => setSelected(null)} fmtDate={fmtDate} />
                ) : (
                  /* Lista */
                  <NotifList
                    notifications={notifications}
                    onSelect={openNotif}
                    fmtDate={fmtDate}
                    onViewAll={() => { setBellOpen(false); navigate('/admin/notifications'); }}
                  />
                )}
              </div>
            )}
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/* ── Sub-componentes do painel ── */

function NotifList({ notifications, onSelect, fmtDate, onViewAll }) {
  const recent = notifications.slice(0, 8);
  return (
    <>
      <div style={s.panelHeader}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Notificações</span>
        <button onClick={onViewAll} style={s.panelViewAll}>Ver todas →</button>
      </div>
      <div style={{ overflowY: 'auto', maxHeight: 360 }}>
        {recent.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            Nenhuma notificação.
          </div>
        ) : (
          recent.map((n) => {
            const dot = TYPE_COLOR[n.type] || '#94a3b8';
            return (
              <button
                key={n.id}
                onClick={() => onSelect(n)}
                style={{
                  ...s.notifRow,
                  background: n.read ? '#fff' : '#f0f7ff',
                  borderLeft: `3px solid ${n.read ? 'transparent' : dot}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: dot, textTransform: 'uppercase' }}>
                      {TYPE_LABEL[n.type] || n.type}
                    </span>
                    {!n.read && <span style={s.unreadDot} />}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: '#0f172a', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{n.employee_name}</div>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', marginLeft: 8, flexShrink: 0 }}>
                  {fmtDate(n.created_at)}
                </div>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}

function NotifDetail({ n, onBack, fmtDate }) {
  const dot = TYPE_COLOR[n.type] || '#94a3b8';
  return (
    <div style={{ padding: '0' }}>
      <div style={s.panelHeader}>
        <button onClick={onBack} style={s.backBtn}>← Voltar</button>
        <span style={{ fontSize: 10, fontWeight: 700, color: dot, textTransform: 'uppercase' }}>
          {TYPE_LABEL[n.type] || n.type}
        </span>
      </div>
      <div style={{ padding: '16px 16px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 8, lineHeight: 1.4 }}>
          {n.title}
        </div>
        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 16 }}>
          {n.body}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            <strong style={{ color: '#64748b' }}>Funcionário:</strong> {n.employee_name}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            <strong style={{ color: '#64748b' }}>Recebida:</strong> {fmtDate(n.created_at)}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            <strong style={{ color: '#64748b' }}>Push enviado:</strong> {n.push_sent ? 'Sim' : 'Não'}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Estilos ── */
const s = {
  sidebarHeader: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '20px 20px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  logo: {
    width: 36, height: 36, background: '#1d4ed8', borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 800, fontSize: 18,
  },
  logoText: { color: '#f8fafc', fontWeight: 700, fontSize: 15 },
  nav: { flex: 1, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 12px', borderRadius: 8,
    color: '#94a3b8', textDecoration: 'none',
    fontSize: 14, fontWeight: 500, transition: 'all 0.15s',
  },
  navItemActive: { background: '#1d4ed8', color: '#fff' },
  navIcon: { fontSize: 16 },
  sidebarFooter: {
    padding: '16px 16px', borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  userInfo:   { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34, height: 34, background: '#1d4ed8', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 700, fontSize: 15,
  },
  userName:   { color: '#f1f5f9', fontSize: 13, fontWeight: 600 },
  userRole:   { color: '#64748b', fontSize: 11 },
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
    background: 'none', border: 'none',
    fontSize: 22, cursor: 'pointer', color: '#374151',
  },
  headerTitle: { fontWeight: 700, fontSize: 16, color: '#0f172a' },

  /* Sino */
  bellBtn: {
    position: 'relative', background: 'none', border: 'none',
    fontSize: 20, cursor: 'pointer', padding: '4px 6px',
    borderRadius: 8, lineHeight: 1,
  },
  bellBadge: {
    position: 'absolute', top: -2, right: -4,
    background: '#ef4444', color: '#fff',
    borderRadius: 10, fontSize: 9, fontWeight: 700,
    padding: '1px 4px', lineHeight: 1.4, pointerEvents: 'none',
  },

  /* Painel dropdown */
  panel: {
    position: 'absolute', top: 'calc(100% + 10px)', right: 0,
    width: 320, background: '#fff', borderRadius: 12,
    border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
    zIndex: 200, overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
  },
  panelViewAll: {
    background: 'none', border: 'none', color: '#1d4ed8',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  backBtn: {
    background: 'none', border: 'none', color: '#64748b',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },

  /* Linha de notificação */
  notifRow: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    width: '100%', padding: '12px 16px',
    border: 'none', borderBottom: '1px solid #f8fafc',
    cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
  },
  unreadDot: {
    width: 6, height: 6, borderRadius: '50%',
    background: '#1d4ed8', display: 'inline-block', flexShrink: 0,
  },
};
