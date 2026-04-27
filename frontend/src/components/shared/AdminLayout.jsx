import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient }      from '@tanstack/react-query';
import { useAuth }  from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../contexts/ThemeContext';
import Icon  from './Icon';
import Logo  from './Logo';
import api from '../../services/api';
import './AdminLayout.css';

const ADMIN_NAV_OP = [
  { to: '/admin/dashboard',     label: 'Dashboard',    icon: 'dashboard' },
  { to: '/admin/employees',     label: 'Funcionários', icon: 'users'     },
  { to: '/admin/clocks',        label: 'Registros',    icon: 'clock'     },
  { to: '/admin/photos',        label: 'Galeria',      icon: 'image'     },
  { to: '/admin/blocked',       label: 'Bloqueios',    icon: 'block'     },
  { to: '/admin/services',      label: 'Serviços',     icon: 'wrench'    },
  { to: '/admin/notifications', label: 'Notificações', icon: 'bell'      },
];
const ADMIN_NAV_CFG = [
  { to: '/admin/contracts',     label: 'Contratos',    icon: 'file'      },
  { to: '/admin/job-roles',     label: 'Cargos',       icon: 'tag'       },
  { to: '/admin/export',        label: 'Exportar',     icon: 'download'  },
];

const GESTOR_NAV_OP = [
  { to: '/admin/employees',     label: 'Funcionários', icon: 'users'  },
  { to: '/admin/clocks',        label: 'Registros',    icon: 'clock'  },
  { to: '/admin/photos',        label: 'Galeria',      icon: 'image'  },
  { to: '/admin/services',      label: 'Serviços',     icon: 'wrench' },
  { to: '/admin/notifications', label: 'Notificações', icon: 'bell'   },
];
const GESTOR_NAV_CFG = [
  { to: '/admin/contracts',     label: 'Contratos',    icon: 'file'   },
];

const ALL_NAV = [...ADMIN_NAV_OP, ...ADMIN_NAV_CFG, ...GESTOR_NAV_OP, ...GESTOR_NAV_CFG];

