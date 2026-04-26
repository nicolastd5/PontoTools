import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

function Icon({ d, size = 16, color = 'currentColor', strokeWidth = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const ICON_PLUS  = 'M12 5v14M5 12h14';
const ICON_CLOSE = 'M18 6 6 18M6 6l12 12';

function useJobRoles() {
  return useQuery({
    queryKey: ['job-roles'],
    queryFn:  () => api.get('/job-roles').then((r) => r.data.jobRoles),
  });
}

const EMPTY_FORM = { name: '', description: '', has_break: true, max_photos: 1, require_location: true, services_only: false };

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
    mutationFn: (body) => editId ? api.put(`/job-roles/${editId}`, body) : api.post('/job-roles', body),
    onSuccess: () => { queryClient.invalidateQueries(['job-roles']); success(editId ? 'Cargo atualizado.' : 'Cargo criado.'); closeModal(); },
    onError: (err) => error(err.response?.data?.error || 'Erro ao salvar cargo.'),
  });

  function openCreate() { setForm(EMPTY_FORM); setEditId(null); setModal(true); }
  function openEdit(row) {
    setForm({ name: row.name, description: row.description || '', has_break: row.has_break, max_photos: row.max_photos ?? 1, require_location: row.require_location ?? true, services_only: row.services_only ?? false });
    setEditId(row.id); setModal(true);
  }
  function closeModal() { setModal(false); setForm(EMPTY_FORM); setEditId(null); }

  function handleSubmit(e) {
    e.preventDefault();
    saveMutation.mutate({ ...form, has_break: Boolean(form.has_break), require_location: Boolean(form.require_location), services_only: Boolean(form.services_only) });
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-ink)', margin: 0, letterSpacing: '-0.03em' }}>Cargos</h1>
        <button onClick={openCreate} style={inkBtn}>
          <Icon d={ICON_PLUS} size={14} color="#fff" strokeWidth={2.5} /> Novo Cargo
        </button>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--color-line)', overflow: 'hidden' }}>
        {isLoading ? (
          <p style={{ padding: 24, color: 'var(--color-muted)' }}>Carregando...</p>
        ) : jobRoles.length === 0 ? (
          <p style={{ padding: 24, color: 'var(--color-muted)' }}>Nenhum cargo cadastrado.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-hairline)' }}>
                {['Cargo', 'Descrição', 'Módulo', 'Intervalo', 'Localização', 'Fotos', 'Status', 'Ações'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobRoles.map((jr) => (
                <tr key={jr.id} style={{ borderBottom: '1px solid var(--color-hairline)' }}>
                  <td style={td}><strong style={{ color: 'var(--color-ink)', fontSize: 13 }}>{jr.name}</strong></td>
                  <td style={td}><span style={{ color: 'var(--color-muted)', fontSize: 12 }}>{jr.description || '—'}</span></td>
                  <td style={td}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                      background: jr.services_only ? 'rgba(124,58,237,0.1)' : 'rgba(14,165,233,0.1)',
                      color:      jr.services_only ? '#7c3aed' : '#0369a1',
                    }}>
                      {jr.services_only ? 'Só Serviços' : 'Ponto + Serviços'}
                    </span>
                  </td>
                  <td style={td}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                      background: jr.has_break ? 'rgba(79,70,229,0.1)' : 'rgba(245,158,11,0.1)',
                      color:      jr.has_break ? 'var(--color-primary)' : '#b45309',
                    }}>
                      {jr.has_break ? 'Com intervalo' : 'Sem intervalo'}
                    </span>
                  </td>
                  <td style={td}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                      background: jr.require_location !== false ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                      color:      jr.require_location !== false ? '#059669' : '#b45309',
                    }}>
                      {jr.require_location !== false ? 'Exigida' : 'Livre'}
                    </span>
                  </td>
                  <td style={td}>
                    <span style={{ fontWeight: 700, color: jr.max_photos > 1 ? 'var(--color-primary)' : 'var(--color-muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                      {jr.max_photos ?? 1} foto{(jr.max_photos ?? 1) > 1 ? 's' : ''}
                    </span>
                  </td>
                  <td style={td}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                      background: jr.active ? 'rgba(16,185,129,0.1)' : 'var(--color-hairline)',
                      color:      jr.active ? '#059669' : 'var(--color-muted)',
                    }}>
                      {jr.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(jr)} style={actionBtn}>Editar</button>
                      <button onClick={() => toggleActive.mutate({ id: jr.id, active: !jr.active })} style={{ ...actionBtn, color: jr.active ? 'var(--color-warn)' : '#059669' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-ink)', margin: 0, letterSpacing: '-0.03em' }}>
                {editId ? 'Editar Cargo' : 'Novo Cargo'}
              </h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                <Icon d={ICON_CLOSE} size={16} color="var(--color-muted)" />
              </button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Nome do cargo *">
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required placeholder="Ex: Supervisor, Operador, Caixa..." style={inputStyle} autoFocus />
              </Field>

              <Field label="Descrição">
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Descrição opcional do cargo" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </Field>

              <Field label="Máximo de fotos por registro">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="number" min={1} max={5} value={form.max_photos}
                    onChange={(e) => setForm((p) => ({ ...p, max_photos: parseInt(e.target.value, 10) || 1 }))}
                    style={{ ...inputStyle, width: 80 }} />
                  <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Máximo 5 fotos por registro</span>
                </div>
              </Field>

              <CheckOption
                id="has_break"
                checked={form.has_break}
                onChange={(v) => setForm((p) => ({ ...p, has_break: v }))}
                label="Possui intervalo"
                description={form.has_break
                  ? 'Funcionários deste cargo registram início e fim de intervalo.'
                  : 'Funcionários deste cargo não registram intervalo — apenas entrada e saída.'}
              />

              <CheckOption
                id="require_location"
                checked={form.require_location}
                onChange={(v) => setForm((p) => ({ ...p, require_location: v }))}
                label="Exigir proximidade da unidade"
                description={form.require_location
                  ? 'Funcionários só podem registrar ponto dentro do raio da unidade.'
                  : 'Funcionários podem registrar de qualquer lugar. A localização ainda é gravada.'}
              />

              <CheckOption
                id="services_only"
                checked={form.services_only}
                onChange={(v) => setForm((p) => ({ ...p, services_only: v }))}
                label="Apenas Serviços (ocultar Ponto Eletrônico)"
                description={form.services_only
                  ? 'Funcionários deste cargo vão direto para a tela de Serviços — sem tela de ponto.'
                  : 'Funcionários deste cargo usam Ponto Eletrônico e Serviços normalmente.'}
                accent="rgba(124,58,237,0.12)"
                accentBorder="rgba(124,58,237,0.3)"
                accentColor="#7c3aed"
              />

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={closeModal} style={outlineBtn}>Cancelar</button>
                <button type="submit" disabled={saveMutation.isLoading} style={{ ...inkBtn, opacity: saveMutation.isLoading ? 0.7 : 1 }}>
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

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      {children}
    </div>
  );
}

