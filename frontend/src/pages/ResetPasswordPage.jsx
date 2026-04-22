import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function ResetPasswordPage() {
  const [searchParams]              = useSearchParams();
  const navigate                    = useNavigate();
  const token                       = searchParams.get('token') || '';

  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading,         setLoading]         = useState(false);
  const [errorMsg,        setErrorMsg]        = useState('');
  const [done,            setDone]            = useState(false);

  if (!token) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.header}>
            <div style={styles.logoIcon}>P</div>
            <h1 style={styles.title}>Link inválido</h1>
          </div>
          <p style={{ textAlign: 'center', color: '#dc2626', fontSize: 14 }}>
            O link de recuperação é inválido ou já foi usado.
          </p>
          <div style={styles.footer}>
            <Link to="/forgot-password" style={styles.link}>Solicitar novo link</Link>
          </div>
        </div>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');

    if (newPassword !== confirmPassword) {
      setErrorMsg('As senhas não coincidem.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Erro ao redefinir. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoIcon}>P</div>
          <h1 style={styles.title}>Nova senha</h1>
          <p style={styles.subtitle}>Gerenciador de Serviços</p>
        </div>

        {done ? (
          <div style={styles.successBox}>
            <div style={styles.successIcon}>✓</div>
            <p style={styles.successText}>
              Senha redefinida com sucesso! Você será redirecionado para o login em instantes...
            </p>
            <Link to="/login" style={styles.link}>Ir para o login agora</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Nova senha</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete="new-password"
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Confirmar nova senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                style={styles.input}
              />
            </div>

            {errorMsg && <p style={styles.error}>{errorMsg}</p>}

            <button type="submit" disabled={loading} style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
              cursor:  loading ? 'not-allowed' : 'pointer',
            }}>
              {loading ? 'Salvando...' : 'Redefinir senha'}
            </button>

            <div style={styles.footer}>
              <Link to="/login" style={styles.link}>← Voltar ao login</Link>
            </div>
          </form>
        )}
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
  header:    { textAlign: 'center', marginBottom: 32 },
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
  title:    { fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
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
  },
  error:      { fontSize: 13, color: '#dc2626', margin: 0 },
  footer:     { textAlign: 'center' },
  link:       { fontSize: 14, color: '#1d4ed8', textDecoration: 'none', fontWeight: 500 },
  successBox: { textAlign: 'center' },
  successIcon: {
    width:          52, height: 52,
    background:     '#dcfce7',
    borderRadius:   '50%',
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontSize:       22,
    color:          '#16a34a',
    marginBottom:   16,
  },
  successText: { fontSize: 14, color: '#374151', lineHeight: 1.6, marginBottom: 20 },
};
