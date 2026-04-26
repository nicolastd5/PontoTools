import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth }  from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../contexts/ThemeContext';
import LogoIcon     from './LogoIcon';
import api from '../../services/api';
import './AdminLayout.css';

/* ── Ícones SVG ── */
const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  dashboard:     'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  employees:     'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  clocks:        'M12 2a10 10 0 1 1 0 20A10 10 0 0 1 12 2z M12 6v6l4 2',
  photos:        'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  blocked:       'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M4.93 4.93l14.14 14.14',
  services:      'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
  notifications: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0',
  contracts:     'M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  jobroles:      'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z M7 7h.01',
  export:        'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  profile:       'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  logout:        'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  sun:           'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 5a7 7 0 1 0 0 14A7 7 0 0 0 12 5z',
  moon:          'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  bell:          'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0',
  menu:          'M3 12h18M3 6h18M3 18h18',
  arrowLeft:     'M19 12H5M12 19l-7-7 7-7',
  trash:         'M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  search:        'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z',
};

/* ── Navegação ── */
const ADMIN_OP = [
  { to: '/admin/dashboard',     label: 'Dashboard',     icon: 'dashboard'     },
  { to: '/admin/employees',     label: 'Funcionários',  icon: 'employees'     },
  { to: '/admin/clocks',        label: 'Registros',     icon: 'clocks'        },
  { to: '/admin/photos',        label: 'Galeria',       icon: 'photos'        },
  { to: '/admin/blocked',       label: 'Bloqueios',     icon: 'blocked'       },
  { to: '/admin/services',      label: 'Serviços',      icon: 'services'      },
  { to: '/admin/notifications', label: 'Notificações',  icon: 'notifications' },
];
const ADMIN_CFG = [
  { to: '/admin/contracts',  label: 'Contratos', icon: 'contracts' },
  { to: '/admin/job-roles',  label: 'Cargos',    icon: 'jobroles'  },
  { to: '/admin/export',     label: 'Exportar',  icon: 'export'    },
];

const GESTOR_OP = [
  { to: '/admin/employees',     label: 'Funcionários', icon: 'employees'     },
  { to: '/admin/clocks',        label: 'Registros',    icon: 'clocks'        },
  { to: '/admin/photos',        label: 'Galeria',      icon: 'photos'        },
  { to: '/admin/services',      label: 'Serviços',     icon: 'services'      },
  { to: '/admin/notifications', label: 'Notificações', icon: 'notifications' },
];
const GESTOR_CFG = [
  { to: '/admin/contracts', label: 'Contratos', icon: 'contracts' },
];

/* ── Cores por tipo de notificação ── */
const TYPE_LABEL = {
  service_assigned: 'Serviço',
  service_late:     'Atraso',
  service_problem:  'Problema',
  manual:           'Manual',
};
const TYPE_COLOR = {
  service_assigned: '#4f46e5',
  service_late:     '#f59e0b',
  service_problem:  '#ef4444',
  manual:           '#8b5cf6',
};
const TYPE_ICON_D = {
  service_assigned: ICONS.services,
  service_late:     ICONS.clocks,
  service_problem:  ICONS.blocked,
  manual:           ICONS.bell,
};

/* ── Gradientes de avatar (por índice) ── */
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #4f46e5, #8b5cf6)',
  'linear-gradient(135deg, #0ea5e9, #4f46e5)',
  'linear-gradient(135deg, #10b981, #0ea5e9)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #8b5cf6, #ec4899)',
];

function avatarGradient(name) {
  const code = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[code % AVATAR_GRADIENTS.length];
}

/* ── Query ── */
function useAdminNotifications() {
  return useQuery({
    queryKey: ['admin-notifications'],
    queryFn:  () => api.get('/notifications').then((r) => r.data),
    refetchInterval: 30000,
  });
}

/* ── Componente de rótulo de grupo ── */
function NavGroup({ label }) {
  return (
    <div style={{
      padding: '16px 12px 4px',
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'rgba(161,161,170,0.5)',
    }}>
      {label}
    </div>
  );
}

/* ── Item de nav ── */
function NavItem({ to, label, icon, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', borderRadius: 8,
        color: isActive ? '#fff' : 'rgba(161,161,170,0.85)',
        background: isActive ? 'var(--color-primary)' : 'transparent',
        textDecoration: 'none', fontSize: 14, fontWeight: isActive ? 600 : 500,
        transition: 'all 0.15s ease',
      })}
      onMouseEnter={(e) => {
        if (!e.currentTarget.dataset.active) {
          e.currentTarget.style.background = 'rgba(244,244,245,0.08)';
          e.currentTarget.style.color = '#fff';
        }
      }}
      onMouseLeave={(e) => {
        if (!e.currentTarget.querySelector('svg')?.closest('[data-active]')) {
          const active = e.currentTarget.getAttribute('aria-current') === 'page';
          e.currentTarget.style.background = active ? 'var(--color-primary)' : 'transparent';
          e.currentTarget.style.color = active ? '#fff' : 'rgba(161,161,170,0.85)';
        }
      }}
    >
      <Icon d={ICONS[icon] || ICONS.dashboard} size={16} />
      {label}
    </NavLink>
  );
}

