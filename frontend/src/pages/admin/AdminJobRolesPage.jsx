import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

function useJobRoles() {
  return useQuery({
    queryKey: ['job-roles'],
    queryFn:  () => api.get('/job-roles').then((r) => r.data.jobRoles),
  });
}

const EMPTY_FORM = { name: '', description: '', has_break: true, max_photos: 1, require_location: true };

export default function AdminJobRolesPage() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();
  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);

  const { data: jobRoles = [], isLoading } = useJobRoles();

  const toggleActive = useMutation({
    mutationFn: ({ id, active }) => api.patch(`/job-roles/${id}/active`, { active }),
    onSuccess: () => { queryClient.invalidateQueries(['job-roles']); success('Status atualizado.'); },
    onError:   () => error('Erro ao alterar status.'),
  });

  const saveMutation = useMutation({
    mutationFn: (body) => editId
      ? api.put(`/job-roles/${editId}`, body)
      : api.post('/job-roles', body),
    onSuccess: () => {
      queryClient.invalidateQueries(['job-roles']);
      success(editId ? 'Cargo atualizado.' : 'Cargo criado.');
      closeModal();
    },
    onError: (err) => error(err.response?.data?.error || 'Erro ao salvar cargo.'),
  });

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setModal(true);
  }

  function openEdit(row) {
    setForm({ name: row.name, description: row.description || '', has_break: row.has_break, max_photos: row.max_photos ?? 1, require_location: row.require_location ?? true });
    setEditId(row.id);
    setModal(true);
  }

  function closeModal() {
    setModal(false);
    setForm(EMPTY_FORM);
    setEditId(null);
  }

  function handleSubmit(e) {
    e.preventDefault();
    saveMutation.mutate({ ...form, has_break: Boolean(form.has_break), require_location: Boolean(form.require_location) });
  }

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Cargos</h1>
        <button onClick={openCreate} style={styles.primaryBtn}>+ Novo Cargo</button>
      </div>

      <div style={styles.card}>
        {isLoading ? (
          <p style={{ padding: 24, color: '#64748b' }}>Carregando...</p>
        ) : jobRoles.length === 0 ? (
          <p style={{ padding: 24, color: '#64748b' }}>Nenhum cargo cadastrado.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                {['Cargo', 'Descrição', 'Intervalo', 'Localização', 'Fotos', 'Status', 'Ações'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobRoles.map((jr) => (
                <tr key={jr.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={styles.td}><strong style={{ color: '#0f172a' }}>{jr.name}</strong></td>
                  <td style={styles.td}><span style={{ color: '#64748b', fontSize: 13 }}>{jr.description || '—'}</span></td>
                  <td style={styles.td}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: jr.has_break ? '#dbeafe' : '#fef9c3',
                      color:      jr.has_break ? '#1e40af' : '#854d0e',
                    }}>
                      {jr.has_break ? 'Com intervalo' : 'Sem intervalo'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: jr.require_location !== false ? '#dcfce7' : '#fef9c3',
                      color:      jr.require_location !== false ? '#166534' : '#854d0e',
                    }}>
                      {jr.require_location !== false ? 'Exigida' : 'Livre'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={{ fontWeight: 600, color: jr.max_photos > 1 ? '#1d4ed8' : '#64748b' }}>
                      {jr.max_photos ?? 1} foto{(jr.max_photos ?? 1) > 1 ? 's' : ''}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: jr.active ? '#dcfce7' : '#f1f5f9',
                      color:      jr.active ? '#166534' : '#64748b',
                    }}>
                      {jr.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(jr)} style={actionBtn}>Editar</button>
                      <button
                        onClick={() => toggleActive.mutate({ id: jr.id, active: !jr.active })}
                        style={actionBtn}
                      >
                        {jr.active ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div style={overlay} onClick={closeModal}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={modalTitle}>{editId ? 'Editar Cargo' : 'Novo Cargo'}</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Nome do cargo *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                  placeholder="Ex: Supervisor, Operador, Caixa..."
                  style={inputStyle}
                  autoFocus
                />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Descrição</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Descrição opcional do cargo"
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Quantidade máxima de fotos por registro</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={form.max_photos}
                  onChange={(e) => setForm((p) => ({ ...p, max_photos: parseInt(e.target.value, 10) || 1 }))}
                  style={{ ...inputStyle, width: 80 }}
                />
                <span style={{ fontSize: 12, color: '#64748b' }}>Máximo 5 fotos por registro</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#f8fafc', borderRadius: 10, padding: '14px 16px', border: '1.5px solid #e2e8f0' }}>
                <input
                  type="checkbox"
                  id="has_break"
                  checked={form.has_break}
                  onChange={(e) => setForm((p) => ({ ...p, has_break: e.target.checked }))}
                  style={{ width: 18, height: 18, marginTop: 2, accentColor: '#1d4ed8', cursor: 'pointer' }}
                />
                <div>
                  <label htmlFor="has_break" style={{ ...labelStyle, cursor: 'pointer' }}>
                    Possui intervalo
                  </label>
                  <p style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                    {form.has_break
                      ? 'Funcionários deste cargo registram início e fim de intervalo.'
                      : 'Funcionários deste cargo não registram intervalo — apenas entrada e saída.'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#f8fafc', borderRadius: 10, padding: '14px 16px', border: '1.5px solid #e2e8f0' }}>
                <input
                  type="checkbox"
                  id="require_location"
                  checked={form.require_location}
                  onChange={(e) => setForm((p) => ({ ...p, require_location: e.target.checked }))}
                  style={{ width: 18, height: 18, marginTop: 2, accentColor: '#1d4ed8', cursor: 'pointer' }}
                />
                <div>
                  <label htmlFor="require_location" style={{ ...labelStyle, cursor: 'pointer' }}>
                    Exigir proximidade da unidade
                  </label>
                  <p style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                    {form.require_location
                      ? 'Funcionários só podem registrar ponto dentro do raio da unidade.'
                      : 'Funcionários podem registrar de qualquer lugar. A localização ainda é gravada.'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={closeModal} style={styles.outlineBtn}>Cancelar</button>
                <button
                  type="submit"
                  disabled={saveMutation.isLoading}
                  style={{ ...styles.primaryBtn, opacity: saveMutation.isLoading ? 0.7 : 1 }}
                >
                  {saveMutation.isLoading ? 'Salvando...' : editId ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const actionBtn = {
  padding: '4px 12px', fontSize: 12, cursor: 'pointer',
  border: '1px solid #e2e8f0', borderRadius: 6,
  background: '#f8fafc', color: '#374151',
};

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};

const modalCard = {
  background: '#fff', borderRadius: 12, padding: '32px 28px',
  width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
};

const modalTitle = { fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 20 };
const fieldStyle  = { display: 'flex', flexDirection: 'column', gap: 5 };
const labelStyle  = { fontSize: 13, fontWeight: 600, color: '#374151' };
const inputStyle  = { padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#1e293b', outline: 'none' };

const styles = {
  header:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title:      { fontSize: 22, fontWeight: 800, color: '#0f172a' },
  card:       { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' },
  th:         { padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  td:         { padding: '14px 16px', fontSize: 14, color: '#374151', verticalAlign: 'middle' },
  outlineBtn: { padding: '8px 16px', border: '1.5px solid #1d4ed8', borderRadius: 8, fontSize: 14, cursor: 'pointer', color: '#1d4ed8', background: '#fff', fontWeight: 600 },
  primaryBtn: { padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', color: '#fff', background: '#1d4ed8', fontWeight: 600 },
};
