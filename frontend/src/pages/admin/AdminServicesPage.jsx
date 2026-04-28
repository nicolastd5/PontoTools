import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import ServiceStatusBadge from '../../components/shared/ServiceStatusBadge';

function Icon({ d, size = 16, color = 'currentColor', strokeWidth = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {Array.isArray(d)
        ? d.map((p, i) => <path key={i} d={p} />)
        : <path d={d} />}
    </svg>
  );
}

const ICON_PLUS      = 'M12 5v14M5 12h14';
const ICON_CLOSE     = 'M18 6 6 18M6 6l12 12';
const ICON_REFRESH   = 'M1 4v6h6 M23 20v-6h-6 M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15';
const ICON_CHECK     = 'M20 6 9 17l-5-5';
const ICON_WARN      = 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01';
const ICON_CALENDAR  = 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z';
const ICON_USER_PLUS = 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0 M19 8v6 M22 11h-6';
const ICON_TRASH     = 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2';
const ICON_EYE       = 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z';

function fmtDateOnly(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = String(dateStr).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

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
const ALL_DAYS = [true, true, true, true, true, true, true];
const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
function bitmaskToDays(mask) {
  if (mask == null) return [...ALL_DAYS];
  return Array.from({ length: 7 }, (_, i) => Boolean((mask >> i) & 1));
}
function daysToBitmask(days) {
  if (days.every(Boolean)) return null;
  return days.reduce((acc, on, i) => acc | (on ? 1 << i : 0), 0);
}
const EMPTY_TEMPLATE = { title: '', description: '', unit_id: '', assigned_employee_id: '', due_time: '', interval_days: '', start_date: '', quantity: '1', fire_days: [...ALL_DAYS] };

export default function AdminServicesPage() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  const [tab, setTab] = useState('services');

  const [svcTab, setSvcTab]             = useState('pending');
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

  const [tplModal, setTplModal]         = useState(false);
  const [tplForm, setTplForm]           = useState(EMPTY_TEMPLATE);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [fireModal, setFireModal]       = useState(null);
  const [fireDate, setFireDate]         = useState('');

  const { data: services = [], isLoading: svcLoading } = useServices(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
  );
  const { data: employees = [] }         = useEmployees();
  const { data: assignEmployees = [] }   = useEmployeesByUnit(assignModal?.unit_id);
  const { data: templates = [], isLoading: tplLoading } = useTemplates();
  const { data: units = [] }             = useUnits();
  const { data: tplEmployees = [] }      = useEmployeesByUnit(tplForm.unit_id);

  const createSvc = useMutation({
    mutationFn: (body) => api.post('/services', body),
    onSuccess: () => { queryClient.invalidateQueries(['admin-services']); success('Serviço criado com sucesso.'); setModal(false); setForm(EMPTY_SERVICE); },
    onError: (err) => error(err.response?.data?.error || 'Erro ao criar serviço.'),
  });
  const deleteSvc = useMutation({
    mutationFn: (id) => api.delete(`/services/${id}`),
    onSuccess: () => { queryClient.invalidateQueries(['admin-services']); success('Serviço excluído.'); setDetail(null); },
    onError: () => error('Erro ao excluir serviço.'),
  });
  const rescheduleSvc = useMutation({
    mutationFn: ({ id, body }) => api.patch(`/services/${id}/reschedule`, body),
    onSuccess: async () => {
      queryClient.invalidateQueries(['admin-services']); success('Serviço reagendado.');
      if (detailModal) setDetail((await api.get(`/services/${detailModal.id}`)).data);
      setReschedule(null);
    },
    onError: () => error('Erro ao reagendar serviço.'),
  });
  const assignSvc = useMutation({
    mutationFn: ({ id, assigned_employee_id }) => api.patch(`/services/${id}/assign`, { assigned_employee_id }),
    onSuccess: () => { queryClient.invalidateQueries(['admin-services']); success('Funcionário atribuído.'); setAssignModal(null); setAssignEmpId(''); },
    onError: (err) => error(err.response?.data?.error || 'Erro ao atribuir funcionário.'),
  });
  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/services/${id}/status`, { status }),
    onSuccess: async () => {
      queryClient.invalidateQueries(['admin-services']); success('Status atualizado.');
      if (detailModal) setDetail((await api.get(`/services/${detailModal.id}`)).data);
    },
    onError: () => error('Erro ao atualizar status.'),
  });
  const bulkStatus = useMutation({
    mutationFn: ({ ids, status }) => Promise.all(ids.map((id) => api.patch(`/services/${id}/status`, { status }))),
    onSuccess: () => { queryClient.invalidateQueries(['admin-services']); success('Status atualizado em massa.'); setSelected(new Set()); },
    onError: () => error('Erro ao atualizar status em massa.'),
  });
  const bulkDelete = useMutation({
    mutationFn: (ids) => Promise.all(ids.map((id) => api.delete(`/services/${id}`))),
    onSuccess: () => { queryClient.invalidateQueries(['admin-services']); success('Serviços excluídos.'); setSelected(new Set()); },
    onError: () => error('Erro ao excluir serviços.'),
  });
  const deletePhoto = useMutation({
    mutationFn: ({ serviceId, photoId }) => api.delete(`/services/${serviceId}/photos/${photoId}`),
    onSuccess: async () => {
      success('Foto removida.');
      if (detailModal) { setDetail((await api.get(`/services/${detailModal.id}`)).data); setPhotoSrc({}); }
    },
    onError: () => error('Erro ao remover foto.'),
  });

  const createTpl = useMutation({
    mutationFn: (body) => api.post('/service-templates', body),
    onSuccess: () => { queryClient.invalidateQueries(['service-templates']); success('Template criado.'); closeTplModal(); },
    onError: (err) => error(err.response?.data?.error || 'Erro ao criar template.'),
  });
  const updateTpl = useMutation({
    mutationFn: ({ id, body }) => api.patch(`/service-templates/${id}`, body),
    onSuccess: () => { queryClient.invalidateQueries(['service-templates']); success('Template atualizado.'); closeTplModal(); },
    onError: (err) => error(err.response?.data?.error || 'Erro ao atualizar template.'),
  });
  const toggleTpl = useMutation({
    mutationFn: (id) => api.patch(`/service-templates/${id}/toggle`),
    onSuccess: () => queryClient.invalidateQueries(['service-templates']),
    onError: () => error('Erro ao alterar status do template.'),
  });
  const deleteTpl = useMutation({
    mutationFn: (id) => api.delete(`/service-templates/${id}`),
    onSuccess: () => { queryClient.invalidateQueries(['service-templates']); success('Template removido.'); setConfirmDelete(null); },
    onError: () => error('Erro ao remover template.'),
  });
  const fireTpl = useMutation({
    mutationFn: ({ id, scheduled_date }) => api.post(`/service-templates/${id}/fire`, { scheduled_date }),
    onSuccess: () => { queryClient.invalidateQueries(['admin-services']); success('Serviço criado a partir do template.'); setFireModal(null); },
    onError: (err) => error(err.response?.data?.error || 'Erro ao disparar template.'),
  });

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

  function openTplCreate() { setTplForm(EMPTY_TEMPLATE); setTplModal('create'); }
  function openTplEdit(tpl) {
    setTplForm({
      title: tpl.title, description: tpl.description || '',
      unit_id: String(tpl.unit_id),
      assigned_employee_id: tpl.assigned_employee_id ? String(tpl.assigned_employee_id) : '',
      due_time: tpl.due_time?.slice(0, 5) || '',
      interval_days: String(tpl.interval_days),
      start_date: tpl.start_date?.slice(0, 10) || '',
      quantity: String(tpl.quantity || 1),
      fire_days: bitmaskToDays(tpl.fire_weekdays),
    });
    setTplModal(tpl);
  }
  function closeTplModal() { setTplModal(false); setTplForm(EMPTY_TEMPLATE); }

  function handleTplSubmit(e) {
    e.preventDefault();
    const body = {
      title: tplForm.title, description: tplForm.description || undefined,
      unit_id: parseInt(tplForm.unit_id, 10),
      assigned_employee_id: tplForm.assigned_employee_id ? parseInt(tplForm.assigned_employee_id, 10) : undefined,
      due_time: tplForm.due_time || undefined,
      interval_days: parseInt(tplForm.interval_days, 10),
      quantity: Math.min(40, Math.max(1, parseInt(tplForm.quantity, 10) || 1)),
      fire_weekdays: daysToBitmask(tplForm.fire_days),
      start_date: tplForm.start_date,
    };
    const isEditing = tplModal && tplModal !== 'create';
    if (isEditing) updateTpl.mutate({ id: tplModal.id, body });
    else createTpl.mutate(body);
  }

  function fmtDt(dt) {
    if (!dt) return '—';
    return formatInTimeZone(new Date(dt), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm');
  }

  const pendingServices   = services.filter((sv) => sv.status === 'pending');
  const othersServices    = services.filter((sv) => sv.status !== 'pending');
  const displayedServices = svcTab === 'pending' ? pendingServices : othersServices;
  const allPhotos         = detailModal ? [...(detailModal.photos || [])] : [];
  const beforePhotos      = allPhotos.filter((p) => p.phase === 'before');
  const afterPhotos       = allPhotos.filter((p) => p.phase === 'after');
  const tplBusy           = createTpl.isLoading || updateTpl.isLoading;
  const tplIsEditing      = tplModal && tplModal !== 'create';

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-ink)', margin: 0, letterSpacing: '-0.03em' }}>Serviços</h1>
        {tab === 'services'
          ? <button onClick={() => setModal(true)} style={inkBtn}><Icon d={ICON_PLUS} size={14} color="#fff" strokeWidth={2.5} /> Novo Serviço</button>
          : <button onClick={openTplCreate} style={inkBtn}><Icon d={ICON_PLUS} size={14} color="#fff" strokeWidth={2.5} /> Novo Template</button>
        }
      </div>

      {/* Main tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--color-line)' }}>
        {[{ key: 'services', label: 'Serviços' }, { key: 'templates', label: 'Serviços recorrentes' }].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '9px 20px', fontSize: 14, fontWeight: tab === t.key ? 700 : 600, cursor: 'pointer',
            background: 'none', border: 'none',
            color: tab === t.key ? 'var(--color-primary)' : 'var(--color-muted)',
            borderBottom: `2px solid ${tab === t.key ? 'var(--color-primary)' : 'transparent'}`,
            marginBottom: -2,
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── SERVICES TAB ── */}
      {tab === 'services' && (
        <>
          {/* Sub-tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {[
              { key: 'pending', label: 'Pendentes', count: pendingServices.length },
              { key: 'others',  label: 'Demais',    count: othersServices.length  },
            ].map((t) => (
              <button key={t.key}
                onClick={() => { setSvcTab(t.key); if (t.key === 'others') setFilters((p) => ({ ...p, status: p.status === 'pending' ? '' : p.status })); }}
                style={{
                  padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  border: '1.5px solid',
                  borderColor: svcTab === t.key ? 'var(--color-primary)' : 'var(--color-line)',
                  borderRadius: 8,
                  background: svcTab === t.key ? 'var(--color-primary-soft)' : 'var(--color-hairline)',
                  color: svcTab === t.key ? 'var(--color-primary)' : 'var(--color-muted)',
                  display: 'flex', alignItems: 'center', gap: 7,
                }}>
                {t.label}
                <span style={{
                  minWidth: 20, height: 20, borderRadius: 999, padding: '0 5px',
                  background: svcTab === t.key ? 'var(--color-primary)' : 'var(--color-line)',
                  color: svcTab === t.key ? '#fff' : 'var(--color-muted)',
                  fontSize: 11, fontWeight: 800,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                }}>{t.count}</span>
              </button>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} style={selectStyle}>
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABEL)
                .filter(([k]) => svcTab === 'others' ? k !== 'pending' : k === 'pending')
                .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filters.employeeId} onChange={(e) => setFilters((p) => ({ ...p, employeeId: e.target.value }))} style={selectStyle}>
              <option value="">Todos os funcionários</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
            {(filters.status || filters.employeeId) && (
              <button onClick={() => setFilters({ status: '', employeeId: '' })} style={clearBtn}>Limpar ×</button>
            )}
          </div>

          {/* Bulk actions bar */}
          {selected.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'var(--color-primary-soft)', border: '1px solid rgba(79,70,229,0.2)', borderRadius: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', marginRight: 4 }}>{selected.size} selecionado(s)</span>
              {[
                { label: 'Em andamento', status: 'in_progress',      bg: 'var(--color-primary-soft)', color: 'var(--color-primary)', border: 'var(--color-primary)' },
                { label: 'Concluído',    status: 'done',             bg: 'var(--color-ok-soft)',      color: 'var(--color-ok)',      border: 'var(--color-ok)'      },
                { label: 'c/ Ressalvas', status: 'done_with_issues', bg: 'var(--color-warn-soft)',    color: 'var(--color-warn)',    border: 'var(--color-warn)'    },
                { label: 'Problema',     status: 'problem',          bg: 'var(--color-danger-soft)',  color: 'var(--color-danger)',  border: 'var(--color-danger)'  },
                { label: 'Reabrir',      status: 'pending',          bg: 'var(--color-hairline)',     color: 'var(--color-muted)',   border: 'var(--color-line)'    },
              ].map(({ label, status, bg, color, border }) => (
                <button key={status} onClick={() => bulkStatus.mutate({ ids: [...selected], status })} disabled={bulkStatus.isLoading}
                  style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 7, background: bg, color, border: `1px solid ${border}` }}>
                  {label}
                </button>
              ))}
              <button onClick={() => { if (window.confirm(`Excluir ${selected.size} serviço(s)?`)) bulkDelete.mutate([...selected]); }}
                disabled={bulkDelete.isLoading}
                style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 7, background: 'var(--color-danger-soft)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}>
                Excluir
              </button>
              <button onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 12, cursor: 'pointer', color: 'var(--color-muted)' }}>Cancelar</button>
            </div>
          )}

          {/* Services table */}
          <div style={card}>
            {svcLoading ? (
              <p style={emptyMsg}>Carregando...</p>
            ) : displayedServices.length === 0 ? (
              <p style={emptyMsg}>{svcTab === 'pending' ? 'Nenhum serviço pendente.' : 'Nenhum serviço encontrado.'}</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-hairline)' }}>
                    <th style={{ ...th, width: 36 }}>
                      <input type="checkbox"
                        checked={selected.size === displayedServices.length && displayedServices.length > 0}
                        onChange={(e) => setSelected(e.target.checked ? new Set(displayedServices.map((sv) => sv.id)) : new Set())}
                      />
                    </th>
                    <th style={{ ...th, width: 36 }}>#</th>
                    {['Título', 'Funcionário', 'Agendamento', 'Conclusão', 'Prazo', 'Status', 'Ações'].map((h) => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedServices.map((sv, idx) => (
                    <tr key={sv.id} style={{ borderBottom: '1px solid var(--color-hairline)', background: selected.has(sv.id) ? 'var(--color-primary-soft)' : undefined }}>
                      <td style={{ ...td, width: 36 }}>
                        <input type="checkbox" checked={selected.has(sv.id)}
                          onChange={(e) => setSelected((prev) => { const next = new Set(prev); e.target.checked ? next.add(sv.id) : next.delete(sv.id); return next; })}
                        />
                      </td>
                      <td style={{ ...td, width: 36, color: 'var(--color-subtle)', fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 12 }}>#{idx + 1}</td>
                      <td style={td}>
                        <div style={{ fontWeight: 600, color: 'var(--color-ink)', fontSize: 13 }}>{sv.title}</div>
                        {sv.description && <div style={{ fontSize: 11, color: 'var(--color-subtle)', marginTop: 2 }}>{sv.description.slice(0, 60)}{sv.description.length > 60 ? '…' : ''}</div>}
                      </td>
                      <td style={td}>
                        {sv.employee_name ? (
                          <span style={{ fontSize: 13, color: 'var(--color-ink)' }}>{sv.employee_name}</span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>Sem responsável</span>
                            <button onClick={() => { setAssignModal(sv); setAssignEmpId(''); }}
                              style={{ background: 'none', border: '1px solid var(--color-line)', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 600 }}>
                              Atribuir
                            </button>
                          </span>
                        )}
                      </td>
                      <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{fmtDateOnly(sv.scheduled_date)}</td>
                      <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {sv.finished_at ? new Date(sv.finished_at).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{sv.due_time ? sv.due_time.slice(0, 5) : '—'}</td>
                      <td style={td}><ServiceStatusBadge status={sv.status} label={STATUS_LABEL[sv.status]} /></td>
                      <td style={td}>
                        <button onClick={() => openDetail(sv)} style={actionBtn}>
                          <Icon d={ICON_EYE} size={13} color="var(--color-muted)" /> Ver
                        </button>
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
        <div style={card}>
          {tplLoading ? (
            <p style={emptyMsg}>Carregando...</p>
          ) : templates.length === 0 ? (
            <p style={emptyMsg}>Nenhum template cadastrado.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Título', 'Posto', 'Responsável', 'Intervalo', 'Qtd.', 'Próximo disparo', 'Status', 'Ações'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid var(--color-hairline)', color: 'var(--color-muted)', fontWeight: 700, whiteSpace: 'nowrap', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {templates.map((tpl) => (
                    <tr key={tpl.id} style={{ borderBottom: '1px solid var(--color-hairline)' }}>
                      <td style={tplTd}><span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>{tpl.title}</span></td>
                      <td style={tplTd}>
                        {tpl.unit_name}
                        <span style={{ fontSize: 11, color: 'var(--color-subtle)', marginLeft: 6, fontFamily: 'var(--font-mono)' }}>{tpl.unit_code}</span>
                      </td>
                      <td style={tplTd}>
                        {tpl.employee_name
                          ? tpl.employee_name
                          : <span style={{ background: 'rgba(245,158,11,0.1)', color: '#b45309', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>A definir</span>}
                      </td>
                      <td style={{ ...tplTd, fontFamily: 'var(--font-mono)', fontSize: 12 }}>A cada {tpl.interval_days}d</td>
                      <td style={{ ...tplTd, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{tpl.quantity || 1}</td>
                      <td style={{ ...tplTd, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{fmtDt(tpl.next_run_at)}</td>
                      <td style={tplTd}>
                        <span style={{
                          borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700,
                          background: tpl.active ? 'rgba(16,185,129,0.1)' : 'var(--color-hairline)',
                          color: tpl.active ? '#059669' : 'var(--color-muted)',
                        }}>
                          {tpl.active ? 'Ativo' : 'Pausado'}
                        </span>
                      </td>
                      <td style={{ ...tplTd, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => openTplEdit(tpl)} style={actionBtn}>Editar</button>
                        <button onClick={() => toggleTpl.mutate(tpl.id)} style={{ ...actionBtn, color: tpl.active ? '#d97706' : '#059669' }}>
                          {tpl.active ? 'Pausar' : 'Ativar'}
                        </button>
                        <button onClick={() => { setFireDate(tpl.next_run_at ? String(tpl.next_run_at).slice(0, 10) : ''); setFireModal(tpl); }}
                          disabled={fireTpl.isLoading} style={{ ...actionBtn, color: '#0891b2' }}>Disparar</button>
                        <button onClick={() => setConfirmDelete(tpl)} style={{ ...actionBtn, color: 'var(--color-danger)' }}>Excluir</button>
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
        <Overlay onClose={() => setModal(false)}>
          <ModalCard>
            <ModalHeader title="Novo Serviço" onClose={() => setModal(false)} />
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
                  <input type="date" value={form.scheduled_date} onChange={(e) => setForm((p) => ({ ...p, scheduled_date: e.target.value }))} required style={inputStyle} />
                </Field>
                <Field label="Horário limite">
                  <input type="time" value={form.due_time} onChange={(e) => setForm((p) => ({ ...p, due_time: e.target.value }))} style={inputStyle} />
                </Field>
              </div>
              <ModalFooter>
                <button type="button" onClick={() => setModal(false)} style={outlineBtn}>Cancelar</button>
                <button type="submit" disabled={createSvc.isLoading} style={{ ...inkBtn, opacity: createSvc.isLoading ? 0.7 : 1 }}>
                  {createSvc.isLoading ? 'Criando...' : 'Criar Serviço'}
                </button>
              </ModalFooter>
            </form>
          </ModalCard>
        </Overlay>
      )}

      {/* ── MODAL: detalhe do serviço ── */}
      {detailModal && (
        <Overlay onClose={() => setDetail(null)}>
          <ModalCard maxWidth={600}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h2 style={modalTitle}>{detailModal.title}</h2>
                <ServiceStatusBadge status={detailModal.status} label={STATUS_LABEL[detailModal.status]} />
              </div>
              <button onClick={() => setDetail(null)} style={iconCloseBtn}><Icon d={ICON_CLOSE} size={16} color="var(--color-muted)" /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16, fontSize: 13 }}>
              <InfoRow label="Funcionário" value={detailModal.employee_name} />
              <InfoRow label="Unidade"     value={detailModal.unit_name} />
              <InfoRow label="Data"        value={fmtDateOnly(detailModal.scheduled_date)} />
              <InfoRow label="Prazo"       value={detailModal.due_time?.slice(0, 5) || '—'} />
              <InfoRow label="Iniciado em" value={detailModal.started_at ? new Date(detailModal.started_at).toLocaleString('pt-BR') : '—'} />
              <InfoRow label="Concluído em" value={detailModal.finished_at ? new Date(detailModal.finished_at).toLocaleString('pt-BR') : '—'} />
            </div>

            {detailModal.description && (
              <div style={{ marginBottom: 14, padding: '12px 14px', background: 'var(--color-hairline)', borderRadius: 8, border: '1px solid var(--color-line)', fontSize: 13, color: 'var(--color-ink)' }}>
                {detailModal.description}
              </div>
            )}
            {detailModal.issue_description && (
              <div style={{ marginBottom: 14, padding: '12px 14px', background: 'rgba(245,158,11,0.08)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.25)', fontSize: 13, color: '#b45309' }}>
                <strong>Ressalvas:</strong> {detailModal.issue_description}
              </div>
            )}
            {detailModal.problem_description && (
              <div style={{ marginBottom: 14, padding: '12px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', fontSize: 13, color: 'var(--color-danger)' }}>
                <strong>Problema reportado:</strong> {detailModal.problem_description}
              </div>
            )}

            <PhotoSection title="Fotos — Antes" photos={beforePhotos} photoSrc={photoSrc} onLoad={loadPhoto} serviceId={detailModal.id}
              onDelete={(photoId) => deletePhoto.mutate({ serviceId: detailModal.id, photoId })} />
            <PhotoSection title="Fotos — Depois" photos={afterPhotos} photoSrc={photoSrc} onLoad={loadPhoto} serviceId={detailModal.id}
              onDelete={(photoId) => deletePhoto.mutate({ serviceId: detailModal.id, photoId })} />
            {allPhotos.length === 0 && (
              <p style={{ color: 'var(--color-subtle)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>Nenhuma foto registrada.</p>
            )}

            <div style={{ marginTop: 20, borderTop: '1px solid var(--color-hairline)', paddingTop: 16 }}>
              {!['done', 'done_with_issues'].includes(detailModal.status) && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Alterar status</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {detailModal.status !== 'in_progress' && (
                      <button onClick={() => updateStatus.mutate({ id: detailModal.id, status: 'in_progress' })} disabled={updateStatus.isLoading}
                        style={{ ...statusBtn, background: 'var(--color-primary-soft)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}>
                        <Icon d={ICON_REFRESH} size={12} color="var(--color-primary)" /> Em andamento
                      </button>
                    )}
                    <button onClick={() => updateStatus.mutate({ id: detailModal.id, status: 'done' })} disabled={updateStatus.isLoading}
                      style={{ ...statusBtn, background: 'var(--color-ok-soft)', color: 'var(--color-ok)', border: '1px solid var(--color-ok)' }}>
                      <Icon d={ICON_CHECK} size={12} color="var(--color-ok)" /> Concluído
                    </button>
                    {detailModal.status !== 'problem' && (
                      <button onClick={() => updateStatus.mutate({ id: detailModal.id, status: 'problem' })} disabled={updateStatus.isLoading}
                        style={{ ...statusBtn, background: 'var(--color-danger-soft)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}>
                        <Icon d={ICON_WARN} size={12} color="var(--color-danger)" /> Problema
                      </button>
                    )}
                  </div>
                </div>
              )}
              {['done', 'done_with_issues'].includes(detailModal.status) && (
                <div style={{ marginBottom: 12 }}>
                  <button onClick={() => updateStatus.mutate({ id: detailModal.id, status: 'in_progress' })} disabled={updateStatus.isLoading}
                    style={{ ...statusBtn, background: 'var(--color-primary-soft)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}>
                    <Icon d={ICON_REFRESH} size={12} color="var(--color-primary)" /> Reabrir serviço
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => openReschedule(detailModal)} style={{ ...outlineBtn, borderColor: '#0891b2', color: '#0891b2' }}>
                  <Icon d={ICON_CALENDAR} size={14} color="#0891b2" /> Reagendar
                </button>
                <button
                  onClick={() => { if (window.confirm(`Excluir "${detailModal.title}"?`)) deleteSvc.mutate(detailModal.id); }}
                  disabled={deleteSvc.isLoading}
                  style={{ ...inkBtn, background: 'var(--color-danger)' }}>
                  <Icon d={ICON_TRASH} size={14} color="#fff" />
                  {deleteSvc.isLoading ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </ModalCard>
        </Overlay>
      )}

      {/* ── MODAL: atribuir funcionário ── */}
      {assignModal && (
        <Overlay onClose={() => { setAssignModal(null); setAssignEmpId(''); }}>
          <ModalCard maxWidth={400}>
            <ModalHeader title="Atribuir funcionário" onClose={() => { setAssignModal(null); setAssignEmpId(''); }} />
            <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 16 }}>Serviço: <strong style={{ color: 'var(--color-ink)' }}>{assignModal.title}</strong></p>
            <select style={{ ...inputStyle, marginBottom: 20 }} value={assignEmpId} onChange={(e) => setAssignEmpId(e.target.value)}>
              <option value="">Selecione o funcionário</option>
              {assignEmployees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
            </select>
            <ModalFooter>
              <button onClick={() => { setAssignModal(null); setAssignEmpId(''); }} style={outlineBtn}>Cancelar</button>
              <button
                onClick={() => assignSvc.mutate({ id: assignModal.id, assigned_employee_id: parseInt(assignEmpId, 10) })}
                disabled={!assignEmpId || assignSvc.isLoading}
                style={{ ...inkBtn, opacity: !assignEmpId ? 0.5 : 1 }}>
                {assignSvc.isLoading ? 'Salvando...' : 'Atribuir'}
              </button>
            </ModalFooter>
          </ModalCard>
        </Overlay>
      )}

      {/* ── MODAL: reagendar ── */}
      {rescheduleModal && (
        <Overlay onClose={() => setReschedule(null)}>
          <ModalCard>
            <ModalHeader title="Reagendar Serviço" onClose={() => setReschedule(null)} />
            <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 16 }}>{rescheduleModal.title}</p>
            <form onSubmit={(e) => { e.preventDefault(); rescheduleSvc.mutate({ id: rescheduleModal.id, body: rescheduleForm }); }}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Nova data *">
                  <input type="date" value={rescheduleForm.scheduled_date}
                    onChange={(e) => setRescheduleForm((p) => ({ ...p, scheduled_date: e.target.value }))} required style={inputStyle} />
                </Field>
                <Field label="Novo horário limite">
                  <input type="time" value={rescheduleForm.due_time}
                    onChange={(e) => setRescheduleForm((p) => ({ ...p, due_time: e.target.value }))} style={inputStyle} />
                </Field>
              </div>
              <ModalFooter>
                <button type="button" onClick={() => setReschedule(null)} style={outlineBtn}>Cancelar</button>
                <button type="submit" disabled={rescheduleSvc.isLoading} style={{ ...inkBtn, opacity: rescheduleSvc.isLoading ? 0.7 : 1 }}>
                  {rescheduleSvc.isLoading ? 'Salvando...' : 'Confirmar'}
                </button>
              </ModalFooter>
            </form>
          </ModalCard>
        </Overlay>
      )}

      {/* ── MODAL: criar/editar template ── */}
      {tplModal && (
        <Overlay onClose={closeTplModal}>
          <ModalCard maxWidth={520}>
            <ModalHeader title={tplIsEditing ? 'Editar Template' : 'Novo Template'} onClose={closeTplModal} />
            <form onSubmit={handleTplSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Título *">
                <input style={inputStyle} value={tplForm.title} onChange={(e) => setTplForm((p) => ({ ...p, title: e.target.value }))} required />
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
                  onChange={(e) => setTplForm((p) => ({ ...p, assigned_employee_id: e.target.value }))} disabled={!tplForm.unit_id}>
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
              <div style={{ display: 'grid', gridTemplateColumns: tplForm.fire_days.some(Boolean) ? '1fr' : '1fr 1fr', gap: 10 }}>
                {!tplForm.fire_days.some(Boolean) && (
                  <Field label="Intervalo em dias *">
                    <input type="number" min={1} style={inputStyle} value={tplForm.interval_days}
                      onChange={(e) => setTplForm((p) => ({ ...p, interval_days: e.target.value }))} required />
                  </Field>
                )}
                <Field label="Qtd. por disparo *">
                  <input type="number" min={1} max={40} style={inputStyle} value={tplForm.quantity}
                    onChange={(e) => setTplForm((p) => ({ ...p, quantity: e.target.value }))} required />
                </Field>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>Dias de disparo</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {DAY_LABELS.map((lbl, i) => (
                    <label key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                      borderRadius: 8, border: `1.5px solid ${tplForm.fire_days[i] ? 'var(--color-primary)' : 'var(--color-line)'}`,
                      background: tplForm.fire_days[i] ? 'var(--color-primary-soft)' : 'var(--color-hairline)',
                      cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      color: tplForm.fire_days[i] ? 'var(--color-primary)' : 'var(--color-muted)',
                    }}>
                      <input type="checkbox" checked={tplForm.fire_days[i]}
                        onChange={(e) => setTplForm((p) => { const days = [...p.fire_days]; days[i] = e.target.checked; return { ...p, fire_days: days }; })}
                        style={{ accentColor: 'var(--color-primary)', width: 14, height: 14 }} />
                      {lbl}
                    </label>
                  ))}
                </div>
                {tplForm.fire_days.every(Boolean) && (
                  <p style={{ fontSize: 11, color: 'var(--color-subtle)', marginTop: 6 }}>Todos os dias selecionados — dispara diariamente.</p>
                )}
              </div>
              <ModalFooter>
                <button type="button" onClick={closeTplModal} style={outlineBtn} disabled={tplBusy}>Cancelar</button>
                <button type="submit" style={inkBtn} disabled={tplBusy}>{tplBusy ? 'Salvando...' : 'Salvar'}</button>
              </ModalFooter>
            </form>
          </ModalCard>
        </Overlay>
      )}

      {/* ── MODAL: disparar template ── */}
      {fireModal && (
        <Overlay onClose={() => setFireModal(null)}>
          <ModalCard maxWidth={400}>
            <ModalHeader title="Disparar Template" onClose={() => setFireModal(null)} />
            <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 16 }}>
              <strong style={{ color: 'var(--color-ink)' }}>"{fireModal.title}"</strong> — Para qual data?
            </p>
            <form onSubmit={(e) => { e.preventDefault(); fireTpl.mutate({ id: fireModal.id, scheduled_date: fireDate }); }}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Data do agendamento *">
                <input type="date" value={fireDate} onChange={(e) => setFireDate(e.target.value)} required style={inputStyle} />
              </Field>
              <ModalFooter>
                <button type="button" onClick={() => setFireModal(null)} style={outlineBtn}>Cancelar</button>
                <button type="submit" disabled={fireTpl.isLoading}
                  style={{ ...inkBtn, background: 'var(--color-info)', opacity: fireTpl.isLoading ? 0.7 : 1 }}>
                  {fireTpl.isLoading ? 'Disparando...' : 'Disparar'}
                </button>
              </ModalFooter>
            </form>
          </ModalCard>
        </Overlay>
      )}

      {/* ── MODAL: confirmar exclusão template ── */}
      {confirmDelete && (
        <Overlay onClose={() => setConfirmDelete(null)}>
          <ModalCard maxWidth={400}>
            <ModalHeader title="Excluir template?" onClose={() => setConfirmDelete(null)} />
            <p style={{ fontSize: 14, color: 'var(--color-ink)', marginBottom: 20 }}>
              O template <strong>"{confirmDelete.title}"</strong> será removido. Os serviços já gerados não serão afetados.
            </p>
            <ModalFooter>
              <button onClick={() => setConfirmDelete(null)} style={outlineBtn}>Cancelar</button>
              <button onClick={() => deleteTpl.mutate(confirmDelete.id)}
                style={{ ...inkBtn, background: 'var(--color-danger)' }} disabled={deleteTpl.isLoading}>
                {deleteTpl.isLoading ? 'Removendo...' : 'Excluir'}
              </button>
            </ModalFooter>
          </ModalCard>
        </Overlay>
      )}
    </div>
  );
}

/* ── Sub-components ── */

function Overlay({ children, onClose }) {
  const mouseDownTarget = useRef(null);
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(9,9,11,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onMouseDown={(e) => { mouseDownTarget.current = e.target; }}
      onMouseUp={(e) => { if (mouseDownTarget.current === e.currentTarget && e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
}

function ModalCard({ children, maxWidth = 480 }) {
  return (
    <div
      style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '28px 24px', width: '100%', maxWidth, boxShadow: '0 24px 64px -12px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

function ModalHeader({ title, onClose }) {
  function Icon({ d, size = 16, color = 'currentColor', strokeWidth = 1.8 }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-ink)', margin: 0, letterSpacing: '-0.03em' }}>{title}</h2>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, color: 'var(--color-muted)' }}>
        <Icon d="M18 6 6 18M6 6l12 12" size={16} color="var(--color-muted)" />
      </button>
    </div>
  );
}

function ModalFooter({ children }) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <span style={{ color: 'var(--color-subtle)', fontWeight: 600, fontSize: 12 }}>{label}: </span>
      <span style={{ color: 'var(--color-ink)', fontSize: 13 }}>{value || '—'}</span>
    </div>
  );
}

function PhotoSection({ title, photos, photoSrc, onLoad, serviceId, onDelete }) {
  if (photos.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{title}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {photos.map((photo) => {
          onLoad({ ...photo, service_order_id: serviceId });
          return (
            <div key={photo.id} style={{ position: 'relative', width: 100, height: 100, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-line)', background: 'var(--color-hairline)' }}>
              {photoSrc[photo.id]
                ? <img src={photoSrc[photo.id]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-subtle)', fontSize: 12 }}>…</div>
              }
              <button onClick={() => { if (window.confirm('Apagar esta foto?')) onDelete(photo.id); }}
                style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(239,68,68,0.85)', border: 'none', borderRadius: '50%', width: 22, height: 22, color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Styles ── */
const inkBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 7,
  padding: '9px 16px', background: 'var(--color-primary)', border: 'none',
  borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const outlineBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 16px', border: '1.5px solid var(--color-line)',
  borderRadius: 8, fontSize: 13, cursor: 'pointer', color: 'var(--color-ink)',
  background: 'var(--bg-card)', fontWeight: 600,
};
const selectStyle = {
  padding: '8px 12px', border: '1.5px solid var(--color-line)',
  borderRadius: 8, fontSize: 13, color: 'var(--color-ink)',
  background: 'var(--bg-card)', outline: 'none',
};
const clearBtn = {
  padding: '8px 14px', background: 'var(--color-hairline)',
  border: '1.5px solid var(--color-line)', borderRadius: 8,
  fontSize: 13, cursor: 'pointer', color: 'var(--color-muted)', fontWeight: 600,
};
const card     = { background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--color-line)', overflow: 'hidden' };
const th       = { padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' };
const td       = { padding: '13px 16px', fontSize: 13, color: 'var(--color-ink)', verticalAlign: 'middle' };
const emptyMsg = { padding: 24, color: 'var(--color-muted)', textAlign: 'center' };
const tplTd    = { padding: '11px 12px', borderBottom: '1px solid var(--color-hairline)', verticalAlign: 'middle', color: 'var(--color-ink)' };
const actionBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '4px 11px', fontSize: 12, cursor: 'pointer',
  border: '1px solid var(--color-line)', borderRadius: 6,
  background: 'var(--color-hairline)', color: 'var(--color-muted)', fontWeight: 600,
};
const statusBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 8 };
const modalTitle = { fontSize: 18, fontWeight: 700, color: 'var(--color-ink)', marginBottom: 8, marginTop: 0, letterSpacing: '-0.03em' };
const inputStyle = {
  padding: '9px 12px', border: '1.5px solid var(--color-line)',
  borderRadius: 8, fontSize: 14, color: 'var(--color-ink)',
  outline: 'none', width: '100%', boxSizing: 'border-box',
  background: 'var(--bg-card)',
};
const iconCloseBtn = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