/* ── Componente principal ── */
export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bellOpen, setBellOpen]       = useState(false);
  const [selected, setSelected]       = useState(null);
  const bellRef  = useRef(null);
  const panelRef = useRef(null);

  const { user, logout }    = useAuth();
  const { success }         = useToast();
  const { isDark, toggleTheme } = useTheme();
  const navigate            = useNavigate();
  const location            = useLocation();
  const queryClient         = useQueryClient();

  const isGestor = user?.role === 'gestor';
  const opItems  = isGestor ? GESTOR_OP  : ADMIN_OP;
  const cfgItems = isGestor ? GESTOR_CFG : ADMIN_CFG;

  const { data: notifData } = useAdminNotifications();
  const notifications = notifData?.notifications || [];
  const unread        = notifData?.unread ?? 0;

  const { error: toastError } = useToast();

  const markRead = useMutation({
    mutationFn: (id) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries(['admin-notifications']),
  });

  const deleteNotif = useMutation({
    mutationFn: (id) => api.delete(`/notifications/${id}`),
    onSuccess: () => {
      setSelected(null);
      queryClient.invalidateQueries(['admin-notifications']);
    },
    onError: () => toastError('Erro ao excluir notificação.'),
  });

  const deleteRead = useMutation({
    mutationFn: () => api.delete('/notifications/read'),
    onSuccess: (res) => {
      const deleted = res.data?.deleted ?? 0;
      success(deleted > 0 ? `${deleted} notificação(ões) lida(s) excluída(s).` : 'Nenhuma notificação lida para excluir.');
      queryClient.invalidateQueries(['admin-notifications']);
    },
    onError: () => toastError('Erro ao excluir notificações lidas.'),
  });

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

  const readCount = notifications.filter((n) => n.read).length;

  function handleDeleteNotif(n, e) {
    e?.stopPropagation();
    if (!window.confirm(`Excluir a notificação "${n.title}"?`)) return;
    deleteNotif.mutate(n.id);
  }

  function handleDeleteRead() {
    if (readCount === 0) return;
    if (!window.confirm(`Excluir todas as ${readCount} notificações lidas?`)) return;
    deleteRead.mutate();
  }

  function fmtDate(dt) {
    const d      = new Date(dt);
    const diffMin = Math.floor((new Date() - d) / 60000);
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

  /* Breadcrumb simples baseado na rota */
  const crumb = (() => {
    const seg = location.pathname.split('/').filter(Boolean);
    if (seg.length < 2) return 'Dashboard';
    const all = [...ADMIN_OP, ...ADMIN_CFG, ...GESTOR_OP, ...GESTOR_CFG];
    const found = all.find((n) => n.to === location.pathname);
    return found?.label ?? seg[seg.length - 1];
  })();

  return (
    <div className="admin-root">
      {/* Overlay sidebar mobile */}
      <div
        className={`admin-overlay${sidebarOpen ? ' open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`admin-sidebar${sidebarOpen ? ' open' : ''}`}>
        {/* Logo */}
        <div style={s.sidebarHeader}>
          <LogoIcon size={36} />
          <div>
            <div style={s.logoText}>PontoTools</div>
            <div style={s.logoSub}>{isGestor ? 'Painel Gestor' : 'Painel Admin'}</div>
          </div>
        </div>

        {/* Search pill */}
        <div style={s.searchWrap}>
          <div style={s.searchPill}>
            <Icon d={ICONS.search} size={14} />
            <span style={{ flex: 1, color: 'rgba(161,161,170,0.5)', fontSize: 13 }}>
              Buscar...
            </span>
            <span style={s.kbdPill}>⌘K</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={s.nav}>
          <NavGroup label="Operação" />
          {opItems.map(({ to, label, icon }) => (
            <NavItem key={to} to={to} label={label} icon={icon} onClick={() => setSidebarOpen(false)} />
          ))}
          <NavGroup label="Configuração" />
          {cfgItems.map(({ to, label, icon }) => (
            <NavItem key={to} to={to} label={label} icon={icon} onClick={() => setSidebarOpen(false)} />
          ))}
        </nav>

        {/* Footer */}
        <div style={s.sidebarFooter}>
          <div style={s.userRow}>
            <div style={{ ...s.avatar, background: avatarGradient(user?.name) }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={s.userName}>{user?.name}</div>
              <div style={s.userEmail}>{user?.email}</div>
            </div>
            <button onClick={handleLogout} style={s.logoutIconBtn} title="Sair">
              <Icon d={ICONS.logout} size={16} />
            </button>
          </div>
          <NavLink
            to="/admin/profile"
            onClick={() => setSidebarOpen(false)}
            style={({ isActive }) => ({
              ...s.profileLink,
              background: isActive ? 'rgba(244,244,245,0.08)' : 'transparent',
              color: isActive ? '#fff' : 'rgba(161,161,170,0.7)',
            })}
          >
            <Icon d={ICONS.profile} size={14} />
            Meu Perfil
          </NavLink>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="admin-main">
        {/* Header */}
        <header className="admin-mobile-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setSidebarOpen(true)}
              style={s.menuBtn}
              className="admin-header-menu-btn"
            >
              <Icon d={ICONS.menu} size={20} />
            </button>
            {/* Breadcrumb */}
            <div style={s.breadcrumb} className="admin-header-title">
              <span style={s.breadcrumbRoot}>PontoTools</span>
              <span style={s.breadcrumbSep}>/</span>
              <span style={s.breadcrumbCurrent}>{crumb}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Dark mode toggle */}
            <button onClick={toggleTheme} style={s.iconBtn} title={isDark ? 'Modo claro' : 'Modo escuro'}>
              <Icon d={isDark ? ICONS.sun : ICONS.moon} size={18} />
            </button>

            {/* Sino */}
            <div style={{ position: 'relative' }} ref={bellRef}>
              <button
                onClick={() => { setBellOpen((o) => !o); setSelected(null); }}
                style={s.iconBtn}
                title="Notificações"
              >
                <Icon d={ICONS.bell} size={18} />
                {unread > 0 && <span style={s.bellDot} />}
              </button>

              {/* Painel dropdown */}
              {bellOpen && (
                <div ref={panelRef} style={s.panel}>
                  {selected ? (
                    <NotifDetail
                      n={selected}
                      onBack={() => setSelected(null)}
                      fmtDate={fmtDate}
                      onDelete={handleDeleteNotif}
                      deleting={deleteNotif.isLoading}
                    />
                  ) : (
                    <NotifList
                      notifications={notifications}
                      onSelect={openNotif}
                      fmtDate={fmtDate}
                      onViewAll={() => { setBellOpen(false); navigate('/admin/notifications'); }}
                      readCount={readCount}
                      onDeleteRead={handleDeleteRead}
                      deletingRead={deleteRead.isLoading}
                    />
                  )}
                </div>
              )}
            </div>
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

function NotifList({ notifications, onSelect, fmtDate, onViewAll, readCount, onDeleteRead, deletingRead }) {
  const recent = notifications.slice(0, 8);
  return (
    <>
      <div style={s.panelHeader}>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
          Notificações
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {readCount > 0 && (
            <button onClick={onDeleteRead} disabled={deletingRead} style={s.panelDeleteRead}>
              {deletingRead ? '...' : 'Limpar lidas'}
            </button>
          )}
          <button onClick={onViewAll} style={s.panelViewAll}>Ver todas →</button>
        </div>
      </div>
      <div style={{ overflowY: 'auto', maxHeight: 380 }}>
        {recent.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-subtle)', fontSize: 13 }}>
            Nenhuma notificação.
          </div>
        ) : (
          recent.map((n) => {
            const color = TYPE_COLOR[n.type] || 'var(--color-subtle)';
            const iconD = TYPE_ICON_D[n.type] || ICONS.bell;
            return (
              <button
                key={n.id}
                onClick={() => onSelect(n)}
                style={{
                  ...s.notifRow,
                  background: n.read ? 'transparent' : 'rgba(79,70,229,0.06)',
                }}
              >
                {/* Ícone em quadrado colorido */}
                <div style={{
                  width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                  background: color + '18',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color,
                }}>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d={iconD} />
                  </svg>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {TYPE_LABEL[n.type] || n.type}
                    </span>
                    {!n.read && <span style={s.unreadDot} />}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: 'var(--text-primary)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-subtle)' }}>{n.employee_name}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-subtle)', whiteSpace: 'nowrap', marginLeft: 8, flexShrink: 0 }}>
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

function NotifDetail({ n, onBack, fmtDate, onDelete, deleting }) {
  const color = TYPE_COLOR[n.type] || 'var(--color-subtle)';
  const iconD = TYPE_ICON_D[n.type] || ICONS.bell;
  return (
    <div>
      <div style={s.panelHeader}>
        <button onClick={onBack} style={s.backBtn}>
          <Icon d={ICONS.arrowLeft} size={14} />
          Voltar
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {TYPE_LABEL[n.type] || n.type}
          </span>
          <button onClick={(e) => onDelete(n, e)} disabled={deleting} style={s.panelDeleteBtn} title="Excluir">
            <Icon d={ICONS.trash} size={14} />
          </button>
        </div>
      </div>
      <div style={{ padding: '16px 16px 20px' }}>
        {/* Ícone */}
        <div style={{
          width: 44, height: 44, borderRadius: 10, marginBottom: 12,
          background: color + '18',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color,
        }}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d={iconD} />
          </svg>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.4 }}>
          {n.title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.6, marginBottom: 16 }}>
          {n.body}
        </div>
        <div style={{ background: 'var(--color-hairline)', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Funcionário: </strong>
            {n.employee_name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Recebida: </strong>
            {fmtDate(n.created_at)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Push enviado: </strong>
            {n.push_sent ? 'Sim' : 'Não'}
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
    padding: '20px 16px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  logoText: { color: '#f4f4f5', fontWeight: 700, fontSize: 14, lineHeight: 1.2 },
  logoSub:  { color: 'rgba(161,161,170,0.6)', fontSize: 11, fontWeight: 500 },

  searchWrap: { padding: '10px 12px 4px' },
  searchPill: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 10px', borderRadius: 8,
    background: 'rgba(244,244,245,0.06)',
    border: '1px solid rgba(255,255,255,0.06)',
    cursor: 'text', color: 'rgba(161,161,170,0.5)',
  },
  kbdPill: {
    fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
    padding: '2px 6px', borderRadius: 4,
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(161,161,170,0.5)',
    fontFamily: 'var(--font-mono)',
  },

  nav: { flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' },

  sidebarFooter: {
    padding: '12px 12px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  userRow: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34, height: 34, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0,
  },
  userName:  { color: '#f4f4f5', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userEmail: { color: 'rgba(161,161,170,0.6)', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  logoutIconBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'rgba(161,161,170,0.6)', padding: 4, borderRadius: 6,
    flexShrink: 0, display: 'flex', alignItems: 'center',
    transition: 'color 0.15s',
  },
  profileLink: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 10px', borderRadius: 8,
    fontSize: 13, fontWeight: 500,
    textDecoration: 'none', transition: 'all 0.15s',
  },

  menuBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--color-muted)', padding: 4, borderRadius: 6,
    display: 'flex', alignItems: 'center',
  },

  breadcrumb:        { display: 'flex', alignItems: 'center', gap: 6 },
  breadcrumbRoot:    { fontSize: 13, fontWeight: 500, color: 'var(--color-subtle)' },
  breadcrumbSep:     { fontSize: 13, color: 'var(--color-line)', userSelect: 'none' },
  breadcrumbCurrent: { fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' },

  iconBtn: {
    position: 'relative', background: 'none', border: 'none',
    cursor: 'pointer', padding: 7, borderRadius: 8,
    color: 'var(--color-muted)', display: 'flex', alignItems: 'center',
    transition: 'color 0.15s, background 0.15s',
  },
  bellDot: {
    position: 'absolute', top: 5, right: 5,
    width: 8, height: 8, borderRadius: '50%',
    background: '#ef4444',
    border: '2px solid var(--bg-card)',
    pointerEvents: 'none',
  },

  panel: {
    position: 'fixed', top: 60, right: 12,
    width: 340, background: 'var(--bg-card)', borderRadius: 12,
    border: '1px solid var(--border-default)',
    boxShadow: '0 20px 40px -12px rgba(0,0,0,0.15)',
    zIndex: 200, overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', borderBottom: '1px solid var(--color-hairline)',
  },
  panelViewAll: {
    background: 'none', border: 'none', color: 'var(--color-primary)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  panelDeleteRead: {
    background: 'none', border: 'none', color: 'var(--color-danger)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '2px 4px',
  },
  panelDeleteBtn: {
    background: 'none', border: 'none', color: 'var(--color-danger)',
    fontSize: 14, cursor: 'pointer', padding: '4px', borderRadius: 6,
    display: 'flex', alignItems: 'center',
  },
  backBtn: {
    background: 'none', border: 'none', color: 'var(--color-muted)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 4,
  },

  notifRow: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    width: '100%', padding: '11px 14px',
    border: 'none', borderBottom: '1px solid var(--color-hairline)',
    cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
  },
  unreadDot: {
    width: 6, height: 6, borderRadius: '50%',
    background: 'var(--color-primary)', display: 'inline-block', flexShrink: 0,
  },
};
