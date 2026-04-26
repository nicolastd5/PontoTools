import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api          from '../../services/api';
import Table        from '../../components/shared/Table';
import { useToast } from '../../contexts/ToastContext';
import { useAuth }  from '../../contexts/AuthContext';

const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const ICONS = {
  plus:    'M12 5v14M5 12h14',
  search:  'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z',
  upload:  'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
  download:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  x:       'M18 6L6 18M6 6l12 12',
};

const GRADIENTS = [
  'linear-gradient(135deg, #4f46e5, #8b5cf6)',
  'linear-gradient(135deg, #0ea5e9, #4f46e5)',
  'linear-gradient(135deg, #10b981, #0ea5e9)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #8b5cf6, #ec4899)',
];
function avatarGrad(index) { return GRADIENTS[index % GRADIENTS.length]; }

function useEmployees(filters, page) {
  return useQuery({
    queryKey: ['employees', filters, page],
    queryFn:  () => api.get('/employees', { params: { ...filters, page } }).then((r) => r.data),
    keepPreviousData: true,
  });
}
function useUnits()     { return useQuery({ queryKey: ['units'],     queryFn: () => api.get('/units').then((r) => r.data.units) }); }
function useContracts() { return useQuery({ queryKey: ['contracts'], queryFn: () => api.get('/contracts').then((r) => r.data.contracts) }); }
function useJobRoles()  { return useQuery({ queryKey: ['job-roles'], queryFn: () => api.get('/job-roles?active=true').then((r) => r.data.jobRoles) }); }

const EMPTY_FORM = { unit_id: '', badge_number: '', full_name: '', email: '', password: '', role: 'employee', contract_id: '', job_role_id: '' };

