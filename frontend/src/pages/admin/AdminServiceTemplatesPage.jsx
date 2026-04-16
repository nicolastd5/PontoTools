// frontend/src/pages/admin/AdminServiceTemplatesPage.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const EMPTY_FORM = {
  title: '',
  description: '',
  unit_id: '',
  assigned_employee_id: '',
  due_time: '',
  interval_days: '',
  start_date: '',
};

function useTemplates() {
  return useQuery({
    queryKey: ['service-templates'],
    queryFn: () => api.get('/service-templates').then((r) => r.data.templates),
  });
}

function useUnits() {
  return useQuery({
    queryKey: ['units'],
    queryFn: () => api.get('/units').then((r) => r.data.units),
  });
}

function useEmployeesByUnit(unitId) {
  return useQuery({
    queryKey: ['employees-by-unit', unitId],
    queryFn: () =>
      api.get('/employees').then((r) =>
        (r.data.employees || r.data).filter((e) => String(e.unit_id) === String(unitId))
      ),
    enabled: !!unitId,
  });
}

export default function AdminServiceTemplatesPage() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  const [modal, setModal] = useState(false);       // false | 'create' | template object
  const [form, setForm]   = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { data: templates = [], isLoading } = useTemplates();
  const { data: units = [] }                = useUnits();
  const { data: employees = [] }            = useEmployeesByUnit(form.unit_id);

  const isEditing = modal && modal !== 'create';

  const createMutation = useMutation({
    mutationFn: (body) => api.post('/service-templates', body),
    onSuccess: () => {
      queryClient.invalidateQueries(['service-templates']);
      success('Template criado com sucesso.');
      closeModal();
    },
    onError: (err) => error(err.response?.data?.error || 'Erro ao criar template.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => api.patch(`/service-templates/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries(['service-templates']);
      success('Template atualizado.');
      closeModal();
    },
    onError: (err) => error(err.response?.data?.error || 'Erro ao atualizar template.'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id) => api.patch(`/service-templates/${id}/toggle`),
    onSuccess: () => queryClient.invalidateQueries(['service-templates']),
    onError: () => error('Erro ao alterar status do template.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/service-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['service-templates']);
      success('Template removido.');
      setConfirmDelete(null);
    },
    onError: () => error('Erro ao remover template.'),
  });

  function openCreate() {
    setForm(EMPTY_FORM);
    setModal('create');
  }

  function openEdit(tpl) {
    setForm({
      title:                tpl.title,
      description:          tpl.description || '',
      unit_id:              String(tpl.unit_id),
      assigned_employee_id: tpl.assigned_employee_id ? String(tpl.assigned_employee_id) : '',
      due_time:             tpl.due_time?.slice(0, 5) || '',
      interval_days:        String(tpl.interval_days),
      start_date:           tpl.start_date?.slice(0, 10) || '',
    });
    setModal(tpl);
  }

  function closeModal() {
    setModal(false);
    setForm(EMPTY_FORM);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const body = {
      title:                form.title,
      description:          form.description || undefined,
      unit_id:              parseInt(form.unit_id, 10),
      assigned_employee_id: form.assigned_employee_id ? parseInt(form.assigned_employee_id, 10) : undefined,
      due_time:             form.due_time || undefined,
      interval_days:        parseInt(form.interval_days, 10),
      start_date:           form.start_date,
    };
    if (isEditing) {
      updateMutation.mutate({ id: modal.id, body });
    } else {
      createMutation.mutate(body);
    }
  }

  function fmtDate(dt) {
    if (!dt) return '—';
    return formatInTimeZone(new Date(dt), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm');
  }

  const isBusy = createMutation.isLoading || updateMutation.isLoading;

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>Templates de Serviço</h1>
        <button onClick={openCreate} style={s.primaryBtn}>+ Novo Template</button>
      </div>

      <div style={s.card}>
        {isLoading ? (
          <p style={s.empty}>Carregando...</p>
        ) : templates.length === 0 ? (
          <p style={s.empty}>Nenhum template cadastrado.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['Título', 'Posto', 'Responsável', 'Intervalo', 'Próximo disparo', 'Status', 'Ações'].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {templates.map((tpl) => (
                  <tr key={tpl.id} style={s.tr}>
                    <td style={s.td}>{tpl.title}</td>
                    <td style={s.td}>{tpl.unit_name} <span style={s.code}>{tpl.unit_code}</span></td>
                    <td style={s.td}>
                      {tpl.employee_name
                        ? tpl.employee_name
                        : <span style={s.badgeYellow}>A definir</span>}
                    </td>
                    <td style={s.td}>A cada {tpl.interval_days} dia(s)</td>
                    <td style={s.td}>{fmtDate(tpl.next_run_at)}</td>
                    <td style={s.td}>
                      <span style={tpl.active ? s.badgeGreen : s.badgeGray}>
                        {tpl.active ? 'Ativo' : 'Pausado'}
                      </span>
                    </td>
                    <td style={{ ...s.td, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => openEdit(tpl)} style={s.actionBtn}>Editar</button>
                      <button
                        onClick={() => toggleMutation.mutate(tpl.id)}
                        style={{ ...s.actionBtn, color: tpl.active ? '#d97706' : '#16a34a' }}
                      >
                        {tpl.active ? 'Pausar' : 'Ativar'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(tpl)}
                        style={{ ...s.actionBtn, color: '#dc2626' }}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal criar/editar */}
      {modal && (
        <div style={s.overlay} onClick={closeModal}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={s.modalTitle}>{isEditing ? 'Editar Template' : 'Novo Template'}</h2>
            <form onSubmit={handleSubmit} style={s.form}>
              <label style={s.label}>Título *</label>
              <input
                style={s.input}
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                required
              />

              <label style={s.label}>Descrição</label>
              <textarea
                style={{ ...s.input, height: 60, resize: 'vertical' }}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />

              <label style={s.label}>Posto *</label>
              <select
                style={s.input}
                value={form.unit_id}
                onChange={(e) => setForm((p) => ({ ...p, unit_id: e.target.value, assigned_employee_id: '' }))}
                required
              >
                <option value="">Selecione o posto</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                ))}
              </select>

              <label style={s.label}>Responsável</label>
              <select
                style={s.input}
                value={form.assigned_employee_id}
                onChange={(e) => setForm((p) => ({ ...p, assigned_employee_id: e.target.value }))}
                disabled={!form.unit_id}
              >
                <option value="">A definir / atribuir manualmente</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                ))}
              </select>

              <label style={s.label}>Data de início *</label>
              <input
                type="date"
                style={s.input}
                value={form.start_date}
                onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                required
              />

              <label style={s.label}>Horário limite (opcional)</label>
              <input
                type="time"
                style={s.input}
                value={form.due_time}
                onChange={(e) => setForm((p) => ({ ...p, due_time: e.target.value }))}
              />

              <label style={s.label}>Intervalo em dias *</label>
              <input
                type="number"
                min={1}
                style={s.input}
                value={form.interval_days}
                onChange={(e) => setForm((p) => ({ ...p, interval_days: e.target.value }))}
                required
              />

              <div style={s.modalActions}>
                <button type="button" onClick={closeModal} style={s.cancelBtn} disabled={isBusy}>Cancelar</button>
                <button type="submit" style={s.primaryBtn} disabled={isBusy}>
                  {isBusy ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmação de exclusão */}
      {confirmDelete && (
        <div style={s.overlay} onClick={() => setConfirmDelete(null)}>
          <div style={{ ...s.modal, maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={s.modalTitle}>Excluir template?</h2>
            <p style={{ fontSize: 14, color: '#374151', marginBottom: 20 }}>
              O template <strong>"{confirmDelete.title}"</strong> será removido. Os serviços já gerados não serão afetados.
            </p>
            <div style={s.modalActions}>
              <button onClick={() => setConfirmDelete(null)} style={s.cancelBtn}>Cancelar</button>
              <button
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
                style={{ ...s.primaryBtn, background: '#dc2626' }}
                disabled={deleteMutation.isLoading}
              >
                {deleteMutation.isLoading ? 'Removendo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  header:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  title:        { fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 },
  primaryBtn:   { background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  cancelBtn:    { background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  actionBtn:    { background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#1d4ed8', fontWeight: 600 },
  card:         { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 },
  empty:        { color: '#94a3b8', textAlign: 'center', padding: '32px 0' },
  table:        { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:           { textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap' },
  td:           { padding: '10px 12px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
  tr:           { transition: 'background 0.1s' },
  code:         { fontSize: 11, color: '#94a3b8', marginLeft: 4 },
  badgeYellow:  { background: '#fef9c3', color: '#854d0e', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 },
  badgeGreen:   { background: '#dcfce7', color: '#166534', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 },
  badgeGray:    { background: '#f1f5f9', color: '#64748b', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 },
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 },
  modal:        { background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' },
  modalTitle:   { fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 20, marginTop: 0 },
  form:         { display: 'flex', flexDirection: 'column', gap: 12 },
  label:        { fontSize: 13, fontWeight: 600, color: '#374151' },
  input:        { border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
};
