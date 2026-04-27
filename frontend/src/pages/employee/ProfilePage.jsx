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
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: theme.subtle, textTransform: 'uppercase', marginBottom: 6 }}>Conta</p>
      <h1 style={{ fontSize: 30, fontWeight: 700, color: theme.ink, letterSpacing: '-0.03em', marginBottom: 28 }}>Meu Perfil</h1>

      {/* Avatar */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{
          width: 88, height: 88, borderRadius: 44,
          background: `linear-gradient(135deg, ${theme.primary}, ${theme.violet})`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, fontWeight: 700, color: '#fff', marginBottom: 14,
        }}>
          {initials}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: theme.ink, letterSpacing: '-0.02em', marginBottom: 4 }}>{user?.name}</div>
        <div style={{ fontSize: 14, color: theme.primary, fontWeight: 500 }}>{user?.jobRole?.name || 'Funcionário'}</div>
      </div>

      {/* Info */}
      <div style={{ background: theme.card, borderRadius: 16, border: `1px solid ${theme.line}`, overflow: 'hidden', marginBottom: 14 }}>
        {rows.map(({ key, val }, i) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: i < rows.length - 1 ? `1px solid ${theme.hairline}` : 'none' }}>
            <span style={{ fontSize: 13, color: theme.muted }}>{key}</span>
            <span style={{ fontSize: 14, color: theme.ink, fontWeight: 600 }}>{val || '—'}</span>
          </div>
        ))}
      </div>

      {/* Toggle tema */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: theme.card, borderRadius: 16, border: `1px solid ${theme.line}`, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: theme.ink }}>Tema escuro</div>
          <div style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>Aparência do aplicativo</div>
        </div>
        <button onClick={toggleTheme}
          style={{ width: 48, height: 28, borderRadius: 14, border: 'none', background: isDark ? theme.primary : theme.line, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', padding: 0, flexShrink: 0 }}>
          <span style={{ position: 'absolute', top: 4, width: 20, height: 20, borderRadius: 10, background: '#fff', transition: 'left 0.2s', left: isDark ? 24 : 4 }} />
        </button>
      </div>

      {/* Logout */}
      <button onClick={handleLogout}
        style={{ width: '100%', padding: 16, background: theme.dangerSoft, border: `1px solid ${theme.danger}44`, borderRadius: 16, color: theme.danger, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
        Sair da conta
      </button>
    </div>
  );
}
