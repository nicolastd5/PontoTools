import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

function useNotifications(filters) {
  return useQuery({
    queryKey: ['admin-notifications', filters],
    queryFn: () => api.get('/notifications', { params: filters }).then((r) => r.data),
    keepPreviousData: true,
    refetchInterval: 30000,
  });
}
function useEmployees() {
  return useQuery({
    queryKey: ['employees-active'],
    queryFn: () => api.get('/employees').then((r) => r.data.employees || r.data),
  });
}
function useUnits() {
  return useQuery({
    queryKey: ['units'],
    queryFn: () => api.get('/units').then((r) => r.data.units || r.data),
  });
}

const TYPE_LABEL = {
  service_assigned: 'Serviço atribuído',
  service_late:     'Serviço atrasado',
  service_problem:  'Problema relatado',
  manual:           'Manual',
};
const TYPE_COLOR = {
  service_assigned: { bg: '#dbeafe', color: '#1e40af' },
  service_late:     { bg: '#fef9c3', color: '#854d0e' },
  service_problem:  { bg: '#fee2e2', color: '#991b1b' },
  manual:           { bg: '#f3e8ff', color: '#7e22ce' },
};

const EMPTY_SEND = { employee_id: '', unit_id: '', target: 'employee', title: '', body: '' };

export default function AdminNotificationsPage() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  const [filters, setFilters]   = useState({ employeeId: '' });
  const [modal, setModal]       = useState(false);
  const [form, setForm]         = useState(EMPTY_SEND);

  const { data, isLoading } = useNotifications(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
  );
  const notifications = data?.notifications || [];

  const { data: employees = [] } = useEmployees();
  const { data: units = [] }     = useUnits();

  const sendMutation = useMutation({
    mutationFn: (body) => api.post('/notifications/send', body),
    onSuccess: (res) => {
      success(`Notificação enviada para ${res.data.sent} destinatário(s).`);
      setModal(false);
      setForm(EMPTY_SEND);
      queryClient.invalidateQueries(['admin-notifications']);
    },
    onError: (err) => error(err.response?.data?.error || 'Erro ao enviar notificação.'),
  });

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

  const unread = data?.unread ?? 0;

  return (
    <div>
      <div style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={s.title}>Notificações</h1>
          {unread > 0 && (
            <span style={{ background: '#ef4444', color: '#fff', borderRadius: 20, padding: '2px 9px', fontSize: 12, fontWeight: 700 }}>{unread} não lidas</span>
          )}
        </div>
        <button onClick={() => setModal(true)} style={s.primaryBtn}>+ Enviar Notificação</button>
      </div>

      {/* Filtro por funcionário */}
      <div style={s.filters}>
        <select value={filters.employeeId} onChange={(e) => setFilters({ employeeId: e.target.value })} style={s.select}>
          <option value="">Todos os funcionários</option>
          {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
        </select>
        {filters.employeeId && (
          <button onClick={() => setFilters({ employeeId: '' })} style={s.clearBtn}>Limpar</button>
        )}
      </div>

      {/* Lista */}
      <div style={s.card}>
        {isLoading ? (
          <p style={s.empty}>Carregando...</p>
        ) : notifications.length === 0 ? (
          <p style={s.empty}>Nenhuma notificação encontrada.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                {['Tipo', 'Funcionário', 'Título', 'Mensagem', 'Push', 'Data'].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => {
                const tc = TYPE_COLOR[n.type] || TYPE_COLOR.manual;
                return (
                  <tr key={n.id} style={{ borderBottom: '1px solid #f8fafc', opacity: n.read ? 0.6 : 1 }}>
                    <td style={s.td}>
                      <span style={{ ...badge, background: tc.bg, color: tc.color }}>
                        {TYPE_LABEL[n.type] || n.type}
                      </span>
                    </td>
                    <td style={s.td}>{n.employee_name}</td>
                    <td style={{ ...s.td, fontWeight: n.read ? 400 : 600, color: n.read ? '#64748b' : '#0f172a' }}>{n.title}</td>
                    <td style={{ ...s.td, maxWidth: 240, fontSize: 13, color: '#64748b' }}>{n.body}</td>
                    <td style={s.td}>
                      {n.push_sent
                        ? <span style={{ color: '#16a34a', fontSize: 13 }}>✓ Enviado</span>
                        : <span style={{ color: '#94a3b8', fontSize: 13 }}>—</span>}
                    </td>
                    <td style={{ ...s.td, fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(n.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal envio */}
      {modal && (
        <div style={overlay} onClick={() => setModal(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={modalTitle}>Enviar Notificação</h2>
            <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Destinatário */}
              <div style={{ display: 'flex', gap: 8 }}>
                {[['employee', 'Funcionário específico'], ['unit', 'Toda a unidade']].map(([val, lbl]) => (
                  <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14, color: '#374151' }}>
                    <input type="radio" name="target" value={val} checked={form.target === val}
                      onChange={(e) => setForm((p) => ({ ...p, target: e.target.value, employee_id: '', unit_id: '' }))} />
                    {lbl}
                  </label>
                ))}
              </div>

              {form.target === 'employee' ? (
                <Field label="Funcionário *">
                  <select value={form.employee_id} onChange={(e) => setForm((p) => ({ ...p, employee_id: e.target.value }))}
                    required style={inputStyle}>
                    <option value="">Selecione</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                  </select>
                </Field>
              ) : (
                <Field label="Unidade *">
                  <select value={form.unit_id} onChange={(e) => setForm((p) => ({ ...p, unit_id: e.target.value }))}
                    required style={inputStyle}>
                    <option value="">Selecione</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </Field>
              )}

              <Field label="Título *">
                <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  required placeholder="Ex: Lembrete importante" style={inputStyle} />
              </Field>
              <Field label="Mensagem *">
                <textarea value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
                  required rows={3} placeholder="Texto da notificação..." style={{ ...inputStyle, resize: 'vertical' }} />
              </Field>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={() => setModal(false)} style={s.outlineBtn}>Cancelar</button>
                <button type="submit" disabled={sendMutation.isLoading}
                  style={{ ...s.primaryBtn, opacity: sendMutation.isLoading ? 0.7 : 1 }}>
                  {sendMutation.isLoading ? 'Enviando...' : 'Enviar'}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{label}</label>
      {children}
    </div>
  );
}

const badge     = { padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, display: 'inline-block' };
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
