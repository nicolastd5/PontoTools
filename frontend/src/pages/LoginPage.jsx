import { useState } from 'react';
import { useAuth }     from '../contexts/AuthContext';
import { useToast }    from '../contexts/ToastContext';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme }    from '../contexts/ThemeContext';
import LogoIcon        from '../components/shared/LogoIcon';

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [pwFocus,  setPwFocus]  = useState(false);
  const [emFocus,  setEmFocus]  = useState(false);

  const { login }         = useAuth();
  const { error }         = useToast();
  const navigate          = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'admin' || user.role === 'gestor' ? '/admin/dashboard' : '/dashboard');
    } catch (err) {
      error(err.response?.data?.error || 'Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const focusStyle = {
    borderColor: 'var(--color-primary)',
    boxShadow: '0 0 0 3px rgba(79,70,229,0.12)',
    outline: 'none',
  };

  return (
    <div style={s.root}>
      {/* Grid de pontos decorativos */}
      <div style={s.gridDots} aria-hidden="true" />
      {/* Radial glows */}
      <div style={s.glowTop}    aria-hidden="true" />
      <div style={s.glowBottom} aria-hidden="true" />

      {/* Card */}
      <div style={s.card}>
        {/* Logo */}
        <div style={s.logoWrap}>
          <LogoIcon size={52} radius={14} />
        </div>

        <h1 style={s.title}>Bem-vindo</h1>
        <p style={s.subtitle}>Entre na sua conta PontoTools</p>

        <form onSubmit={handleSubmit} style={s.form}>
          {/* Email */}
          <div style={s.fieldWrap}>
            <label style={s.label} htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setEmFocus(true)}
              onBlur={() => setEmFocus(false)}
              placeholder="funcionario@empresa.com"
              required
              autoComplete="email"
              style={{ ...s.input, ...(emFocus ? focusStyle : {}) }}
            />
          </div>

          {/* Senha */}
          <div style={s.fieldWrap}>
            <div style={s.labelRow}>
              <label style={s.label} htmlFor="password">Senha</label>
              <Link to="/forgot-password" style={s.forgotLink} tabIndex={-1}>
                Esqueceu?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setPwFocus(true)}
              onBlur={() => setPwFocus(false)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              style={{ ...s.input, ...(pwFocus ? focusStyle : {}) }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ ...s.btn, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Entrando...' : 'Entrar →'}
          </button>
        </form>

        {/* Hint */}
        <div style={s.hint}>
          <span style={{ fontSize: 11, color: 'var(--color-subtle)' }}>
            Use as credenciais fornecidas pelo administrador do sistema.
          </span>
        </div>

        {/* Dark mode toggle */}
        <button onClick={toggleTheme} style={s.themeBtn}>
          {isDark ? '☀️ Modo claro' : '🌙 Modo escuro'}
        </button>
      </div>
    </div>
  );
}

const s = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },

  /* Grid de pontos via radial-gradient */
  gridDots: {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    backgroundImage: 'radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)',
    backgroundSize: '24px 24px',
  },

  glowTop: {
    position: 'absolute', top: -120, right: -80,
    width: 400, height: 400, borderRadius: '50%', pointerEvents: 'none',
    background: 'radial-gradient(circle, rgba(129,140,248,0.35) 0%, transparent 70%)',
  },
  glowBottom: {
    position: 'absolute', bottom: -120, left: -80,
    width: 360, height: 360, borderRadius: '50%', pointerEvents: 'none',
    background: 'radial-gradient(circle, rgba(99,102,241,0.30) 0%, transparent 70%)',
  },

  card: {
    position: 'relative', zIndex: 1,
    width: '100%', maxWidth: 400,
    background: '#fff',
    borderRadius: 20,
    border: '1px solid #e4e4e7',
    boxShadow: '0 24px 64px -12px rgba(0,0,0,0.22)',
    padding: '40px 36px 32px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },

  logoWrap: { marginBottom: 20 },
  title:    { fontSize: 22, fontWeight: 700, color: '#09090b', marginBottom: 6, letterSpacing: '-0.03em', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#71717a', marginBottom: 28, textAlign: 'center' },

  form:     { width: '100%', display: 'flex', flexDirection: 'column', gap: 14 },

  fieldWrap: { display: 'flex', flexDirection: 'column', gap: 5 },
  labelRow:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  label: {
    fontSize: 12, fontWeight: 500, color: '#71717a',
    letterSpacing: '0.01em',
  },
  forgotLink: {
    fontSize: 12, fontWeight: 500, color: 'var(--color-primary)',
    textDecoration: 'none',
  },
  input: {
    padding: '11px 13px',
    background: '#fafafa',
    border: '1px solid #e4e4e7',
    borderRadius: 8,
    fontSize: 14,
    color: '#09090b',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    width: '100%',
  },

  btn: {
    marginTop: 4,
    padding: '13px',
    background: '#09090b',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    letterSpacing: '-0.01em',
    transition: 'opacity 0.15s',
    width: '100%',
  },

  hint: {
    marginTop: 18,
    padding: '10px 14px',
    background: '#f4f4f5',
    borderRadius: 8,
    width: '100%',
    textAlign: 'center',
  },

  themeBtn: {
    marginTop: 16,
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 500, color: '#a1a1aa',
    padding: '4px 8px', borderRadius: 6,
    transition: 'color 0.15s',
    fontFamily: 'var(--font-sans)',
  },
};
