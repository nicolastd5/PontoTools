import { useAuth }     from '../../contexts/AuthContext';
import { useTheme }    from '../../contexts/ThemeContext';
import { useToast }    from '../../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#4f46e5,#7c3aed)',
  'linear-gradient(135deg,#0ea5e9,#6366f1)',
  'linear-gradient(135deg,#10b981,#0ea5e9)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#8b5cf6,#ec4899)',
];

function avatarGradient(name = '') {
  const n = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[n % 5];
}

export default function ProfilePage() {
  const { user, logout }         = useAuth();
  const { isDark, toggleTheme }  = useTheme();
  const { success }              = useToast();
  const navigate                 = useNavigate();

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

  const gradient = avatarGradient(user?.name || '');

  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 2 }}>Conta</p>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-ink)', marginBottom: 24, letterSpacing: '-0.03em' }}>Meu Perfil</h1>

      {/* Avatar */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: gradient, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 10 }}>
          {initials}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-ink)', marginBottom: 2, letterSpacing: '-0.03em' }}>{user?.name}</div>
        <div style={{ fontSize: 12, color: 'var(--color-primary)' }}>{user?.jobRole?.name || 'Funcionário'}</div>
      </div>

      {/* Info card */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--color-line)', overflow: 'hidden', marginBottom: 14 }}>
        {rows.map(({ key, val }, i) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: i < rows.length - 1 ? '1px solid var(--color-hairline)' : 'none' }}>
            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{key}</span>
            <span style={{ fontSize: 13, color: 'var(--color-ink)', fontWeight: 600 }}>{val || '—'}</span>
          </div>
        ))}
      </div>

      {/* Dark mode toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px', background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--color-line)', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>Tema escuro</div>
          <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 1 }}>Aparência do aplicativo</div>
        </div>
        <button onClick={toggleTheme}
          style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: isDark ? 'var(--color-primary)' : 'var(--color-line)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', padding: 0, flexShrink: 0 }}>
          <span style={{ position: 'absolute', top: 3, width: 18, height: 18, borderRadius: 9, background: '#fff', transition: 'left 0.2s', left: isDark ? 23 : 3 }} />
        </button>
      </div>

      {/* Logout */}
      <button onClick={handleLogout}
        style={{ width: '100%', padding: 13, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, color: 'var(--color-danger)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        Sair da conta
      </button>
    </div>
  );
}
