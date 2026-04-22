import { useAuth }     from '../../contexts/AuthContext';
import { useTheme }    from '../../contexts/ThemeContext';
import { useToast }    from '../../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';

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

  const initials = user?.name
    ? user.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : '?';

  const rows = [
    { key: 'Email',   val: user?.email },
    { key: 'Unidade', val: user?.unit?.name },
    { key: 'Cargo',   val: user?.jobRole?.name || '—' },
  ];

  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: theme.accent, textTransform: 'uppercase', marginBottom: 2 }}>Conta</p>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: theme.textPrimary, marginBottom: 24 }}>Meu Perfil</h1>

      {/* Avatar */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ width: 72, height: 72, borderRadius: 36, background: theme.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 10 }}>
          {initials}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: theme.textPrimary, marginBottom: 2 }}>{user?.name}</div>
        <div style={{ fontSize: 12, color: theme.accent }}>{user?.jobRole?.name || 'Funcionário'}</div>
      </div>

      {/* Info */}
      <div style={{ background: theme.surface, borderRadius: 14, border: `1px solid ${theme.border}`, overflow: 'hidden', marginBottom: 16 }}>
        {rows.map(({ key, val }, i) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: i < rows.length - 1 ? `1px solid ${theme.border}` : 'none' }}>
            <span style={{ fontSize: 12, color: theme.textSecondary }}>{key}</span>
            <span style={{ fontSize: 13, color: theme.textPrimary, fontWeight: 600 }}>{val || '—'}</span>
          </div>
        ))}
      </div>

      {/* Toggle tema */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: theme.surface, borderRadius: 14, border: `1px solid ${theme.border}`, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary }}>Tema escuro</div>
          <div style={{ fontSize: 11, color: theme.textSecondary }}>Aparência do aplicativo</div>
        </div>
        <button onClick={toggleTheme}
          style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: isDark ? theme.accent : theme.elevated, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', padding: 0 }}>
          <span style={{ position: 'absolute', top: 3, width: 18, height: 18, borderRadius: 9, background: '#fff', transition: 'left 0.2s', left: isDark ? 23 : 3 }} />
        </button>
      </div>

      {/* Logout */}
      <button onClick={handleLogout}
        style={{ width: '100%', padding: 13, background: theme.danger + '18', border: `1px solid ${theme.danger}44`, borderRadius: 12, color: theme.danger, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        Sair da conta
      </button>
    </div>
  );
}
