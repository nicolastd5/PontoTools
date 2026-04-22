import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function ForgotPasswordPage() {
  const [email,     setEmail]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [sent,      setSent]      = useState(false);
  const [errorMsg,  setErrorMsg]  = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Erro ao enviar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoIcon}>P</div>
          <h1 style={styles.title}>Recuperar senha</h1>
          <p style={styles.subtitle}>Gerenciador de Serviços</p>
        </div>

        {sent ? (
          <div style={styles.successBox}>
            <div style={styles.successIcon}>✓</div>
            <p style={styles.successText}>
              Se o email <strong>{email}</strong> estiver cadastrado, você receberá as
              instruções de recuperação em breve. Verifique também a caixa de spam.
            </p>
            <Link to="/login" style={styles.backLink}>Voltar ao login</Link>
          </div>
        ) : (
          <>
            <p style={styles.description}>
              Informe seu email cadastrado e enviaremos um link para redefinir sua senha.
            </p>
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

              {errorMsg && <p style={styles.error}>{errorMsg}</p>}

              <button type="submit" disabled={loading} style={{
                ...styles.button,
                opacity: loading ? 0.7 : 1,
                cursor:  loading ? 'not-allowed' : 'pointer',
              }}>
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>
            </form>

            <div style={styles.footer}>
              <Link to="/login" style={styles.backLink}>← Voltar ao login</Link>
            </div>
          </>
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
  header:    { textAlign: 'center', marginBottom: 24 },
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
  title:       { fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
  subtitle:    { fontSize: 13, color: '#64748b' },
  description: { fontSize: 14, color: '#475569', lineHeight: 1.6, marginBottom: 24, textAlign: 'center' },
  form:        { display: 'flex', flexDirection: 'column', gap: 20 },
  field:       { display: 'flex', flexDirection: 'column', gap: 6 },
  label:       { fontSize: 13, fontWeight: 600, color: '#374151' },
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
  error: { fontSize: 13, color: '#dc2626', margin: 0 },
  footer:      { marginTop: 20, textAlign: 'center' },
  backLink:    { fontSize: 14, color: '#1d4ed8', textDecoration: 'none', fontWeight: 500 },
  successBox:  { textAlign: 'center' },
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
