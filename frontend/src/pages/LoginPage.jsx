import { useState } from 'react';
import { useAuth }     from '../contexts/AuthContext';
import { useToast }    from '../contexts/ToastContext';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme }    from '../contexts/ThemeContext';

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const { login }  = useAuth();
  const { error }  = useToast();
  const navigate   = useNavigate();
  const { theme }  = useTheme();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/dashboard');
    } catch (err) {
      error(err.response?.data?.error || 'Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const s = {
    root:     { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.bg, padding: 16 },
    inner:    { width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center' },
    logo:     { width: 56, height: 56, background: theme.accent, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: '#fff', marginBottom: 16 },
    title:    { fontSize: 24, fontWeight: 800, color: theme.textPrimary, marginBottom: 4 },
    subtitle: { fontSize: 13, color: theme.textSecondary, marginBottom: 32 },
    form:     { width: '100%', display: 'flex', flexDirection: 'column', gap: 12 },
    input:    { padding: '13px 14px', background: theme.elevated, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 14, color: theme.textPrimary, outline: 'none' },
    btn:      { padding: 14, background: theme.accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, marginTop: 4 },
    forgot:   { marginTop: 20, color: theme.accent, fontSize: 13, textDecoration: 'none', fontWeight: 500 },
  };

  return (
    <div style={s.root}>
      <div style={s.inner}>
        <div style={s.logo}>P</div>
        <h1 style={s.title}>Gerenciador de Serviços</h1>
        <p style={s.subtitle}>Entre com sua conta</p>
        <form onSubmit={handleSubmit} style={s.form}>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="funcionario@empresa.com" required autoComplete="email"
            style={s.input}
          />
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••" required autoComplete="current-password"
            style={s.input}
          />
          <button type="submit" disabled={loading}
            style={{ ...s.btn, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Entrando...' : 'Entrar →'}
          </button>
        </form>
        <Link to="/forgot-password" style={s.forgot}>Esqueceu a senha?</Link>
      </div>
    </div>
  );
}