function CheckOption({ id, checked, onChange, label, description, accent = 'var(--color-hairline)', accentBorder = 'var(--color-line)', accentColor = 'var(--color-primary)' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: accent, borderRadius: 10, padding: '12px 14px', border: `1.5px solid ${accentBorder}` }}>
      <input type="checkbox" id={id} checked={checked} onChange={(e) => onChange(e.target.checked)}
        style={{ width: 17, height: 17, marginTop: 2, accentColor: accentColor, cursor: 'pointer', flexShrink: 0 }} />
      <div>
        <label htmlFor={id} style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)', cursor: 'pointer', display: 'block' }}>{label}</label>
        <p style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 3, marginBottom: 0 }}>{description}</p>
      </div>
    </div>
  );
}

const overlay    = { position: 'fixed', inset: 0, background: 'rgba(9,9,11,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 };
const modalCard  = { background: 'var(--bg-card)', borderRadius: 16, padding: '28px 24px', width: '100%', maxWidth: 480, boxShadow: '0 24px 64px -12px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' };
const inputStyle = { padding: '9px 12px', border: '1.5px solid var(--color-line)', borderRadius: 8, fontSize: 14, color: 'var(--color-ink)', outline: 'none', background: 'var(--bg-card)' };
const inkBtn     = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', background: 'var(--color-ink)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const outlineBtn = { display: 'inline-flex', alignItems: 'center', padding: '8px 16px', border: '1.5px solid var(--color-line)', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: 'var(--color-ink)', background: 'var(--bg-card)', fontWeight: 600 };
const td         = { padding: '13px 16px', fontSize: 13, color: 'var(--color-ink)', verticalAlign: 'middle' };
const actionBtn  = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 11px', fontSize: 12, cursor: 'pointer', border: '1px solid var(--color-line)', borderRadius: 6, background: 'var(--color-hairline)', color: 'var(--color-muted)', fontWeight: 600 };
