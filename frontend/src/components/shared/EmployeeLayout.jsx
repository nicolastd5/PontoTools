import { Outlet, NavLink }  from 'react-router-dom';
import { useQuery }         from '@tanstack/react-query';
import { useTheme }         from '../../contexts/ThemeContext';
import { Clock, List, Wrench, Bell, User } from 'lucide-react';
import api from '../../services/api';

export default function EmployeeLayout() {
  const { theme } = useTheme();

  const { data: notifData } = useQuery({
    queryKey: ['my-notifications'],
    queryFn:  () => api.get('/notifications').then((r) => r.data),
    refetchInterval: 30000,
  });
  const unreadCount = notifData?.unread ?? 0;

  const { data: todayData } = useQuery({
    queryKey:  ['clock-today'],
    queryFn:   () => api.get('/clock/today', {
      params: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    }).then((r) => r.data),
    staleTime: 60000,
  });
  const servicesOnly = todayData?.servicesOnly ?? false;

  const allTabs = [
    { to: '/dashboard',     label: 'Ponto',     Icon: Clock },
    { to: '/history',       label: 'Histórico', Icon: List },
    { to: '/services',      label: 'Serviços',  Icon: Wrench },
    { to: '/notifications', label: 'Avisos',    Icon: Bell, badge: unreadCount },
    { to: '/profile',       label: 'Perfil',    Icon: User },
  ];
  const tabs = servicesOnly
    ? allTabs.filter((t) => ['/services', '/notifications', '/profile'].includes(t.to))
    : allTabs;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: theme.bg, maxWidth: 480, margin: '0 auto' }}>
      <main style={{ flex: 1, padding: '20px 16px', paddingBottom: 80 }}>
        <Outlet />
      </main>

      <nav style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, display: 'flex', background: theme.surface, borderTop: `1px solid ${theme.border}`, boxShadow: '0 -4px 16px rgba(0,0,0,0.2)' }}>
        {tabs.map(({ to, label, Icon, badge }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            padding: '10px 0', textDecoration: 'none',
            color: isActive ? theme.accent : theme.textMuted,
          })}>
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <Icon size={20} strokeWidth={1.75} />
              {badge > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -6, background: theme.danger, color: '#fff', borderRadius: 10, fontSize: 9, fontWeight: 700, padding: '1px 4px', lineHeight: 1.4 }}>
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </span>
            <span style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
