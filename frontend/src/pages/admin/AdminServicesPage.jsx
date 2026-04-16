import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import ServiceStatusBadge from '../../components/shared/ServiceStatusBadge';

const STATUS_LABEL = {
  pending:          'Pendente',
  in_progress:      'Em andamento',
  done:             'Concluído',
  done_with_issues: 'Concluído c/ ressalvas',
  problem:          'Problema',
};
function useServices(filters) {
  return useQuery({
    queryKey: ['admin-services', filters],
    queryFn:  () => api.get('/services', { params: filters }).then((r) => r.data.services),
    keepPreviousData: true,
  });
}
function useEmployees() {
  return useQuery({
    queryKey: ['employees-active'],
    queryFn:  () => api.get('/employees').then((r) => r.data.employees || r.data),
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

const EMPTY_FORM = { title: '', description: '', assigned_employee_id: '', scheduled_date: '', due_time: '' };

export default function AdminServicesPage() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  const [filters, setFilters]       = useState({ status: '' });
  const [modal, setModal]           = useState(false);
  const [detailModal, setDetail]    = useState(null);
  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [rescheduleForm, setRescheduleForm]   = useState({ scheduled_date: '', due_time: '' });
  const [form, setForm]             = useState(EMPTY_FORM);
  const [photoIdx, setPhotoIdx]     = useState(0);
  const [photoSrc, setPhotoSrc]     = useState({});
  const [assignModal, setAssignModal] = useState(null);
  const [assignEmpId, setAssignEmpId] = useState('');

  const { data: services = [], isLoading } = useServices(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
  );
  const { data: employees = [] } = useEmployees();
  const { data: assignEmployees = [] } = useEmployeesByUnit(assignModal?.unit_id);

  const createMutation = useMutation({
    mutationFn: (body) => api.post('/services', body),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-services']);
      success('Serviço criado com sucesso.');
      setModal(false);
      setForm(EMPTY_FORM);
    },
    onError: (err) => error(err.response?.data?.error || 'Erro ao criar serviço.'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      assigned_employee_id: parseInt(form.assigned_employee_id, 10),
    });
  }

  async function openDetail(service) {
    const res = await api.get(`/services/${service.id}`);
    setDetail(res.data);
    setPhotoIdx(0);
    setPhotoSrc({});
  }

  async function loadPhoto(photo) {
    if (photoSrc[photo.id]) return;
    try {
      const res = await api.get(`/services/${photo.service_order_id}/photos/${photo.id}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      setPhotoSrc((prev) => ({ ...prev, [photo.id]: url }));
    } catch {}
  }

  const deletePhotoMutation = useMutation({
    mutationFn: ({ serviceId, photoId }) => api.delete(`/services/${serviceId}/photos/${photoId}`),
    onSuccess: async () => {
      success('Foto removida.');
      if (detailModal) {
        const res = await api.get(`/services/${detailModal.id}`);
        setDetail(res.data);
        setPhotoSrc({});
      }
    },
    onError: () => error('Erro ao remover foto.'),
  });

  const deleteServiceMutation = useMutation({
    mutationFn: (id) => api.delete(`/services/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-services']);
      success('Serviço excluído.');
      setDetail(null);
    },
    onError: () => error('Erro ao excluir serviço.'),
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ id, body }) => api.patch(`/services/${id}/reschedule`, body),
    onSuccess: async () => {
      queryClient.invalidateQueries(['admin-services']);
      success('Serviço reagendado.');
      if (detailModal) {
        const res = await api.get(`/services/${detailModal.id}`);
        setDetail(res.data);
      }
      setRescheduleModal(null);
    },
    onError: () => error('Erro ao reagendar serviço.'),
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, assigned_employee_id }) =>
      api.patch(`/services/${id}/assign`, { assigned_employee_id }),
    onSuccess: async () => {
      queryClient.invalidateQueries(['admin-services']);
      success('Funcionário atribuído.');
      setAssignModal(null);
      setAssignEmpId('');
    },
    onError: (err) => error(err.response?.data?.error || 'Erro ao atribuir funcionário.'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/services/${id}/status`, { status }),
    onSuccess: async () => {
      queryClient.invalidateQueries(['admin-services']);
      success('Status atualizado.');
      if (detailModal) {
        const res = await api.get(`/services/${detailModal.id}`);
        setDetail(res.data);
      }
    },
    onError: () => error('Erro ao atualizar status.'),
  });

  function openReschedule(service) {
    setRescheduleForm({
      scheduled_date: service.scheduled_date?.slice(0, 10) || '',
      due_time: service.due_time?.slice(0, 5) || '',
    });
    setRescheduleModal(service);
  }

  function handleReschedule(e) {
    e.preventDefault();
    rescheduleMutation.mutate({ id: rescheduleModal.id, body: rescheduleForm });
  }

  const allPhotos = detailModal ? [...(detailModal.photos || [])] : [];
  const beforePhotos = allPhotos.filter((p) => p.phase === 'before');
  const afterPhotos  = allPhotos.filter((p) => p.phase === 'after');

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>Serviços</h1>
        <button onClick={() => setModal(true)} style={s.primaryBtn}>+ Novo Serviço</button>
      </div>

      {/* Filtros */}
      <div style={s.filters}>
        <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} style={s.select}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {filters.status && (
          <button onClick={() => setFilters({ status: '' })} style={s.clearBtn}>Limpar</button>
        )}
      </div>

      {/* Tabela */}
      <div style={s.card}>
        {isLoading ? (
          <p style={s.empty}>Carregando...</p>
        ) : services.length === 0 ? (
          <p style={s.empty}>Nenhum serviço encontrado.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                {['Título', 'Funcionário', 'Data', 'Prazo', 'Status', 'Ações'].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {services.map((sv) => {
                return (
                  <tr key={sv.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={s.td}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{sv.title}</div>
                      {sv.description && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{sv.description.slice(0, 60)}{sv.description.length > 60 ? '…' : ''}</div>}
                    </td>
                    <td style={s.td}>
                      {sv.employee_name ? (
                        sv.employee_name
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ background: '#fef9c3', color: '#854d0e', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                            Sem responsável
                          </span>
                          <button
                            onClick={() => { setAssignModal(sv); setAssignEmpId(''); }}
                            style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: '#1d4ed8', fontWeight: 600 }}
                          >
                            Atribuir
                          </button>
                        </span>
                      )}
                    </td>
                    <td style={s.td}>{new Date(sv.scheduled_date).toLocaleDateString('pt-BR')}</td>
                    <td style={s.td}>{sv.due_time ? sv.due_time.slice(0, 5) : '—'}</td>
                    <td style={s.td}>
                      <ServiceStatusBadge status={sv.status} label={STATUS_LABEL[sv.status]} />
                    </td>
                    <td style={s.td}>
                      <button onClick={() => openDetail(sv)} style={actionBtn}>Ver detalhes</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal criação */}
      {modal && (
        <div style={overlay} onClick={() => setModal(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={modalTitle}>Novo Serviço</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Título *">
                <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  required placeholder="Ex: Limpeza do depósito" style={inputStyle} />
              </Field>
              <Field label="Descrição">
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3} placeholder="Detalhes do serviço..." style={{ ...inputStyle, resize: 'vertical' }} />
              </Field>
              <Field label="Funcionário *">
                <select value={form.assigned_employee_id} onChange={(e) => setForm((p) => ({ ...p, assigned_employee_id: e.target.value }))}
                  required style={inputStyle}>
                  <option value="">Selecione o funcionário</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Data agendada *">
                  <input type="date" value={form.scheduled_date} onChange={(e) => setForm((p) => ({ ...p, scheduled_date: e.target.value }))}
                    required style={inputStyle} />
                </Field>
                <Field label="Horário limite">
                  <input type="time" value={form.due_time} onChange={(e) => setForm((p) => ({ ...p, due_time: e.target.value }))}
                    style={inputStyle} />
                </Field>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={() => setModal(false)} style={s.outlineBtn}>Cancelar</button>
                <button type="submit" disabled={createMutation.isLoading}
                  style={{ ...s.primaryBtn, opacity: createMutation.isLoading ? 0.7 : 1 }}>
                  {createMutation.isLoading ? 'Criando...' : 'Criar Serviço'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal detalhe */}
      {detailModal && (
        <div style={overlay} onClick={() => setDetail(null)}>
          <div style={{ ...modalCard, maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h2 style={modalTitle}>{detailModal.title}</h2>
                <ServiceStatusBadge status={detailModal.status} label={STATUS_LABEL[detailModal.status]} />
              </div>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16, fontSize: 13 }}>
              <InfoRow label="Funcionário" value={detailModal.employee_name} />
              <InfoRow label="Unidade" value={detailModal.unit_name} />
              <InfoRow label="Data" value={new Date(detailModal.scheduled_date).toLocaleDateString('pt-BR')} />
              <InfoRow label="Prazo" value={detailModal.due_time?.slice(0, 5) || '—'} />
              <InfoRow label="Iniciado em" value={detailModal.started_at ? new Date(detailModal.started_at).toLocaleString('pt-BR') : '—'} />
              <InfoRow label="Concluído em" value={detailModal.finished_at ? new Date(detailModal.finished_at).toLocaleString('pt-BR') : '—'} />
            </div>

            {detailModal.description && (
              <div style={{ marginBottom: 16, padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#374151' }}>
                {detailModal.description}
              </div>
            )}

            {detailModal.issue_description && (
              <div style={{ marginBottom: 16, padding: '12px 14px', background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa', fontSize: 13, color: '#c2410c' }}>
                <strong>Ressalvas:</strong> {detailModal.issue_description}
              </div>
            )}

            {detailModal.problem_description && (
              <div style={{ marginBottom: 16, padding: '12px 14px', background: '#fee2e2', borderRadius: 8, border: '1px solid #fca5a5', fontSize: 13, color: '#991b1b' }}>
                <strong>Problema reportado:</strong> {detailModal.problem_description}
              </div>
            )}

            {/* Fotos antes */}
            <PhotoSection title="Fotos — Antes" photos={beforePhotos} photoSrc={photoSrc} onLoad={loadPhoto} serviceId={detailModal.id}
              onDelete={(photoId) => deletePhotoMutation.mutate({ serviceId: detailModal.id, photoId })} />
            {/* Fotos depois */}
            <PhotoSection title="Fotos — Depois" photos={afterPhotos} photoSrc={photoSrc} onLoad={loadPhoto} serviceId={detailModal.id}
              onDelete={(photoId) => deletePhotoMutation.mutate({ serviceId: detailModal.id, photoId })} />

            {allPhotos.length === 0 && (
              <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Nenhuma foto registrada.</p>
            )}

            {/* Ações de status */}
            <div style={{ marginTop: 20, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
              {!['done', 'done_with_issues'].includes(detailModal.status) && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Alterar status</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {detailModal.status !== 'in_progress' && (
                      <button
                        onClick={() => updateStatusMutation.mutate({ id: detailModal.id, status: 'in_progress' })}
                        disabled={updateStatusMutation.isLoading}
                        style={{ ...statusBtn, background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe' }}>
                        🔄 Em andamento
                      </button>
                    )}
                    <button
                      onClick={() => updateStatusMutation.mutate({ id: detailModal.id, status: 'done' })}
                      disabled={updateStatusMutation.isLoading}
                      style={{ ...statusBtn, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>
                      ✅ Marcar como concluído
                    </button>
                    {detailModal.status !== 'problem' && (
                      <button
                        onClick={() => updateStatusMutation.mutate({ id: detailModal.id, status: 'problem' })}
                        disabled={updateStatusMutation.isLoading}
                        style={{ ...statusBtn, background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>
                        ⚠️ Problema
                      </button>
                    )}
                  </div>
                </div>
              )}
              {['done', 'done_with_issues'].includes(detailModal.status) && (
                <div style={{ marginBottom: 12 }}>
                  <button
                    onClick={() => updateStatusMutation.mutate({ id: detailModal.id, status: 'in_progress' })}
                    disabled={updateStatusMutation.isLoading}
                    style={{ ...statusBtn, background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe' }}>
                    🔄 Reabrir serviço
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => openReschedule(detailModal)}
                  style={{ ...s.outlineBtn, borderColor: '#0891b2', color: '#0891b2' }}>
                  Reagendar
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Excluir o serviço "${detailModal.title}" permanentemente?`))
                      deleteServiceMutation.mutate(detailModal.id);
                  }}
                  disabled={deleteServiceMutation.isLoading}
                  style={{ ...s.primaryBtn, background: '#dc2626' }}>
                  {deleteServiceMutation.isLoading ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de atribuição de funcionário */}
      {assignModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
          onClick={() => { setAssignModal(null); setAssignEmpId(''); }}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 16, marginTop: 0 }}>
              Atribuir funcionário
            </h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              Serviço: <strong>{assignModal.title}</strong>
            </p>
            <select
              style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 14, width: '100%', marginBottom: 20 }}
              value={assignEmpId}
              onChange={(e) => setAssignEmpId(e.target.value)}
            >
              <option value="">Selecione o funcionário</option>
              {assignEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </select>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => { setAssignModal(null); setAssignEmpId(''); }}
                style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => assignMutation.mutate({ id: assignModal.id, assigned_employee_id: parseInt(assignEmpId, 10) })}
                disabled={!assignEmpId || assignMutation.isLoading}
                style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: !assignEmpId ? 0.5 : 1 }}
              >
                {assignMutation.isLoading ? 'Salvando...' : 'Atribuir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal reagendamento */}
      {rescheduleModal && (
        <div style={overlay} onClick={() => setRescheduleModal(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={modalTitle}>Reagendar Serviço</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>{rescheduleModal.title}</p>
            <form onSubmit={handleReschedule} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Nova data *">
                  <input type="date" value={rescheduleForm.scheduled_date}
                    onChange={(e) => setRescheduleForm((p) => ({ ...p, scheduled_date: e.target.value }))}
                    required style={inputStyle} />
                </Field>
                <Field label="Novo horário limite">
                  <input type="time" value={rescheduleForm.due_time}
                    onChange={(e) => setRescheduleForm((p) => ({ ...p, due_time: e.target.value }))}
                    style={inputStyle} />
                </Field>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={() => setRescheduleModal(null)} style={s.outlineBtn}>Cancelar</button>
                <button type="submit" disabled={rescheduleMutation.isLoading}
                  style={{ ...s.primaryBtn, opacity: rescheduleMutation.isLoading ? 0.7 : 1 }}>
                  {rescheduleMutation.isLoading ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PhotoSection({ title, photos, photoSrc, onLoad, serviceId, onDelete }) {
  if (photos.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>{title}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {photos.map((photo) => {
          onLoad({ ...photo, service_order_id: serviceId });
          return (
            <div key={photo.id} style={{ position: 'relative', width: 100, height: 100, borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
              {photoSrc[photo.id]
                ? <img src={photoSrc[photo.id]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#cbd5e1', fontSize: 12 }}>…</div>
              }
              {onDelete && (
                <button
                  onClick={() => { if (window.confirm('Apagar esta foto permanentemente?')) onDelete(photo.id); }}
                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(220,38,38,0.85)', border: 'none', borderRadius: '50%', width: 22, height: 22, color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{label}</label>
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <span style={{ color: '#94a3b8', fontWeight: 600 }}>{label}: </span>
      <span style={{ color: '#0f172a' }}>{value}</span>
    </div>
  );
}

const actionBtn = { padding: '4px 12px', fontSize: 12, cursor: 'pointer', border: '1px solid #e2e8f0', borderRadius: 6, background: '#f8fafc', color: '#374151' };
const statusBtn = { padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', borderRadius: 8 };
const overlay   = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 };
const modalCard = { background: '#fff', borderRadius: 12, padding: '28px 24px', width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' };
const modalTitle = { fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 16 };
const inputStyle = { padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#1e293b', outline: 'none', width: '100%', boxSizing: 'border-box' };

const s = {
  header:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title:      { fontSize: 22, fontWeight: 800, color: '#0f172a' },
  filters:    { display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  select:     { padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#374151', background: '#fff', outline: 'none' },
  clearBtn:   { padding: '8px 16px', background: '#f1f5f9', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, cursor: 'pointer', color: '#374151' },
  card:       { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' },
  th:         { padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  td:         { padding: '14px 16px', fontSize: 14, color: '#374151', verticalAlign: 'middle' },
  empty:      { padding: 24, color: '#64748b' },
  primaryBtn: { padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', color: '#fff', background: '#1d4ed8', fontWeight: 600 },
  outlineBtn: { padding: '8px 16px', border: '1.5px solid #1d4ed8', borderRadius: 8, fontSize: 14, cursor: 'pointer', color: '#1d4ed8', background: '#fff', fontWeight: 600 },
};
