import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api          from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const ICONS = {
  bell:     'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0',
  services: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
  clock:    'M12 2a10 10 0 1 1 0 20A10 10 0 0 1 12 2z M12 6v6l4 2',
  blocked:  'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M4.93 4.93l14.14 14.14',
  send:     'M22 2L11 13 M22 2L15 22l-4-9-9-4 22-7z',
  trash:    'M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  check:    'M20 6L9 17l-5-5',
  x:        'M18 6L6 18M6 6l12 12',
};

const TYPE_LABEL = {
  service_assigned: 'Serviço atribuído',
  service_late:     'Serviço atrasado',
  service_problem:  'Problema relatado',
  manual:           'Manual',
};
const TYPE_COLOR = {
  service_assigned: '#4f46e5',
  service_late:     '#f59e0b',
  service_problem:  '#ef4444',
  manual:           '#8b5cf6',
};
const TYPE_ICON = {
  service_assigned: 'services',
  service_late:     'clock',
  service_problem:  'blocked',
  manual:           'bell',
};

const EMPTY_SEND = { employee_id: '', unit_id: '', target: 'employee', title: '', body: '' };

function useNotifications(filters) {
  return useQuery({
    queryKey: ['admin-notifications', filters],
    queryFn:  () => api.get('/notifications', { params: filters }).then((r) => r.data),
    keepPreviousData: true,
    refetchInterval: 30000,
  });
}
function useEmployees() {
  return useQuery({ queryKey: ['employees-active'], queryFn: () => api.get('/employees').then((r) => r.data.employees || r.data) });
}
function useUnits() {
  return useQuery({ queryKey: ['units'], queryFn: () => api.get('/units').then((r) => r.data.units || r.data) });
}