const TYPE_LABEL = {
  service_assigned: 'Serviço',
  service_late:     'Atraso',
  service_problem:  'Problema',
  manual:           'Manual',
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
  const [selected, setSelected]       = useState(null);
  const bellRef  = useRef(null);
  const panelRef = useRef(null);

  const { user, logout }               = useAuth();
  const { success }                    = useToast();
  const { theme, isDark, toggleTheme } = useTheme();
  const navigate                       = useNavigate();
  const location                       = useLocation();
  const queryClient                    = useQueryClient();

  const isGestor     = user?.role === 'gestor';
  const navOp        = isGestor ? GESTOR_NAV_OP  : ADMIN_NAV_OP;
  const navCfg       = isGestor ? GESTOR_NAV_CFG : ADMIN_NAV_CFG;
  const currentLabel = ALL_NAV.find((n) => location.pathname.startsWith(n.to))?.label || 'Admin';

  const { data: notifData }  = useAdminNotifications();
  const notifications        = notifData?.notifications || [];
  const unread               = notifData?.unread ?? 0;
  const { error: toastError } = useToast();

  const markRead = useMutation({
    mutationFn: (id) => api.patch(`/notifications/${id}/read`),
    onSuccess:  () => queryClient.invalidateQueries(['admin-notifications']),
  });

  const deleteNotif = useMutation({
    mutationFn: (id) => api.delete(`/notifications/${id}`),
    onSuccess:  () => { setSelected(null); queryClient.invalidateQueries(['admin-notifications']); },
    onError:    () => toastError('Erro ao excluir notificação.'),
  });

  const deleteRead = useMutation({
    mutationFn: () => api.delete('/notifications/read'),
    onSuccess:  (res) => {
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
      ) { setBellOpen(false); setSelected(null); }
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
    const d = new Date(dt);
    const now = new Date();
    const diffMin = Math.floor((now - d) / 60000);
    if (diffMin < 1)  return 'agora mesmo';
    if (diffMin < 60) return `há ${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24)   return `há ${diffH}h`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  async function handleLogout() {
    await logout();
    success('Até logo!');
    navigate('/login');
  }

  const initials = user?.name
    ? user.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : 'A';

  // Estilos derivados do tema
  const sectionLabel = {
    fontSize: 10, fontWeight: 600, color: theme.subtle,
    textTransform: 'uppercase', letterSpacing: '0.08em',
    padding: '12px 10px 6px',
  };

  function navItemStyle(isActive) {
    return {
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 10px', borderRadius: 8,
      color:      isActive ? theme.ink  : theme.muted,
      background: isActive ? theme.surface : 'transparent',
      border: 'none', fontSize: 13,
      fontWeight: isActive ? 600 : 500,
      cursor: 'pointer', width: '100%', textAlign: 'left',
      transition: 'all 0.1s', letterSpacing: '-0.01em',
      textDecoration: 'none',
    };
  }

  return (
    <div className="admin-root" style={{ background: theme.bg }}>
      {/* Overlay mobile */}
      <div className={`admin-overlay${sidebarOpen ? ' open' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`admin-sidebar${sidebarOpen ? ' open' : ''}`} style={{ background: theme.card, borderRight: `1px solid ${theme.line}` }}>
        {/* Logo + título */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 18px 16px' }}>
          <Logo size={32} theme={theme}/>
          <div>
            <div style={{ color: theme.ink, fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em' }}>PontoTools</div>
            <div style={{ color: theme.muted, fontSize: 11 }}>
              {isGestor ? 'Painel Gestor' : 'Painel Admin'}
            </div>
          </div>
        </div>

        {/* Barra de busca decorativa */}
        <div style={{ padding: '0 12px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: theme.hairline, color: theme.muted, fontSize: 13 }}>
            <Icon name="search" size={14} color={theme.muted}/>
            <span style={{ flex: 1 }}>Buscar…</span>
            <kbd style={{ fontFamily: 'inherit', fontSize: 10, padding: '2px 6px', background: theme.card, border: `1px solid ${theme.line}`, borderRadius: 4, color: theme.muted }}>⌘K</kbd>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' }}>
          <div style={sectionLabel}>Operação</div>
          {navOp.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)}
              style={({ isActive }) => navItemStyle(isActive)}
              onMouseEnter={(e) => { if (!e.currentTarget.style.background || e.currentTarget.style.background === 'transparent') e.currentTarget.style.background = theme.hairline; }}
              onMouseLeave={(e) => { const isActive = location.pathname.startsWith(to); e.currentTarget.style.background = isActive ? theme.surface : 'transparent'; }}>
              <Icon name={icon} size={16} color={location.pathname.startsWith(to) ? theme.primary : theme.muted}/>
              <span style={{ flex: 1 }}>{label}</span>
              {to === '/admin/notifications' && unread > 0 && (
                <span style={{ background: theme.primary, color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 600, padding: '1px 7px', lineHeight: 1.5 }}>{unread}</span>
              )}
            </NavLink>
          ))}

          {navCfg.length > 0 && (
            <>
              <div style={sectionLabel}>Configuração</div>
              {navCfg.map(({ to, label, icon }) => (
                <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)}
                  style={({ isActive }) => navItemStyle(isActive)}
                  onMouseEnter={(e) => { if (!e.currentTarget.style.background || e.currentTarget.style.background === 'transparent') e.currentTarget.style.background = theme.hairline; }}
                  onMouseLeave={(e) => { const isActive = location.pathname.startsWith(to); e.currentTarget.style.background = isActive ? theme.surface : 'transparent'; }}>
                  <Icon name={icon} size={16} color={location.pathname.startsWith(to) ? theme.primary : theme.muted}/>
                  <span style={{ flex: 1 }}>{label}</span>
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* Footer — usuário */}
        <div style={{ padding: 12, borderTop: `1px solid ${theme.line}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8 }}>
            <div style={{ width: 28, height: 28, background: `linear-gradient(135deg, ${theme.primary}, ${theme.violet})`, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: theme.ink, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || 'Admin'}</div>
              <div style={{ color: theme.muted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email || ''}</div>
            </div>
            <button onClick={handleLogout} title="Sair" style={{ background: 'none', border: 'none', color: theme.muted, cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex' }}>
              <Icon name="logout" size={14} color={theme.muted}/>
            </button>
          </div>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="admin-main">
        {/* Header */}
        <header className="admin-mobile-header" style={{ background: theme.card + 'cc', borderBottom: `1px solid ${theme.line}` }}>
          {/* Mobile: hamburguer + título */}
          <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: theme.ink }} className="admin-header-menu-btn">☰</button>
          <span style={{ fontWeight: 700, fontSize: 16, color: theme.ink }} className="admin-header-title">PontoTools</span>

          {/* Desktop: breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: theme.muted, fontSize: 13 }} className="admin-header-breadcrumb">
            <span>PontoTools</span>
            <Icon name="chevron" size={12} color={theme.muted}/>
            <span style={{ color: theme.ink, fontWeight: 600 }}>{currentLabel}</span>
          </div>

          {/* Direita: tema + sino */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={toggleTheme} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: theme.hairline, border: `1px solid ${theme.line}`, borderRadius: 8, color: theme.muted, fontSize: 12, cursor: 'pointer' }}>
              {isDark ? '☀️ Claro' : '🌙 Escuro'}
            </button>

            {/* Sino */}
            <div ref={bellRef} style={{ position: 'relative' }}>
              <button
                onClick={() => { setBellOpen((o) => !o); setSelected(null); }}
                style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex', color: theme.ink }}
                title="Notificações"
              >
                <Icon name="bell" size={18} color={theme.ink}/>
                {unread > 0 && (
                  <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, background: theme.danger, borderRadius: '50%', border: `2px solid ${theme.card}` }}/>
                )}
              </button>

              {bellOpen && (
                <div ref={panelRef} style={{ position: 'fixed', top: 64, right: 12, width: 340, background: theme.card, borderRadius: 12, border: `1px solid ${theme.line}`, boxShadow: '0 20px 40px -12px rgba(0,0,0,0.2)', zIndex: 200, overflow: 'hidden' }}>
                  {selected ? (
                    <NotifDetail n={selected} onBack={() => setSelected(null)} fmtDate={fmtDate} onDelete={handleDeleteNotif} deleting={deleteNotif.isLoading} theme={theme}/>
                  ) : (
                    <NotifList
                      notifications={notifications} onSelect={openNotif} fmtDate={fmtDate}
                      onViewAll={() => { setBellOpen(false); navigate('/admin/notifications'); }}
                      readCount={readCount} onDeleteRead={handleDeleteRead}
                      deletingRead={deleteRead.isLoading} theme={theme}
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

/* ── Painel de notificações ── */

function NotifList({ notifications, onSelect, fmtDate, onViewAll, readCount, onDeleteRead, deletingRead, theme }) {
  const recent = notifications.slice(0, 8);
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${theme.line}` }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: theme.ink, letterSpacing: '-0.01em' }}>Notificações</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {readCount > 0 && (
            <button onClick={onDeleteRead} disabled={deletingRead} style={{ background: 'none', border: 'none', color: theme.danger, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '2px 4px' }}>
              {deletingRead ? '...' : '🗑 Lidas'}
            </button>
          )}
          <button onClick={onViewAll} style={{ background: 'none', border: 'none', color: theme.primary, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Ver todas →</button>
        </div>
      </div>
      <div style={{ overflowY: 'auto', maxHeight: 360 }}>
        {recent.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: theme.muted, fontSize: 13 }}>Nenhuma notificação.</div>
        ) : (
          recent.map((n) => (
            <button
              key={n.id}
              onClick={() => onSelect(n)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                width: '100%', padding: '12px 16px',
                border: 'none', borderBottom: `1px solid ${theme.hairline}`,
                cursor: 'pointer', textAlign: 'left',
                background: n.read ? theme.card : theme.primarySoft + '40',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: theme.primary, textTransform: 'uppercase' }}>
                    {TYPE_LABEL[n.type] || n.type}
                  </span>
                  {!n.read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: theme.primary, display: 'inline-block', flexShrink: 0 }}/>}
                </div>
                <div style={{ fontSize: 13, fontWeight: n.read ? 500 : 600, color: theme.ink, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' }}>
                  {n.title}
                </div>
                <div style={{ fontSize: 11, color: theme.muted }}>{n.employee_name}</div>
              </div>
              <div style={{ fontSize: 11, color: theme.subtle, whiteSpace: 'nowrap', marginLeft: 8, flexShrink: 0 }}>{fmtDate(n.created_at)}</div>
            </button>
          ))
        )}
      </div>
    </>
  );
}

function NotifDetail({ n, onBack, fmtDate, onDelete, deleting, theme }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${theme.line}` }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: theme.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>← Voltar</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: theme.primary, textTransform: 'uppercase' }}>{TYPE_LABEL[n.type] || n.type}</span>
          <button onClick={(e) => onDelete(n, e)} disabled={deleting} style={{ background: 'none', border: 'none', color: theme.danger, fontSize: 14, cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>🗑</button>
        </div>
      </div>
      <div style={{ padding: '16px 16px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: theme.ink, marginBottom: 8, lineHeight: 1.4, letterSpacing: '-0.01em' }}>{n.title}</div>
        <div style={{ fontSize: 13, color: theme.muted, lineHeight: 1.6, marginBottom: 16 }}>{n.body}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 12, color: theme.muted }}><strong style={{ color: theme.ink }}>Funcionário:</strong> {n.employee_name}</div>
          <div style={{ fontSize: 12, color: theme.muted }}><strong style={{ color: theme.ink }}>Recebida:</strong> {fmtDate(n.created_at)}</div>
          <div style={{ fontSize: 12, color: theme.muted }}><strong style={{ color: theme.ink }}>Push enviado:</strong> {n.push_sent ? 'Sim' : 'Não'}</div>
        </div>
      </div>
    </div>
  );
}
