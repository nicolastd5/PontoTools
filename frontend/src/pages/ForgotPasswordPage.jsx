import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import LogoIcon from '../components/shared/LogoIcon';

export default function ForgotPasswordPage() {
  const [email,    setEmail]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      <div style={{
        background: '#ffffff', borderRadius: 20, padding: '40px 36px 32px',
        width: '100%', maxWidth: 400, boxShadow: '0 24px 64px -12px rgba(0,0,0,0.22)',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <LogoIcon size={52} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#09090b', margin: '0 0 6px', letterSpacing: '-0.03em' }}>
            Recuperar senha
          </h1>
          <p style={{ fontSize: 13, color: '#71717a', margin: 0 }}>Gerenciador de Serviços</p>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, background: 'rgba(16,185,129,0.12)', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, marginBottom: 20 }}>
              Se o email <strong>{email}</strong> estiver cadastrado, você receberá as instruções em breve. Verifique também o spam.
            </p>
            <Link to="/login" style={{ fontSize: 14, color: '#4f46e5', textDecoration: 'none', fontWeight: 600 }}>Voltar ao login</Link>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 14, color: '#52525b', lineHeight: 1.6, marginBottom: 24, textAlign: 'center' }}>
              Informe seu email cadastrado e enviaremos um link para redefinir sua senha.
            </p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@empresa.com" required autoComplete="email"
                  style={{ padding: '10px 14px', border: '1.5px solid #e4e4e7', borderRadius: 8, fontSize: 15, outline: 'none', color: '#09090b' }}
                />
              </div>

              {errorMsg && <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>{errorMsg}</p>}

              <button type="submit" disabled={loading} style={{ padding: '12px', background: '#09090b', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>
            </form>

            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <Link to="/login" style={{ fontSize: 14, color: '#4f46e5', textDecoration: 'none', fontWeight: 500 }}>← Voltar ao login</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