export default function AdminNotificationsPage() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  const [filters,   setFilters]   = useState({ employeeId: '' });
  const [sendModal, setSendModal] = useState(false);
  const [selected,  setSelected]  = useState(null);
  const [form,      setForm]      = useState(EMPTY_SEND);

  const { data, isLoading } = useNotifications(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
  );
  const notifications = data?.notifications || [];
  const unread        = data?.unread ?? 0;
  const readCount     = notifications.filter((n) => n.read).length;

  const { data: employees = [] } = useEmployees();
  const { data: units = [] }     = useUnits();

  const markReadMutation = useMutation({
    mutationFn: (id) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries(['admin-notifications']),
  });
  const markAllMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => { success('Todas marcadas como lidas.'); queryClient.invalidateQueries(['admin-notifications']); },
    onError:   () => error('Erro ao marcar notificações.'),
  });
  const sendMutation = useMutation({
    mutationFn: (body) => api.post('/notifications/send', body),
    onSuccess: (res) => {
      success(`Notificação enviada para ${res.data.sent} destinatário(s).`);
      setSendModal(false); setForm(EMPTY_SEND);
      queryClient.invalidateQueries(['admin-notifications']);
    },
    onError: (err) => error(err.response?.data?.error || 'Erro ao enviar notificação.'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/notifications/${id}`),
    onSuccess: (_, id) => {
      success('Notificação excluída.');
      if (selected?.id === id) setSelected(null);
      queryClient.invalidateQueries(['admin-notifications']);
    },
    onError: (err) => error(err.response?.data?.error || 'Erro ao excluir notificação.'),
  });
  const deleteReadMutation = useMutation({
    mutationFn: () => api.delete('/notifications/read'),
    onSuccess: (res) => {
      const deleted = res.data?.deleted ?? 0;
      success(deleted > 0 ? `${deleted} notificação(ões) lida(s) excluída(s).` : 'Nenhuma notificação lida para excluir.');
      if (selected?.read) setSelected(null);
      queryClient.invalidateQueries(['admin-notifications']);
    },
    onError: (err) => error(err.response?.data?.error || 'Erro ao excluir notificações lidas.'),
  });

  function openNotif(n) {
    setSelected(n);
    if (!n.read) markReadMutation.mutate(n.id);
  }
  function handleDelete(n, e) {
    e?.stopPropagation();
    if (!n || deleteMutation.isLoading) return;
    if (!window.confirm(`Deseja excluir a notificação "${n.title}"?`)) return;
    deleteMutation.mutate(n.id);
  }
  function handleDeleteRead() {
    if (deleteReadMutation.isLoading || readCount === 0) return;
    if (!window.confirm(`Excluir todas as ${readCount} notificações lidas?`)) return;
    deleteReadMutation.mutate();
  }
  function handleSend(e) {
    e.preventDefault();
    const payload = { title: form.title, body: form.body };
    if (form.target === 'employee') payload.employee_id = parseInt(form.employee_id, 10);
    else payload.unit_id = parseInt(form.unit_id, 10);
    sendMutation.mutate(payload);
  }

  function fmtDate(dt) {
    return new Date(dt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div>
      {/* Cabeçalho */}
      <div style={st.header}>
        <div>
          <h1 style={st.title}>Notificações</h1>
          {unread > 0 && (
            <p style={st.subtitle}>{unread} não {unread === 1 ? 'lida' : 'lidas'}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {readCount > 0 && (
            <button onClick={handleDeleteRead} disabled={deleteReadMutation.isLoading} style={st.dangerBtn}>
              <Icon d={ICONS.trash} size={14} />
              {deleteReadMutation.isLoading ? 'Excluindo...' : 'Excluir lidas'}
            </button>
          )}
          {unread > 0 && (
            <button onClick={() => markAllMutation.mutate()} disabled={markAllMutation.isLoading} style={st.outlineBtn}>
              <Icon d={ICONS.check} size={14} />
              {markAllMutation.isLoading ? 'Aguarde...' : 'Marcar todas como lidas'}
            </button>
          )}
          <button onClick={() => setSendModal(true)} style={st.primaryBtn}>
            <Icon d={ICONS.send} size={14} />
            Enviar Notificação
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={st.filters}>
        <select value={filters.employeeId} onChange={(e) => setFilters({ employeeId: e.target.value })} style={st.select}>
          <option value="">Todos os funcionários</option>
          {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
        </select>
        {filters.employeeId && (
          <button onClick={() => setFilters({ employeeId: '' })} style={st.clearBtn}>
            <Icon d={ICONS.x} size={13} />
            Limpar
          </button>
        )}
      </div>

      {/* Lista */}
      <div style={st.card}>
        {isLoading ? (
          <p style={st.empty}>Carregando...</p>
        ) : notifications.length === 0 ? (
          <p style={st.empty}>Nenhuma notificação encontrada.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-hairline)' }}>
                {['Tipo', 'Funcionário', 'Título', 'Mensagem', 'Push', 'Data', ''].map((h) => (
                  <th key={h} style={st.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => {
                const color   = TYPE_COLOR[n.type] || 'var(--color-subtle)';
                const iconKey = TYPE_ICON[n.type]  || 'bell';
                return (
                  <tr
                    key={n.id}
                    onClick={() => openNotif(n)}
                    style={{
                      borderBottom: '1px solid var(--color-hairline)',
                      background: n.read ? 'transparent' : 'var(--color-primary-soft)',
                      cursor: 'pointer', transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-hairline)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = n.read ? 'transparent' : 'var(--color-primary-soft)'; }}
                  >
                    {/* Tipo com ícone em quadrado colorido */}
                    <td style={st.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                          background: color + '18',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color,
                        }}>
                          <Icon d={ICONS[iconKey]} size={13} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                          {TYPE_LABEL[n.type] || n.type}
                        </span>
                      </div>
                    </td>
                    <td style={st.td}>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{n.employee_name}</span>
                    </td>
                    <td style={st.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {!n.read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />}
                        <span style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: 'var(--text-primary)' }}>{n.title}</span>
                      </div>
                    </td>
                    <td style={{ ...st.td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{n.body}</span>
                    </td>
                    <td style={st.td}>
                      {n.push_sent
                        ? <span style={{ fontSize: 12, color: 'var(--color-ok)', fontWeight: 600 }}>✓ Enviado</span>
                        : <span style={{ fontSize: 12, color: 'var(--color-line)' }}>—</span>}
                    </td>
                    <td style={{ ...st.td, fontSize: 12, color: 'var(--color-muted)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                      {fmtDate(n.created_at)}
                    </td>
                    <td style={{ ...st.td, whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(n, e)}
                        disabled={deleteMutation.isLoading}
                        style={st.deleteRowBtn}
                      >
                        <Icon d={ICONS.trash} size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal detalhe de notificação */}
      {selected && (
        <ModalOverlay onClose={() => setSelected(null)}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Ícone grande */}
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: (TYPE_COLOR[selected.type] || 'var(--color-subtle)') + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: TYPE_COLOR[selected.type] || 'var(--color-subtle)',
                flexShrink: 0,
              }}>
                <Icon d={ICONS[TYPE_ICON[selected.type] || 'bell']} size={20} />
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                color: TYPE_COLOR[selected.type] || 'var(--color-subtle)',
                background: (TYPE_COLOR[selected.type] || 'var(--color-subtle)') + '18',
                padding: '3px 9px', borderRadius: 'var(--radius-full)',
              }}>
                {TYPE_LABEL[selected.type] || selected.type}
              </span>
            </div>
            <button onClick={() => setSelected(null)} style={st.closeBtn}>
              <Icon d={ICONS.x} size={15} />
            </button>
          </div>

          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.4 }}>
            {selected.title}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.7, marginBottom: 16 }}>
            {selected.body}
          </p>

          {/* Metadados */}
          <div style={{ background: 'var(--color-hairline)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <MetaRow label="Funcionário"  value={selected.employee_name} />
            <MetaRow label="Data"         value={fmtDate(selected.created_at)} />
            <MetaRow label="Push enviado" value={selected.push_sent ? '✓ Sim' : '— Não'} />
            <MetaRow label="Status"       value={selected.read ? 'Lida' : 'Não lida'} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={(e) => handleDelete(selected, e)} disabled={deleteMutation.isLoading} style={st.dangerBtn}>
              <Icon d={ICONS.trash} size={13} />
              Excluir
            </button>
            <button onClick={() => setSelected(null)} style={st.primaryBtn}>
              Fechar
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* Modal enviar notificação */}
      {sendModal && (
        <ModalOverlay onClose={() => setSendModal(false)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={st.modalTitle}>Enviar Notificação</h2>
            <button onClick={() => setSendModal(false)} style={st.closeBtn}><Icon d={ICONS.x} size={15} /></button>
          </div>
          <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['employee','Funcionário específico'],['unit','Toda a unidade']].map(([val, lbl]) => (
                <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                  <input type="radio" name="target" value={val} checked={form.target === val}
                    onChange={(e) => setForm((p) => ({ ...p, target: e.target.value, employee_id: '', unit_id: '' }))} />
                  {lbl}
                </label>
              ))}
            </div>
            {form.target === 'employee' ? (
              <FormField label="Funcionário *">
                <select value={form.employee_id} onChange={(e) => setForm((p) => ({ ...p, employee_id: e.target.value }))} required style={inputStyle}>
                  <option value="">Selecione</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </FormField>
            ) : (
              <FormField label="Unidade *">
                <select value={form.unit_id} onChange={(e) => setForm((p) => ({ ...p, unit_id: e.target.value }))} required style={inputStyle}>
                  <option value="">Selecione</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </FormField>
            )}
            <FormField label="Título *">
              <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required placeholder="Ex: Lembrete importante" style={inputStyle} />
            </FormField>
            <FormField label="Mensagem *">
              <textarea value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} required rows={3} placeholder="Texto da notificação..." style={{ ...inputStyle, resize: 'vertical' }} />
            </FormField>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" onClick={() => setSendModal(false)} style={st.outlineBtn}>Cancelar</button>
              <button type="submit" disabled={sendMutation.isLoading} style={{ ...st.primaryBtn, opacity: sendMutation.isLoading ? 0.7 : 1 }}>
                <Icon d={ICONS.send} size={13} />
                {sendMutation.isLoading ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}
    </div>
  );
}

function ModalOverlay({ children, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(9,9,11,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '22px 22px', width: '100%', maxWidth: 480, boxShadow: '0 24px 48px rgba(0,0,0,0.22)', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)' }}>{label}</label>
      {children}
    </div>
  );
}

function MetaRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
      <span style={{ color: 'var(--color-muted)', fontWeight: 600, minWidth: 100 }}>{label}:</span>
      <span style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

const inputStyle = {
  padding: '8px 11px', border: '1px solid var(--border-default)',
  borderRadius: 8, fontSize: 13, color: 'var(--text-primary)',
  background: 'var(--bg-card)', outline: 'none', width: '100%',
  fontFamily: 'var(--font-sans)',
};

const st = {
  header:     { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
  title:      { fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em' },
  subtitle:   { fontSize: 12, color: 'var(--color-muted)', marginTop: 2 },
  modalTitle: { fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' },
  filters:    { display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  select: {
    padding: '6px 10px', border: '1px solid var(--border-default)', borderRadius: 8,
    fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-card)', outline: 'none',
    fontFamily: 'var(--font-sans)',
  },
  clearBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '6px 10px', background: 'var(--color-hairline)',
    border: '1px solid var(--border-default)', borderRadius: 8,
    fontSize: 12, cursor: 'pointer', color: 'var(--color-muted)',
    fontFamily: 'var(--font-sans)', fontWeight: 500,
  },
  card:  { background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-default)', overflow: 'hidden' },
  th: {
    padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600,
    color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em',
    background: 'var(--color-hairline)',
  },
  td:     { padding: '12px 14px', fontSize: 13, color: 'var(--color-muted)', verticalAlign: 'middle' },
  empty:  { padding: 24, color: 'var(--color-muted)', fontSize: 13 },
  primaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 13px', border: 'none', borderRadius: 8,
    fontSize: 13, cursor: 'pointer', color: '#fff', background: 'var(--color-primary)',
    fontWeight: 600, fontFamily: 'var(--font-sans)',
  },
  outlineBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 13px', border: '1px solid var(--border-default)', borderRadius: 8,
    fontSize: 13, cursor: 'pointer', color: 'var(--text-primary)', background: 'var(--bg-card)',
    fontWeight: 500, fontFamily: 'var(--font-sans)',
  },
  dangerBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 13px', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
    fontSize: 13, cursor: 'pointer', color: 'var(--color-danger)', background: 'var(--color-danger-soft)',
    fontWeight: 600, fontFamily: 'var(--font-sans)',
  },
  deleteRowBtn: {
    width: 28, height: 28, background: 'none', border: 'none',
    borderRadius: 6, cursor: 'pointer', color: 'var(--color-subtle)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'color 0.15s',
  },
  closeBtn: {
    width: 28, height: 28, background: 'var(--color-hairline)',
    border: 'none', borderRadius: 6, cursor: 'pointer',
    color: 'var(--color-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
};
