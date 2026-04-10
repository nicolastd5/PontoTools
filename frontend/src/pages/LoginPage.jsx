import { useState } from 'react';
import { useAuth }  from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useNavigate, Link } from 'react-router-dom';

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const { login }   = useAuth();
  const { error }   = useToast();
  const navigate    = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/dashboard');
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao fazer login. Tente novamente.';
      error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoIcon}>P</div>
          <h1 style={styles.title}>Ponto Eletrônico</h1>
          <p style={styles.subtitle}>Sistema de Registro de Ponto com GPS</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.email@empresa.com"
              required
              autoComplete="email"
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              style={styles.input}
            />
          </div>

          <button type="submit" disabled={loading} style={{
            ...styles.button,
            opacity: loading ? 0.7 : 1,
            cursor:  loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div style={styles.hints}>
          <p style={styles.hint}>Entre com seu email e senha cadastrados.</p>
          <Link to="/forgot-password" style={styles.forgotLink}>Esqueci minha senha</Link>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight:      '100vh',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    background:     'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
    padding:        16,
  },
  card: {
    background:   '#fff',
    borderRadius: 16,
    padding:      '40px 36px',
    width:        '100%',
    maxWidth:     400,
    boxShadow:    '0 20px 60px rgba(0,0,0,0.2)',
  },
  header: { textAlign: 'center', marginBottom: 32 },
  logoIcon: {
    width:          56, height: 56,
    background:     '#1d4ed8',
    borderRadius:   12,
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    color:          '#fff',
    fontSize:       28,
    fontWeight:     800,
    marginBottom:   12,
  },
  title:    { fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#64748b' },
  form:     { display: 'flex', flexDirection: 'column', gap: 20 },
  field:    { display: 'flex', flexDirection: 'column', gap: 6 },
  label:    { fontSize: 13, fontWeight: 600, color: '#374151' },
  input: {
    padding:      '10px 14px',
    border:       '1.5px solid #e2e8f0',
    borderRadius: 8,
    fontSize:     15,
    outline:      'none',
    transition:   'border-color 0.15s',
    color:        '#1e293b',
  },
  button: {
    padding:      '12px',
    background:   '#1d4ed8',
    color:        '#fff',
    border:       'none',
    borderRadius: 8,
    fontSize:     15,
    fontWeight:   600,
    marginTop:    4,
    transition:   'background 0.15s',
  },
  hints: {
    marginTop:      24,
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    gap:            8,
  },
  hint: {
    textAlign:  'center',
    fontSize:   12,
    color:      '#94a3b8',
    lineHeight: 1.6,
    margin:     0,
  },
  forgotLink: {
    fontSize:       13,
    color:          '#1d4ed8',
    textDecoration: 'none',
    fontWeight:     500,
  },
};
