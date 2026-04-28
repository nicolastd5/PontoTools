import { useState } from 'react';
import { useAuth }     from '../contexts/AuthContext';
import { useToast }    from '../contexts/ToastContext';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme }    from '../contexts/ThemeContext';
import Icon  from '../components/shared/Icon';
import Logo  from '../components/shared/Logo';

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [focus,    setFocus]    = useState(null);
  const { login }               = useAuth();
  const { error }               = useToast();
  const navigate                = useNavigate();
  const { theme, isDark, toggleTheme } = useTheme();

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

  function inp(n) {
    return {
      padding: '12px 14px',
      border: `1px solid ${focus === n ? theme.primary : theme.line}`,
      borderRadius: 10, fontSize: 14, outline: 'none',
      color: theme.ink, width: '100%', transition: 'all 0.15s',
      background: theme.card,
      boxShadow: focus === n ? `0 0 0 3px ${theme.primary}20` : 'none',
    };
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: theme.night,
      padding: 16, position: 'relative', overflow: 'hidden',
    }}>
      {/* Gradientes decorativos */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(circle at 20% 30%, ${theme.primary}22, transparent 50%),
                     radial-gradient(circle at 80% 70%, ${theme.violet}18, transparent 50%)`,
      }}/>
      {/* Dot grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
        backgroundSize: '32px 32px',
      }}/>

      <div style={{
        background: theme.card, borderRadius: 20, padding: '40px 36px',
        width: '100%', maxWidth: 400, position: 'relative',
        border: `1px solid ${theme.line}`,
        boxShadow: '0 20px 50px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.04)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex' }}>
            <Logo size={52} theme={theme}/>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: theme.ink, margin: '16px 0 4px', letterSpacing: '-0.02em' }}>Bem-vindo</h1>
          <p style={{ fontSize: 14, color: theme.muted }}>Gerenciador de Serviços</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: theme.muted, display: 'block', marginBottom: 6, letterSpacing: '-0.01em' }}>Email</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@empresa.com" required autoComplete="email"
              style={inp('email')}
              onFocus={() => setFocus('email')}
              onBlur={() => setFocus(null)}
            />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: theme.muted, letterSpacing: '-0.01em' }}>Senha</label>
              <Link to="/forgot-password" style={{ fontSize: 12, color: theme.primary, textDecoration: 'none', fontWeight: 500 }}>Esqueceu?</Link>
            </div>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" required autoComplete="current-password"
              style={inp('pwd')}
              onFocus={() => setFocus('pwd')}
              onBlur={() => setFocus(null)}
            />
          </div>

          <button type="submit" disabled={loading} style={{
            padding: 12, background: theme.primary, color: '#fff',
            border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1, transition: 'all 0.15s', marginTop: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {loading ? 'Entrando...' : <><span>Entrar</span><Icon name="arrow" size={16} color="#fff"/></>}
          </button>
        </form>

        <button onClick={toggleTheme} style={{
          marginTop: 16, width: '100%', padding: '8px',
          background: 'none', border: `1px solid ${theme.line}`,
          borderRadius: 8, fontSize: 12, color: theme.muted, cursor: 'pointer',
        }}>
          {isDark ? '☀️ Mudar para modo claro' : '🌙 Mudar para modo escuro'}
        </button>
      </div>
    </div>
  );
}
