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

const EMPTY_SERVICE  = { title: '', description: '', assigned_employee_id: '', scheduled_date: '', due_time: '' };
const EMPTY_TEMPLATE = { title: '', description: '', unit_id: '', assigned_employee_id: '', due_time: '', interval_days: '', start_date: '', quantity: '1' };

export default function AdminServicesPage() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  const [tab, setTab] = useState('services');

  // ── Services state ──
  const [filters, setFilters]           = useState({ status: '', employeeId: '' });
  const [selected, setSelected]         = useState(new Set());
  const [modal, setModal]               = useState(false);
  const [detailModal, setDetail]        = useState(null);
  const [rescheduleModal, setReschedule] = useState(null);
  const [rescheduleForm, setRescheduleForm] = useState({ scheduled_date: '', due_time: '' });
  const [form, setForm]                 = useState(EMPTY_SERVICE);
  const [photoSrc, setPhotoSrc]         = useState({});
  const [assignModal, setAssignModal]   = useState(null);
  const [assignEmpId, setAssignEmpId]   = useState('');

  // ── Templates state ──
  const [tplModal, setTplModal]         = useState(false);   // false | 'create' | tpl object
  const [tplForm, setTplForm]           = useState(EMPTY_TEMPLATE);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // ── Queries ──
  const { data: services = [], isLoading: svcLoading } = useServices(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
  );
  const { data: employees = [] }         = useEmployees();
  const { data: assignEmployees = [] }   = useEmployeesByUnit(assignModal?.unit_id);
  const { data: templates = [], isLoading: tplLoading } = useTemplates();
  const { data: units = [] }             = useUnits();
  const { data: tplEmployees = [] }      = useEmployeesByUnit(tplForm.unit_id);

  // ── Service mutations ──
  const createSvc = useMutation({
    mutationFn: (body) => api.post('/services', body),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-services']);
      success('Serviço criado com sucesso.');
      setModal(false);
      setForm(EMPTY_SERVICE);
    },
    onError: (err) => error(err.response?.data?.error || 'Erro ao criar serviço.'),
  });

  const deleteSvc = useMutation({
    mutationFn: (id) => api.delete(`/services/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-services']);
      success('Serviço excluído.');
      setDetail(null);
    },
    onError: () => error('Erro ao excluir serviço.'),
  });

  const rescheduleSvc = useMutation({
    mutationFn: ({ id, body }) => api.patch(`/services/${id}/reschedule`, body),
    onSuccess: async () => {
      queryClient.invalidateQueries(['admin-services']);
      success('Serviço reagendado.');
      if (detailModal) setDetail((await api.get(`/services/${detailModal.id}`)).data);
      setReschedule(null);
    },
    onError: () => error('Erro ao reagendar serviço.'),
  });

  const assignSvc = useMutation({
    mutationFn: ({ id, assigned_employee_id }) =>
      api.patch(`/services/${id}/assign`, { assigned_employee_id }),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-services']);
      success('Funcionário atribuído.');
      setAssignModal(null);
      setAssignEmpId('');
    },
    onError: (err) => error(err.response?.data?.error || 'Erro ao atribuir funcionário.'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/services/${id}/status`, { status }),
    onSuccess: async () => {
      queryClient.invalidateQueries(['admin-services']);
      success('Status atualizado.');
      if (detailModal) setDetail((await api.get(`/services/${detailModal.id}`)).data);
    },
    onError: () => error('Erro ao atualizar status.'),
  });

  const bulkStatus = useMutation({
    mutationFn: ({ ids, status }) =>
      Promise.all(ids.map((id) => api.patch(`/services/${id}/status`, { status }))),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-services']);
      success('Status atualizado em massa.');
      setSelected(new Set());
    },
    onError: () => error('Erro ao atualizar status em massa.'),
  });

  const bulkDelete = useMutation({
    mutationFn: (ids) => Promise.all(ids.map((id) => api.delete(`/services/${id}`))),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-services']);
      success('Serviços excluídos.');
      setSelected(new Set());
    },
    onError: () => error('Erro ao excluir serviços.'),
  });

  const deletePhoto = useMutation({
    mutationFn: ({ serviceId, photoId }) => api.delete(`/services/${serviceId}/photos/${photoId}`),
    onSuccess: async () => {
      success('Foto removida.');
      if (detailModal) {
        setDetail((await api.get(`/services/${detailModal.id}`)).data);
        setPhotoSrc({});
      }
    },
    onError: () => error('Erro ao remover foto.'),
  });

  // ── Template mutations ──
  const createTpl = useMutation({
    mutationFn: (body) => api.post('/service-templates', body),
    onSuccess: () => {
      queryClient.invalidateQueries(['service-templates']);
      success('Template criado com sucesso.');
      closeTplModal();
    },
    onError: (err) => error(err.response?.data?.error || 'Erro ao criar template.'),
  });

  const updateTpl = useMutation({
    mutationFn: ({ id, body }) => api.patch(`/service-templates/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries(['service-templates']);
      success('Template atualizado.');
      closeTplModal();
    },
    onError: (err) => error(err.response?.data?.error || 'Erro ao atualizar template.'),
  });

  const toggleTpl = useMutation({
    mutationFn: (id) => api.patch(`/service-templates/${id}/toggle`),
    onSuccess: () => queryClient.invalidateQueries(['service-templates']),
    onError: () => error('Erro ao alterar status do template.'),
  });

  const deleteTpl = useMutation({
    mutationFn: (id) => api.delete(`/service-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['service-templates']);
      success('Template removido.');
      setConfirmDelete(null);
    },
    onError: () => error('Erro ao remover template.'),
  });

  const fireTpl = useMutation({
    mutationFn: (id) => api.post(`/service-templates/${id}/fire`),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-services']);
      success('Serviço criado a partir do template.');
    },
    onError: (err) => error(err.response?.data?.error || 'Erro ao disparar template.'),
  });

  // ── Handlers ──
  function handleSvcSubmit(e) {
    e.preventDefault();
    createSvc.mutate({ ...form, assigned_employee_id: parseInt(form.assigned_employee_id, 10) });
  }

  async function openDetail(service) {
    const res = await api.get(`/services/${service.id}`);
    setDetail(res.data);
    setPhotoSrc({});
  }

  async function loadPhoto(photo) {
    if (photoSrc[photo.id]) return;
    try {
      const res = await api.get(`/services/${photo.service_order_id}/photos/${photo.id}`, { responseType: 'blob' });
      setPhotoSrc((prev) => ({ ...prev, [photo.id]: URL.createObjectURL(res.data) }));
    } catch {}
  }

  function openReschedule(service) {
    setRescheduleForm({ scheduled_date: service.scheduled_date?.slice(0, 10) || '', due_time: service.due_time?.slice(0, 5) || '' });
    setReschedule(service);
  }

  function openTplCreate() {
    setTplForm(EMPTY_TEMPLATE);
    setTplModal('create');
  }

  function openTplEdit(tpl) {
    setTplForm({
      title:                tpl.title,
      description:          tpl.description || '',
      unit_id:              String(tpl.unit_id),
      assigned_employee_id: tpl.assigned_employee_id ? String(tpl.assigned_employee_id) : '',
      due_time:             tpl.due_time?.slice(0, 5) || '',
      interval_days:        String(tpl.interval_days),
      start_date:           tpl.start_date?.slice(0, 10) || '',
      quantity:             String(tpl.quantity || 1),
    });
    setTplModal(tpl);
  }

  function closeTplModal() {
    setTplModal(false);
    setTplForm(EMPTY_TEMPLATE);
  }

  function handleTplSubmit(e) {
    e.preventDefault();
    const body = {
      title:                tplForm.title,
      description:          tplForm.description || undefined,
      unit_id:              parseInt(tplForm.unit_id, 10),
      assigned_employee_id: tplForm.assigned_employee_id ? parseInt(tplForm.assigned_employee_id, 10) : undefined,
      due_time:             tplForm.due_time || undefined,
      interval_days:        parseInt(tplForm.interval_days, 10),
      quantity:             Math.min(40, Math.max(1, parseInt(tplForm.quantity, 10) || 1)),
      start_date:           tplForm.start_date,
    };
    const isEditing = tplModal && tplModal !== 'create';
    if (isEditing) updateTpl.mutate({ id: tplModal.id, body });
    else createTpl.mutate(body);
  }

  function fmtDate(dt) {
    if (!dt) return '—';
    return formatInTimeZone(new Date(dt), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm');
  }

  const allPhotos    = detailModal ? [...(detailModal.photos || [])] : [];
  const beforePhotos = allPhotos.filter((p) => p.phase === 'before');
  const afterPhotos  = allPhotos.filter((p) => p.phase === 'after');
  const tplBusy      = createTpl.isLoading || updateTpl.isLoading;
  const tplIsEditing = tplModal && tplModal !== 'create';

  return (
    <div>
      {/* Header */}
      <div style={s.header}>
        <h1 style={s.title}>Serviços</h1>
        {tab === 'services'
          ? <button onClick={() => setModal(true)} style={s.primaryBtn}>+ Novo Serviço</button>
          : <button onClick={openTplCreate} style={s.primaryBtn}>+ Novo Template</button>
        }
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        <button onClick={() => setTab('services')} style={tab === 'services' ? s.tabActive : s.tab}>Serviços</button>
        <button onClick={() => setTab('templates')} style={tab === 'templates' ? s.tabActive : s.tab}>Templates recorrentes</button>
      </div>

      {/* ── SERVICES TAB ── */}
      {tab === 'services' && (
        <>
          <div style={s.filters}>
            <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} style={s.select}>
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filters.employeeId} onChange={(e) => setFilters((p) => ({ ...p, employeeId: e.target.value }))} style={s.select}>
              <option value="">Todos os funcionários</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
            {(filters.status || filters.employeeId) && (
              <button onClick={() => setFilters({ status: '', employeeId: '' })} style={s.clearBtn}>Limpar</button>
            )}
          </div>

          {selected.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8', marginRight: 4 }}>{selected.size} selecionado(s)</span>
              <button onClick={() => bulkStatus.mutate({ ids: [...selected], status: 'in_progress' })} disabled={bulkStatus.isLoading}
                style={{ ...statusBtn, background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe', fontSize: 12 }}>Em andamento</button>
              <button onClick={() => bulkStatus.mutate({ ids: [...selected], status: 'done' })} disabled={bulkStatus.isLoading}
                style={{ ...statusBtn, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', fontSize: 12 }}>Marcar como concluído</button>
              <button onClick={() => bulkStatus.mutate({ ids: [...selected], status: 'done_with_issues' })} disabled={bulkStatus.isLoading}
                style={{ ...statusBtn, background: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa', fontSize: 12 }}>Concluído c/ ressalvas</button>
              <button onClick={() => bulkStatus.mutate({ ids: [...selected], status: 'problem' })} disabled={bulkStatus.isLoading}
                style={{ ...statusBtn, background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', fontSize: 12 }}>Problema</button>
              <button onClick={() => bulkStatus.mutate({ ids: [...selected], status: 'pending' })} disabled={bulkStatus.isLoading}
                style={{ ...statusBtn, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', fontSize: 12 }}>Reabrir</button>
              <button
                onClick={() => { if (window.confirm(`Excluir ${selected.size} serviço(s) permanentemente?`)) bulkDelete.mutate([...selected]); }}
                disabled={bulkDelete.isLoading}
                style={{ ...statusBtn, background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', fontSize: 12 }}>Excluir</button>
              <button onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 12, cursor: 'pointer', color: '#64748b' }}>Cancelar</button>
            </div>
          )}

          <div style={s.card}>
            {svcLoading ? (
              <p style={s.empty}>Carregando...</p>
            ) : services.length === 0 ? (
              <p style={s.empty}>Nenhum serviço encontrado.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ ...s.th, width: 36 }}>
                      <input type="checkbox"
                        checked={selected.size === services.length && services.length > 0}
                        onChange={(e) => setSelected(e.target.checked ? new Set(services.map((sv) => sv.id)) : new Set())}
                      />
                    </th>
                    {['Título', 'Funcionário', 'Data', 'Prazo', 'Status', 'Ações'].map((h) => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {services.map((sv) => (
                    <tr key={sv.id} style={{ borderBottom: '1px solid #f8fafc', background: selected.has(sv.id) ? '#f0f9ff' : undefined }}>
                      <td style={{ ...s.td, width: 36 }}>
                        <input type="checkbox" checked={selected.has(sv.id)}
                          onChange={(e) => setSelected((prev) => { const next = new Set(prev); e.target.checked ? next.add(sv.id) : next.delete(sv.id); return next; })}
                        />
                      </td>
                      <td style={s.td}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{sv.title}</div>
                        {sv.description && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{sv.description.slice(0, 60)}{sv.description.length > 60 ? '…' : ''}</div>}
                      </td>
                      <td style={s.td}>
                        {sv.employee_name ? sv.employee_name : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ background: '#fef9c3', color: '#854d0e', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>Sem responsável</span>
                            <button
                              onClick={() => { setAssignModal(sv); setAssignEmpId(''); }}
                              style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: '#1d4ed8', fontWeight: 600 }}
                            >Atribuir</button>
                          </span>
                        )}
                      </td>
                      <td style={s.td}>{new Date(sv.scheduled_date).toLocaleDateString('pt-BR')}</td>
                      <td style={s.td}>{sv.due_time ? sv.due_time.slice(0, 5) : '—'}</td>
                      <td style={s.td}><ServiceStatusBadge status={sv.status} label={STATUS_LABEL[sv.status]} /></td>
                      <td style={s.td}>
                        <button onClick={() => openDetail(sv)} style={actionBtn}>Ver detalhes</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── TEMPLATES TAB ── */}
      {tab === 'templates' && (
        <div style={s.card}>
          {tplLoading ? (
            <p style={s.empty}>Carregando...</p>
          ) : templates.length === 0 ? (
            <p style={s.empty}>Nenhum template cadastrado.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Título', 'Posto', 'Responsável', 'Intervalo', 'Qtd.', 'Próximo disparo', 'Status', 'Ações'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {templates.map((tpl) => (
                    <tr key={tpl.id}>
                      <td style={tplTd}>{tpl.title}</td>
                      <td style={tplTd}>{tpl.unit_name} <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>{tpl.unit_code}</span></td>
                      <td style={tplTd}>
                        {tpl.employee_name
                          ? tpl.employee_name
                          : <span style={{ background: '#fef9c3', color: '#854d0e', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>A definir</span>}
                      </td>
                      <td style={tplTd}>A cada {tpl.interval_days} dia(s)</td>
                      <td style={tplTd}>{tpl.quantity || 1}</td>
                      <td style={tplTd}>{fmtDate(tpl.next_run_at)}</td>
                      <td style={tplTd}>
                        <span style={tpl.active
                          ? { background: '#dcfce7', color: '#166534', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }
                          : { background: '#f1f5f9', color: '#64748b', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                          {tpl.active ? 'Ativo' : 'Pausado'}
                        </span>
                      </td>
                      <td style={{ ...tplTd, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => openTplEdit(tpl)} style={actionBtn}>Editar</button>
                        <button
                          onClick={() => toggleTpl.mutate(tpl.id)}
                          style={{ ...actionBtn, color: tpl.active ? '#d97706' : '#16a34a' }}
                        >{tpl.active ? 'Pausar' : 'Ativar'}</button>
                        <button
                          onClick={() => { if (window.confirm(`Disparar agora o template "${tpl.title}"?`)) fireTpl.mutate(tpl.id); }}
                          disabled={fireTpl.isLoading}
                          style={{ ...actionBtn, color: '#0891b2', borderColor: '#bae6fd' }}
                        >Disparar</button>
                        <button
                          onClick={() => setConfirmDelete(tpl)}
                          style={{ ...actionBtn, color: '#dc2626' }}
                        >Excluir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: criar serviço ── */}
      {modal && (
        <div style={overlay} onClick={() => setModal(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={modalTitle}>Novo Serviço</h2>
            <form onSubmit={handleSvcSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                <button type="submit" disabled={createSvc.isLoading}
                  style={{ ...s.primaryBtn, opacity: createSvc.isLoading ? 0.7 : 1 }}>
                  {createSvc.isLoading ? 'Criando...' : 'Criar Serviço'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: detalhe do serviço ── */}
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

            <PhotoSection title="Fotos — Antes" photos={beforePhotos} photoSrc={photoSrc} onLoad={loadPhoto} serviceId={detailModal.id}
              onDelete={(photoId) => deletePhoto.mutate({ serviceId: detailModal.id, photoId })} />
            <PhotoSection title="Fotos — Depois" photos={afterPhotos} photoSrc={photoSrc} onLoad={loadPhoto} serviceId={detailModal.id}
              onDelete={(photoId) => deletePhoto.mutate({ serviceId: detailModal.id, photoId })} />
            {allPhotos.length === 0 && (
              <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Nenhuma foto registrada.</p>
            )}

            <div style={{ marginTop: 20, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
              {!['done', 'done_with_issues'].includes(detailModal.status) && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Alterar status</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {detailModal.status !== 'in_progress' && (
                      <button onClick={() => updateStatus.mutate({ id: detailModal.id, status: 'in_progress' })} disabled={updateStatus.isLoading}
                        style={{ ...statusBtn, background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe' }}>🔄 Em andamento</button>
                    )}
                    <button onClick={() => updateStatus.mutate({ id: detailModal.id, status: 'done' })} disabled={updateStatus.isLoading}
                      style={{ ...statusBtn, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>✅ Marcar como concluído</button>
                    {detailModal.status !== 'problem' && (
                      <button onClick={() => updateStatus.mutate({ id: detailModal.id, status: 'problem' })} disabled={updateStatus.isLoading}
                        style={{ ...statusBtn, background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>⚠️ Problema</button>
                    )}
                  </div>
                </div>
              )}
              {['done', 'done_with_issues'].includes(detailModal.status) && (
                <div style={{ marginBottom: 12 }}>
                  <button onClick={() => updateStatus.mutate({ id: detailModal.id, status: 'in_progress' })} disabled={updateStatus.isLoading}
                    style={{ ...statusBtn, background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe' }}>🔄 Reabrir serviço</button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => openReschedule(detailModal)} style={{ ...s.outlineBtn, borderColor: '#0891b2', color: '#0891b2' }}>Reagendar</button>
                <button
                  onClick={() => { if (window.confirm(`Excluir o serviço "${detailModal.title}" permanentemente?`)) deleteSvc.mutate(detailModal.id); }}
                  disabled={deleteSvc.isLoading}
                  style={{ ...s.primaryBtn, background: '#dc2626' }}>
                  {deleteSvc.isLoading ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: atribuição de funcionário ── */}
      {assignModal && (
        <div style={overlay} onClick={() => { setAssignModal(null); setAssignEmpId(''); }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 16, marginTop: 0 }}>Atribuir funcionário</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Serviço: <strong>{assignModal.title}</strong></p>
            <select
              style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 14, width: '100%', marginBottom: 20 }}
              value={assignEmpId}
              onChange={(e) => setAssignEmpId(e.target.value)}
            >
              <option value="">Selecione o funcionário</option>
              {assignEmployees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
            </select>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => { setAssignModal(null); setAssignEmpId(''); }}
                style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button
                onClick={() => assignSvc.mutate({ id: assignModal.id, assigned_employee_id: parseInt(assignEmpId, 10) })}
                disabled={!assignEmpId || assignSvc.isLoading}
                style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: !assignEmpId ? 0.5 : 1 }}>
                {assignSvc.isLoading ? 'Salvando...' : 'Atribuir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: reagendamento ── */}
      {rescheduleModal && (
        <div style={overlay} onClick={() => setReschedule(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={modalTitle}>Reagendar Serviço</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>{rescheduleModal.title}</p>
            <form onSubmit={(e) => { e.preventDefault(); rescheduleSvc.mutate({ id: rescheduleModal.id, body: rescheduleForm }); }}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                <button type="button" onClick={() => setReschedule(null)} style={s.outlineBtn}>Cancelar</button>
                <button type="submit" disabled={rescheduleSvc.isLoading}
                  style={{ ...s.primaryBtn, opacity: rescheduleSvc.isLoading ? 0.7 : 1 }}>
                  {rescheduleSvc.isLoading ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: criar/editar template ── */}
      {tplModal && (
        <div style={overlay} onClick={closeTplModal}>
          <div style={{ ...modalCard, maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={modalTitle}>{tplIsEditing ? 'Editar Template' : 'Novo Template'}</h2>
            <form onSubmit={handleTplSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Título *">
                <input style={inputStyle} value={tplForm.title}
                  onChange={(e) => setTplForm((p) => ({ ...p, title: e.target.value }))} required />
              </Field>
              <Field label="Descrição">
                <textarea style={{ ...inputStyle, height: 60, resize: 'vertical' }} value={tplForm.description}
                  onChange={(e) => setTplForm((p) => ({ ...p, description: e.target.value }))} />
              </Field>
              <Field label="Posto *">
                <select style={inputStyle} value={tplForm.unit_id}
                  onChange={(e) => setTplForm((p) => ({ ...p, unit_id: e.target.value, assigned_employee_id: '' }))} required>
                  <option value="">Selecione o posto</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
                </select>
              </Field>
              <Field label="Responsável">
                <select style={inputStyle} value={tplForm.assigned_employee_id}
                  onChange={(e) => setTplForm((p) => ({ ...p, assigned_employee_id: e.target.value }))}
                  disabled={!tplForm.unit_id}>
                  <option value="">A definir / atribuir manualmente</option>
                  {tplEmployees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                </select>
              </Field>
              <Field label="Data de início *">
                <input type="date" style={inputStyle} value={tplForm.start_date}
                  onChange={(e) => setTplForm((p) => ({ ...p, start_date: e.target.value }))} required />
              </Field>
              <Field label="Horário limite (opcional)">
                <input type="time" style={inputStyle} value={tplForm.due_time}
                  onChange={(e) => setTplForm((p) => ({ ...p, due_time: e.target.value }))} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Intervalo em dias *">
                  <input type="number" min={1} style={inputStyle} value={tplForm.interval_days}
                    onChange={(e) => setTplForm((p) => ({ ...p, interval_days: e.target.value }))} required />
                </Field>
                <Field label="Qtd. de serviços por disparo *">
                  <input type="number" min={1} max={40} style={inputStyle} value={tplForm.quantity}
                    onChange={(e) => setTplForm((p) => ({ ...p, quantity: e.target.value }))} required />
                </Field>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={closeTplModal} style={s.outlineBtn} disabled={tplBusy}>Cancelar</button>
                <button type="submit" style={s.primaryBtn} disabled={tplBusy}>
                  {tplBusy ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: confirmar exclusão de template ── */}
      {confirmDelete && (
        <div style={overlay} onClick={() => setConfirmDelete(null)}>
          <div style={{ ...modalCard, maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={modalTitle}>Excluir template?</h2>
            <p style={{ fontSize: 14, color: '#374151', marginBottom: 20 }}>
              O template <strong>"{confirmDelete.title}"</strong> será removido. Os serviços já gerados não serão afetados.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={s.outlineBtn}>Cancelar</button>
              <button onClick={() => deleteTpl.mutate(confirmDelete.id)}
                style={{ ...s.primaryBtn, background: '#dc2626' }} disabled={deleteTpl.isLoading}>
                {deleteTpl.isLoading ? 'Removendo...' : 'Excluir'}
              </button>
            </div>
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
              <button onClick={() => { if (window.confirm('Apagar esta foto permanentemente?')) onDelete(photo.id); }}
                style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(220,38,38,0.85)', border: 'none', borderRadius: '50%', width: 22, height: 22, color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                ✕
              </button>
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

const actionBtn  = { padding: '4px 12px', fontSize: 12, cursor: 'pointer', border: '1px solid #e2e8f0', borderRadius: 6, background: '#f8fafc', color: '#374151' };
const statusBtn  = { padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', borderRadius: 8 };
const overlay    = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 };
const modalCard  = { background: '#fff', borderRadius: 12, padding: '28px 24px', width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' };
const modalTitle = { fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 16, marginTop: 0 };
const inputStyle = { padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#1e293b', outline: 'none', width: '100%', boxSizing: 'border-box' };
const tplTd      = { padding: '10px 12px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' };

const s = {
  header:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title:      { fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 },
  tabs:       { display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #e2e8f0' },
  tab:        { padding: '9px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', color: '#64748b', borderBottom: '2px solid transparent', marginBottom: -2 },
  tabActive:  { padding: '9px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none', color: '#1d4ed8', borderBottom: '2px solid #1d4ed8', marginBottom: -2 },
  filters:    { display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  select:     { padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#374151', background: '#fff', outline: 'none' },
  clearBtn:   { padding: '8px 16px', background: '#f1f5f9', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, cursor: 'pointer', color: '#374151' },
  card:       { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' },
  th:         { padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  td:         { padding: '14px 16px', fontSize: 14, color: '#374151', verticalAlign: 'middle' },
  empty:      { padding: 24, color: '#64748b', textAlign: 'center' },
  primaryBtn: { padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', color: '#fff', background: '#1d4ed8', fontWeight: 600 },
  outlineBtn: { padding: '8px 16px', border: '1.5px solid #1d4ed8', borderRadius: 8, fontSize: 14, cursor: 'pointer', color: '#1d4ed8', background: '#fff', fontWeight: 600 },
};
