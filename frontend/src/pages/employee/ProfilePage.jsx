import { useCallback }  from 'react';
import { useAuth }     from '../../contexts/AuthContext';
import { useTheme }    from '../../contexts/ThemeContext';
import { useToast }    from '../../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import usePullToRefresh from '../../hooks/usePullToRefresh';
import PullToRefreshIndicator from '../../components/shared/PullToRefreshIndicator';

export default function ProfilePage() {
  const { user, logout }             = useAuth();
  const { isDark, theme, toggleTheme } = useTheme();
  const { success }                  = useToast();
  const navigate                     = useNavigate();

  async function handleLogout() {
    await logout();
    success('Até logo!');
    navigate('/login');
  }

  const handleRefresh = useCallback(() => {}, []);
  const { containerRef, pullY, refreshing: ptrRefreshing } = usePullToRefresh(handleRefresh);

  const initials = user?.name
    ? user.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : '?';

  const rows = [
    { key: 'Email',   val: user?.email },
    { key: 'Unidade', val: user?.unit?.name },
    { key: 'Cargo',   val: user?.jobRole?.name || '—' },
  ];

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <PullToRefreshIndicator pullY={pullY} refreshing={ptrRefreshing} />
      <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.textPrimary, marginBottom: 20 }}>Meu Perfil</h1>

      {/* Avatar */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 36,
          background: `linear-gradient(135deg, ${theme.primary}, ${theme.violet})`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 10,
        }}>
          {initials}
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: theme.textPrimary, marginBottom: 2 }}>{user?.name}</div>
        <div style={{ fontSize: 13, color: theme.primary, fontWeight: 500 }}>{user?.jobRole?.name || 'Funcionário'}</div>
      </div>

      {/* Info */}
      <div style={{ background: theme.surface, borderRadius: 12, border: `1px solid ${theme.border}`, overflow: 'hidden', marginBottom: 10 }}>
        {rows.map(({ key, val }, i) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: i < rows.length - 1 ? `1px solid ${theme.border}` : 'none' }}>
            <span style={{ fontSize: 13, color: theme.textSecondary }}>{key}</span>
            <span style={{ fontSize: 13, color: theme.textPrimary, fontWeight: 600 }}>{val || '—'}</span>
          </div>
        ))}
      </div>

      {/* Toggle tema */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: theme.surface, borderRadius: 12, border: `1px solid ${theme.border}`, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary }}>Tema escuro</div>
          <div style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>Aparência do aplicativo</div>
        </div>
        <button onClick={toggleTheme}
          style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: isDark ? theme.primary : theme.border, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', padding: 0, flexShrink: 0 }}>
          <span style={{ position: 'absolute', top: 3, width: 18, height: 18, borderRadius: 9, background: '#fff', transition: 'left 0.2s', left: isDark ? 23 : 3 }} />
        </button>
      </div>

      {/* Logout */}
      <button onClick={handleLogout}
        style={{ width: '100%', padding: 13, background: theme.dangerSoft, border: `1px solid ${theme.danger}44`, borderRadius: 12, color: theme.danger, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
        Sair da conta
      </button>
    </div>
  );
}
