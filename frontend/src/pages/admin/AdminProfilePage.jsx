import { useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

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

export default function AdminProfilePage() {
  const { user, logout } = useAuth();
  const { success, error } = useToast();

  const [form, setForm] = useState({
    email:           user?.email || '',
    currentPassword: '',
    newPassword:     '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      error('A nova senha e a confirmação não coincidem.');
      return;
    }
    setLoading(true);
    try {
      const body = { currentPassword: form.currentPassword };
      if (form.email !== user?.email) body.email = form.email;
      if (form.newPassword) body.newPassword = form.newPassword;
      await api.put('/auth/profile', body);
      success('Perfil atualizado! Faça login novamente.');
      setTimeout(() => logout(), 1500);
    } catch (err) {
      error(err.response?.data?.error || 'Erro ao atualizar perfil.');
    } finally {
      setLoading(false);
    }
  }

  const gradient = avatarGradient(user?.name || '');
  const initial  = (user?.name || '?')[0].toUpperCase();

  return (
    <div style={{ maxWidth: 520 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-ink)', margin: '0 0 4px', letterSpacing: '-0.03em' }}>Meu Perfil</h1>
      <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 24 }}>Altere seu email ou senha de acesso.</p>

      <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--color-line)', overflow: 'hidden' }}>
        {/* Avatar header */}
        <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid var(--color-hairline)', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, background: gradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 800, color: '#fff', flexShrink: 0,
            letterSpacing: '-0.02em',
          }}>
            {initial}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-ink)', letterSpacing: '-0.02em' }}>{user?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
              {user?.role === 'admin' ? 'Administrador Master' : 'Gestor'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-subtle)', marginTop: 1, fontFamily: 'var(--font-mono)' }}>{user?.email}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '24px' }}>
          <Field label="Email">
            <input type="email" value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              style={inputStyle} required />
          </Field>

          <div style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>Trocar senha</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Senha atual *">
                <input type="password" value={form.currentPassword}
                  onChange={(e) => setForm((p) => ({ ...p, currentPassword: e.target.value }))}
                  placeholder="Obrigatório para qualquer alteração"
                  style={inputStyle} required />
              </Field>

              <Field label="Nova senha">
                <input type="password" value={form.newPassword}
                  onChange={(e) => setForm((p) => ({ ...p, newPassword: e.target.value }))}
                  placeholder="Deixe em branco para não alterar"
                  style={inputStyle}
                  minLength={form.newPassword ? 6 : undefined} />
              </Field>

              {form.newPassword && (
                <Field label="Confirmar nova senha">
                  <input type="password" value={form.confirmPassword}
                    onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                    placeholder="Repita a nova senha"
                    style={inputStyle} required />
                </Field>
              )}
            </div>
          </div>

          <button type="submit" disabled={loading} style={{ ...inkBtn, opacity: loading ? 0.7 : 1, marginTop: 4 }}>
            {loading ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = { padding: '10px 12px', border: '1.5px solid var(--color-line)', borderRadius: 8, fontSize: 14, color: 'var(--color-ink)', outline: 'none', background: 'var(--bg-card)' };
const inkBtn     = { padding: '11px 20px', background: 'var(--color-ink)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' };