export default function AdminEmployeesPage() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [filters,     setFilters]     = useState({ unitId: '', active: '' });
  const [search,      setSearch]      = useState('');
  const [page,        setPage]        = useState(1);
  const [modal,       setModal]       = useState(null);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [editId,      setEditId]      = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const fileRef = useRef();

  const queryFilters = Object.fromEntries(
    Object.entries({ ...filters, search: search || undefined }).filter(([, v]) => v)
  );
  const { data, isLoading } = useEmployees(queryFilters, page);
  const { data: units = [] }    = useUnits();
  const { data: contracts = [] } = useContracts();
  const { data: jobRoles = [] }  = useJobRoles();

  const toggleActive = useMutation({
    mutationFn: ({ id, active }) => api.patch(`/employees/${id}/active`, { active }),
    onSuccess: () => { queryClient.invalidateQueries(['employees']); success('Status atualizado.'); },
    onError:   () => error('Erro ao alterar status.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/employees/${id}`),
    onSuccess: () => { queryClient.invalidateQueries(['employees']); success('Funcionário deletado.'); },
    onError:   (err) => error(err.response?.data?.error || 'Erro ao deletar funcionário.'),
  });

  const createMutation = useMutation({
    mutationFn: (body) => api.post('/employees', body),
    onSuccess: () => { queryClient.invalidateQueries(['employees']); success('Funcionário criado.'); closeModal(); },
    onError:   (err) => error(err.response?.data?.error || 'Erro ao criar funcionário.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => api.put(`/employees/${id}`, body),
    onSuccess: () => { queryClient.invalidateQueries(['employees']); success('Funcionário atualizado.'); closeModal(); },
    onError:   (err) => error(err.response?.data?.error || 'Erro ao atualizar funcionário.'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }) => api.patch(`/employees/${id}/reset-password`, { newPassword }),
    onSuccess: () => { success('Senha redefinida.'); setModal(null); setResetTarget(null); setNewPassword(''); },
    onError:   (err) => error(err.response?.data?.error || 'Erro ao redefinir senha.'),
  });

  const importMutation = useMutation({
    mutationFn: (formData) => api.post('/employees/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: (res) => { queryClient.invalidateQueries(['employees']); success(res.data.message); setModal(null); },
    onError:   () => error('Erro na importação. Verifique o arquivo.'),
  });

  function openCreate()  { setForm(EMPTY_FORM); setEditId(null); setModal('form'); }
  function openEdit(row) {
    setForm({ unit_id: row.unit_id || '', badge_number: row.badge_number, full_name: row.full_name, email: row.email, password: '', job_role_id: row.job_role_id || '' });
    setEditId(row.id);
    setModal('form');
  }
  function closeModal() { setModal(null); setForm(EMPTY_FORM); setEditId(null); setResetTarget(null); setNewPassword(''); }
  function openResetPassword(row) { setResetTarget({ id: row.id, name: row.full_name }); setNewPassword(''); setModal('reset-password'); }
  function handleDelete(row) {
    if (!window.confirm(`Deletar "${row.full_name}" permanentemente?\n\nTodos os dados relacionados serão apagados.`)) return;
    deleteMutation.mutate(row.id);
  }
  async function handleSubmit(e) {
    e.preventDefault();
    const body = { ...form, unit_id: parseInt(form.unit_id, 10) };
    if (!body.password) delete body.password;
    if (body.job_role_id) body.job_role_id = parseInt(body.job_role_id, 10);
    else delete body.job_role_id;
    editId ? updateMutation.mutate({ id: editId, body }) : createMutation.mutate(body);
  }
  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    await importMutation.mutateAsync(fd);
  }
  async function downloadTemplate() {
    const res = await api.get('/employees/template', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a'); a.href = url; a.download = 'template_funcionarios.xlsx'; a.click();
    URL.revokeObjectURL(url);
  }

  const isSaving = createMutation.isLoading || updateMutation.isLoading;

  const columns = [
    {
      key: 'badge_number', label: 'Matrícula',
      render: (v) => <code style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>{v}</code>,
    },
    {
      key: 'full_name', label: 'Nome',
      render: (v, row, rowIdx) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: avatarGrad(rowIdx),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 12,
          }}>
            {v.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{v}</span>
        </div>
      ),
    },
    {
      key: 'email', label: 'Email',
      render: (v) => <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{v}</span>,
    },
    { key: 'unit_name', label: 'Unidade', render: (v) => <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{v}</span> },
    {
      key: 'active', label: 'Status',
      render: (v) => (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 8px', borderRadius: 'var(--radius-full)', fontSize: 11, fontWeight: 600,
          background: v ? 'var(--color-ok-soft)'   : 'var(--color-hairline)',
          color:      v ? 'var(--color-ok)'         : 'var(--color-subtle)',
        }}>
          {/* Dot: pulsante se ativo, estático se inativo */}
          <span style={{ position: 'relative', width: 6, height: 6, flexShrink: 0 }}>
            <span style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: v ? 'var(--color-ok)' : 'var(--color-subtle)',
            }} />
            {v && (
              <span style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'var(--color-ok)',
                animation: 'pt-pulse 2s infinite',
              }} />
            )}
          </span>
          {v ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
    {
      key: 'id', label: 'Ações',
      render: (v, row) => (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <ActionBtn onClick={() => openEdit(row)}>Editar</ActionBtn>
          <ActionBtn onClick={() => toggleActive.mutate({ id: v, active: !row.active })}>
            {row.active ? 'Desativar' : 'Ativar'}
          </ActionBtn>
          {isAdmin && <ActionBtn color="warn"  onClick={() => openResetPassword(row)}>Resetar senha</ActionBtn>}
          {isAdmin && <ActionBtn color="danger" onClick={() => handleDelete(row)}>Deletar</ActionBtn>}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={st.header}>
        <h1 style={st.title}>Funcionários</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isAdmin && (
            <button onClick={downloadTemplate} style={st.outlineBtn}>
              <Icon d={ICONS.download} size={14} />
              Template
            </button>
          )}
          {isAdmin && (
            <button onClick={() => fileRef.current?.click()} style={st.outlineBtn}>
              <Icon d={ICONS.upload} size={14} />
              Importar XLSX
            </button>
          )}
          <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={handleImport} />
          <button onClick={openCreate} style={st.primaryBtn}>
            <Icon d={ICONS.plus} size={14} />
            Novo Funcionário
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div style={st.searchWrap}>
        <Icon d={ICONS.search} size={16} />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar por nome, email ou matrícula..."
          style={st.searchInput}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-subtle)', display: 'flex', alignItems: 'center' }}>
            <Icon d={ICONS.x} size={14} />
          </button>
        )}
      </div>

      {/* Filtros */}
      <div style={st.filters}>
        <select value={filters.unitId} onChange={(e) => { setFilters((p) => ({ ...p, unitId: e.target.value })); setPage(1); }} style={st.select}>
          <option value="">Todas as unidades</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select value={filters.active} onChange={(e) => { setFilters((p) => ({ ...p, active: e.target.value })); setPage(1); }} style={st.select}>
          <option value="">Todos</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </select>
      </div>

      <div style={st.card}>
        <Table
          columns={columns}
          rows={data?.employees || []}
          pagination={data?.pagination}
          onPageChange={setPage}
          emptyMessage={isLoading ? 'Carregando...' : 'Nenhum funcionário encontrado.'}
        />
      </div>

      {/* Modal resetar senha */}
      {modal === 'reset-password' && resetTarget && (
        <Modal onClose={closeModal} maxWidth={380}>
          <h2 style={modal_s.title}>Resetar senha</h2>
          <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 20 }}>
            Nova senha para <strong style={{ color: 'var(--text-primary)' }}>{resetTarget.name}</strong>.
          </p>
          <form onSubmit={(e) => { e.preventDefault(); resetPasswordMutation.mutate({ id: resetTarget.id, newPassword }); }} style={modal_s.form}>
            <Field label="Nova senha *">
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} placeholder="Mínimo 6 caracteres" style={inputStyle} autoFocus />
            </Field>
            <div style={modal_s.actions}>
              <button type="button" onClick={closeModal} style={st.outlineBtn}>Cancelar</button>
              <button type="submit" disabled={resetPasswordMutation.isLoading} style={{ ...st.warnBtn, opacity: resetPasswordMutation.isLoading ? 0.7 : 1 }}>
                {resetPasswordMutation.isLoading ? 'Salvando...' : 'Redefinir senha'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal criar/editar */}
      {modal === 'form' && (
        <Modal onClose={closeModal}>
          <h2 style={modal_s.title}>{editId ? 'Editar Funcionário' : 'Novo Funcionário'}</h2>
          <form onSubmit={handleSubmit} style={modal_s.form}>
            {isAdmin && (
              <Field label="Tipo de usuário">
                <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} style={inputStyle}>
                  <option value="employee">Funcionário</option>
                  <option value="gestor">Gestor</option>
                </select>
              </Field>
            )}
            {isAdmin && form.role === 'gestor' && (
              <Field label="Contrato do gestor *">
                <select value={form.contract_id} onChange={(e) => setForm((p) => ({ ...p, contract_id: e.target.value }))} required style={inputStyle}>
                  <option value="">Selecione o contrato</option>
                  {contracts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="Unidade *">
              <select value={form.unit_id} onChange={(e) => setForm((p) => ({ ...p, unit_id: e.target.value }))} required style={inputStyle}>
                <option value="">Selecione a unidade</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            <Field label="Cargo">
              <select value={form.job_role_id} onChange={(e) => setForm((p) => ({ ...p, job_role_id: e.target.value }))} style={inputStyle}>
                <option value="">Sem cargo definido</option>
                {jobRoles.map((jr) => <option key={jr.id} value={jr.id}>{jr.name}{!jr.has_break ? ' (sem intervalo)' : ''}</option>)}
              </select>
            </Field>
            <Field label="Matrícula *">
              <input value={form.badge_number} onChange={(e) => setForm((p) => ({ ...p, badge_number: e.target.value }))} required placeholder="CEF10_001" style={inputStyle} />
            </Field>
            <Field label="Nome completo *">
              <input value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} required placeholder="João da Silva" style={inputStyle} />
            </Field>
            <Field label="Email *">
              <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required placeholder="joao@empresa.com" style={inputStyle} />
            </Field>
            <Field label={editId ? 'Nova senha (deixe em branco para manter)' : 'Senha *'}>
              <input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} required={!editId} placeholder="Mínimo 6 caracteres" style={inputStyle} />
            </Field>
            <div style={modal_s.actions}>
              <button type="button" onClick={closeModal} style={st.outlineBtn}>Cancelar</button>
              <button type="submit" disabled={isSaving} style={{ ...st.primaryBtn, opacity: isSaving ? 0.7 : 1 }}>
                {isSaving ? 'Salvando...' : editId ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ── Primitivos ── */
function Modal({ children, onClose, maxWidth = 480 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(9,9,11,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '28px 24px', width: '100%', maxWidth, boxShadow: '0 24px 48px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', letterSpacing: '0.02em' }}>{label}</label>
      {children}
    </div>
  );
}

function ActionBtn({ onClick, color = 'default', children }) {
  const colors = {
    default: { bg: 'var(--color-hairline)', border: 'var(--border-default)', color: 'var(--color-muted)' },
    warn:    { bg: 'var(--color-warn-soft)', border: 'rgba(245,158,11,0.3)', color: 'var(--color-warn)' },
    danger:  { bg: 'var(--color-danger-soft)', border: 'rgba(239,68,68,0.3)', color: 'var(--color-danger)' },
  };
  const c = colors[color];
  return (
    <button onClick={onClick} style={{
      padding: '4px 10px', fontSize: 12, cursor: 'pointer',
      border: `1px solid ${c.border}`, borderRadius: 6,
      background: c.bg, color: c.color, fontFamily: 'var(--font-sans)', fontWeight: 500,
    }}>
      {children}
    </button>
  );
}

const inputStyle = {
  padding: '8px 11px', border: '1px solid var(--border-default)',
  borderRadius: 8, fontSize: 13, color: 'var(--text-primary)',
  background: 'var(--bg-card)', outline: 'none', width: '100%',
  fontFamily: 'var(--font-sans)',
};

const modal_s = {
  title:   { fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, letterSpacing: '-0.02em' },
  form:    { display: 'flex', flexDirection: 'column', gap: 12 },
  actions: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 },
};

const st = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
  title:  { fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em' },
  searchWrap: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 14px', background: 'var(--bg-card)',
    border: '1px solid var(--border-default)', borderRadius: 10,
    marginBottom: 12, color: 'var(--color-subtle)',
  },
  searchInput: {
    flex: 1, background: 'none', border: 'none', outline: 'none',
    fontSize: 14, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
  },
  filters: { display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  select: {
    padding: '6px 10px', border: '1px solid var(--border-default)', borderRadius: 8,
    fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-card)', outline: 'none',
    fontFamily: 'var(--font-sans)',
  },
  outlineBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 13px', border: '1px solid var(--border-default)',
    borderRadius: 8, fontSize: 13, cursor: 'pointer',
    color: 'var(--text-primary)', background: 'var(--bg-card)', fontWeight: 500,
    fontFamily: 'var(--font-sans)',
  },
  primaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 13px', border: 'none',
    borderRadius: 8, fontSize: 13, cursor: 'pointer',
    color: '#fff', background: '#09090b', fontWeight: 600,
    fontFamily: 'var(--font-sans)',
  },
  warnBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 13px', border: 'none',
    borderRadius: 8, fontSize: 13, cursor: 'pointer',
    color: '#fff', background: 'var(--color-warn)', fontWeight: 600,
    fontFamily: 'var(--font-sans)',
  },
  card: { background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-default)', overflow: 'hidden' },
};
