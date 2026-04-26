import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import LogoIcon from '../components/shared/LogoIcon';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const token          = searchParams.get('token') || '';

  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading,         setLoading]         = useState(false);
  const [errorMsg,        setErrorMsg]        = useState('');
  const [done,            setDone]            = useState(false);

  if (!token) {
    return (
      <div style={container}>
        <div style={card}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><LogoIcon size={52} /></div>
            <h1 style={titleStyle}>Link inválido</h1>
          </div>
          <p style={{ textAlign: 'center', color: '#ef4444', fontSize: 14 }}>O link de recuperação é inválido ou já foi usado.</p>
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <Link to="/forgot-password" style={linkStyle}>Solicitar novo link</Link>
          </div>
        </div>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    if (newPassword !== confirmPassword) { setErrorMsg('As senhas não coincidem.'); return; }
    if (newPassword.length < 6) { setErrorMsg('A senha deve ter pelo menos 6 caracteres.'); return; }
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
    <div style={container}>
      <div style={card}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><LogoIcon size={52} /></div>
          <h1 style={titleStyle}>Nova senha</h1>
          <p style={{ fontSize: 13, color: '#71717a', margin: 0 }}>Gerenciador de Serviços</p>
        </div>

        {done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, background: 'rgba(16,185,129,0.12)', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, marginBottom: 20 }}>
              Senha redefinida com sucesso! Você será redirecionado para o login em instantes...
            </p>
            <Link to="/login" style={linkStyle}>Ir para o login agora</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              { label: 'Nova senha', value: newPassword, onChange: setNewPassword, placeholder: '••••••••' },
              { label: 'Confirmar nova senha', value: confirmPassword, onChange: setConfirmPassword, placeholder: '••••••••' },
            ].map(({ label, value, onChange, placeholder }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
                <input type="password" value={value} onChange={(e) => onChange(e.target.value)}
                  placeholder={placeholder} required minLength={6} autoComplete="new-password"
                  style={{ padding: '10px 14px', border: '1.5px solid #e4e4e7', borderRadius: 8, fontSize: 15, outline: 'none', color: '#09090b' }}
                />
              </div>
            ))}

            {errorMsg && <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>{errorMsg}</p>}

            <button type="submit" disabled={loading} style={{ padding: '12px', background: '#09090b', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Salvando...' : 'Redefinir senha'}
            </button>

            <div style={{ textAlign: 'center' }}>
              <Link to="/login" style={linkStyle}>← Voltar ao login</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const container = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
  position: 'relative', overflow: 'hidden',
};
const card = {
  background: '#ffffff', borderRadius: 20, padding: '40px 36px 32px',
  width: '100%', maxWidth: 400, boxShadow: '0 24px 64px -12px rgba(0,0,0,0.22)', position: 'relative', zIndex: 1,
};
const titleStyle = { fontSize: 22, fontWeight: 700, color: '#09090b', margin: '0 0 6px', letterSpacing: '-0.03em' };
const linkStyle  = { fontSize: 14, color: '#4f46e5', textDecoration: 'none', fontWeight: 500 };
