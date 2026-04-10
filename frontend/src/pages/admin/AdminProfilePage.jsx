import { useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

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

      // Força novo login pois email/senha pode ter mudado
      setTimeout(() => logout(), 1500);
    } catch (err) {
      error(err.response?.data?.error || 'Erro ao atualizar perfil.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Meu Perfil</h1>
      <p style={styles.subtitle}>Altere seu email ou senha de acesso.</p>

      <div style={styles.card}>
        <div style={styles.avatarRow}>
          <div style={styles.avatar}>{user?.name?.[0]?.toUpperCase()}</div>
          <div>
            <div style={styles.name}>{user?.name}</div>
            <div style={styles.role}>
              {user?.role === 'admin' ? 'Administrador Master' : 'Gestor'}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              style={inputStyle}
              required
            />
          </div>

          <hr style={styles.divider} />

          <p style={styles.sectionLabel}>Trocar senha</p>

          <div style={fieldStyle}>
            <label style={labelStyle}>Senha atual *</label>
            <input
              type="password"
              value={form.currentPassword}
              onChange={(e) => setForm((p) => ({ ...p, currentPassword: e.target.value }))}
              placeholder="Obrigatório para qualquer alteração"
              style={inputStyle}
              required
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Nova senha</label>
            <input
              type="password"
              value={form.newPassword}
              onChange={(e) => setForm((p) => ({ ...p, newPassword: e.target.value }))}
              placeholder="Deixe em branco para não alterar"
              style={inputStyle}
              minLength={form.newPassword ? 6 : undefined}
            />
          </div>

          {form.newPassword && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Confirmar nova senha</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                placeholder="Repita a nova senha"
                style={inputStyle}
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </form>
      </div>
    </div>
  );
}

const fieldStyle = { display: 'flex', flexDirection: 'column', gap: 5 };
const labelStyle = { fontSize: 13, fontWeight: 600, color: '#374151' };
const inputStyle = {
  padding: '10px 12px', border: '1.5px solid #e2e8f0',
  borderRadius: 8, fontSize: 14, color: '#1e293b', outline: 'none',
};

const styles = {
  page:     { maxWidth: 520 },
  title:    { fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 24 },
  card: {
    background: '#fff', borderRadius: 12,
    border: '1px solid #e2e8f0', padding: '28px 24px',
  },
  avatarRow: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 },
  avatar: {
    width: 52, height: 52, borderRadius: '50%',
    background: '#1d4ed8', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 22, fontWeight: 800,
  },
  name:    { fontSize: 16, fontWeight: 700, color: '#0f172a' },
  role:    { fontSize: 12, color: '#64748b', marginTop: 2 },
  form:    { display: 'flex', flexDirection: 'column', gap: 16 },
  divider: { border: 'none', borderTop: '1px solid #f1f5f9', margin: '4px 0' },
  sectionLabel: { fontSize: 13, fontWeight: 700, color: '#64748b', margin: 0 },
  btn: {
    padding: '11px', background: '#1d4ed8', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 15,
    fontWeight: 600, cursor: 'pointer', marginTop: 4,
  },
};
