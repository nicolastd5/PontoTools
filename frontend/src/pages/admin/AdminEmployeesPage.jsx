import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api       from '../../services/api';
import Table     from '../../components/shared/Table';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

function useEmployees(filters, page) {
  return useQuery({
    queryKey: ['employees', filters, page],
    queryFn:  () => api.get('/employees', { params: { ...filters, page } }).then((r) => r.data),
    keepPreviousData: true,
  });
}
function useUnits() {
  return useQuery({ queryKey: ['units'], queryFn: () => api.get('/units').then((r) => r.data.units) });
}
function useContracts() {
  return useQuery({ queryKey: ['contracts'], queryFn: () => api.get('/contracts').then((r) => r.data.contracts) });
}
function useJobRoles() {
  return useQuery({ queryKey: ['job-roles'], queryFn: () => api.get('/job-roles?active=true').then((r) => r.data.jobRoles) });
}

const EMPTY_FORM = { unit_id: '', badge_number: '', full_name: '', email: '', password: '', role: 'employee', contract_id: '', job_role_id: '' };

export default function AdminEmployeesPage() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [filters, setFilters] = useState({ unitId: '', active: '' });
  const [page, setPage]       = useState(1);
  const [modal, setModal]       = useState(null); // null | 'form' | 'reset-password'
  const [form, setForm]         = useState(EMPTY_FORM);
  const [editId, setEditId]     = useState(null);
  const [resetTarget, setResetTarget] = useState(null); // { id, name }
  const [newPassword, setNewPassword] = useState('');
  const fileRef = useRef();

  const { data, isLoading } = useEmployees(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')),
    page
  );
  const { data: units = [] } = useUnits();
  const { data: contracts = [] } = useContracts();
  const { data: jobRoles = [] } = useJobRoles();

  const toggleActive = useMutation({
    mutationFn: ({ id, active }) => api.patch(`/employees/${id}/active`, { active }),
    onSuccess: () => { queryClient.invalidateQueries(['employees']); success('Status atualizado.'); },
    onError:   () => error('Erro ao alterar status.'),
  });

  const createMutation = useMutation({
    mutationFn: (body) => api.post('/employees', body),
    onSuccess: () => {
      queryClient.invalidateQueries(['employees']);
      success('Funcionário criado com sucesso.');
      closeModal();
    },
    onError: (err) => error(err.response?.data?.error || 'Erro ao criar funcionário.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => api.put(`/employees/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries(['employees']);
      success('Funcionário atualizado.');
      closeModal();
    },
    onError: (err) => error(err.response?.data?.error || 'Erro ao atualizar funcionário.'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }) => api.patch(`/employees/${id}/reset-password`, { newPassword }),
    onSuccess: () => {
      success('Senha redefinida com sucesso.');
      setModal(null);
      setResetTarget(null);
      setNewPassword('');
    },
    onError: (err) => error(err.response?.data?.error || 'Erro ao redefinir senha.'),
  });

  const importMutation = useMutation({
    mutationFn: (formData) => api.post('/employees/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['employees']);
      success(res.data.message);
      setModal(null);
    },
    onError: () => error('Erro na importação. Verifique o arquivo.'),
  });

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setModal('form');
  }

  function openEdit(row) {
    setForm({
      unit_id:      row.unit_id || '',
      badge_number: row.badge_number,
      full_name:    row.full_name,
      email:        row.email,
      password:     '',
      job_role_id:  row.job_role_id || '',
    });
    setEditId(row.id);
    setModal('form');
  }

  function closeModal() {
    setModal(null);
    setForm(EMPTY_FORM);
    setEditId(null);
    setResetTarget(null);
    setNewPassword('');
  }

  function openResetPassword(row) {
    setResetTarget({ id: row.id, name: row.full_name });
    setNewPassword('');
    setModal('reset-password');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const body = { ...form, unit_id: parseInt(form.unit_id, 10) };
    if (!body.password) delete body.password;
    if (body.job_role_id) body.job_role_id = parseInt(body.job_role_id, 10);
    else delete body.job_role_id;
    if (editId) {
      updateMutation.mutate({ id: editId, body });
    } else {
      createMutation.mutate(body);
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    await importMutation.mutateAsync(fd);
  }

  async function downloadTemplate() {
    const res = await api.get('/employees/template', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a   = document.createElement('a');
    a.href = url; a.download = 'template_funcionarios.xlsx'; a.click();
    URL.revokeObjectURL(url);
  }

  const columns = [
    {
      key: 'badge_number', label: 'Matrícula',
      render: (v) => <code style={{ fontSize: 12, color: '#475569' }}>{v}</code>,
    },
    { key: 'full_name', label: 'Nome' },
    { key: 'email',     label: 'Email', render: (v) => <span style={{ fontSize: 12 }}>{v}</span> },
    { key: 'unit_name', label: 'Unidade' },
    {
      key: 'active', label: 'Status',
      render: (v) => (
        <span style={{
          padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
          background: v ? '#dcfce7' : '#f1f5f9',
          color:      v ? '#166534' : '#64748b',
        }}>
          {v ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
    {
      key: 'id', label: 'Ações',
      render: (v, row) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => openEdit(row)} style={actionBtn}>Editar</button>
          <button
            onClick={() => toggleActive.mutate({ id: v, active: !row.active })}
            style={actionBtn}
          >
            {row.active ? 'Desativar' : 'Ativar'}
          </button>
          {isAdmin && (
            <button onClick={() => openResetPassword(row)} style={{ ...actionBtn, color: '#b45309', borderColor: '#fde68a' }}>
              Resetar senha
            </button>
          )}
        </div>
      ),
    },
  ];

  const isSaving = createMutation.isLoading || updateMutation.isLoading;

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Funcionários</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          {isAdmin && <button onClick={downloadTemplate} style={styles.outlineBtn}>Baixar template</button>}
          {isAdmin && <button onClick={() => { fileRef.current?.click(); }} style={styles.outlineBtn}>Importar XLSX</button>}
          <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={handleImport} />
          <button onClick={openCreate} style={styles.primaryBtn}>+ Novo Funcionário</button>
        </div>
      </div>

      <div style={styles.filters}>
        <select value={filters.unitId} onChange={(e) => { setFilters((p) => ({ ...p, unitId: e.target.value })); setPage(1); }} style={styles.select}>
          <option value="">Todas as unidades</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select value={filters.active} onChange={(e) => { setFilters((p) => ({ ...p, active: e.target.value })); setPage(1); }} style={styles.select}>
          <option value="">Todos</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </select>
      </div>

      <div style={styles.card}>
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
        <div style={overlay} onClick={closeModal}>
          <div style={{ ...modalCard, maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={modalTitle}>Resetar senha</h2>
            <p style={{ fontSize: 14, color: '#475569', marginBottom: 20 }}>
              Defina uma nova senha para <strong>{resetTarget.name}</strong>.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                resetPasswordMutation.mutate({ id: resetTarget.id, newPassword });
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <div style={fieldStyle}>
                <label style={labelStyle}>Nova senha *</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  style={inputStyle}
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={closeModal} style={styles.outlineBtn}>Cancelar</button>
                <button
                  type="submit"
                  disabled={resetPasswordMutation.isLoading}
                  style={{ ...styles.primaryBtn, background: '#b45309', opacity: resetPasswordMutation.isLoading ? 0.7 : 1 }}
                >
                  {resetPasswordMutation.isLoading ? 'Salvando...' : 'Redefinir senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal criar/editar */}
      {modal === 'form' && (
        <div style={overlay} onClick={closeModal}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={modalTitle}>{editId ? 'Editar Funcionário' : 'Novo Funcionário'}</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {isAdmin && (
                <div style={fieldStyle}>
                  <label style={labelStyle}>Tipo de usuário</label>
                  <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} style={inputStyle}>
                    <option value="employee">Funcionário</option>
                    <option value="gestor">Gestor</option>
                  </select>
                </div>
              )}
              {isAdmin && form.role === 'gestor' && (
                <div style={fieldStyle}>
                  <label style={labelStyle}>Contrato do gestor *</label>
                  <select value={form.contract_id} onChange={(e) => setForm((p) => ({ ...p, contract_id: e.target.value }))} required={form.role === 'gestor'} style={inputStyle}>
                    <option value="">Selecione o contrato</option>
                    {contracts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div style={fieldStyle}>
                <label style={labelStyle}>Unidade *</label>
                <select
                  value={form.unit_id}
                  onChange={(e) => setForm((p) => ({ ...p, unit_id: e.target.value }))}
                  required
                  style={inputStyle}
                >
                  <option value="">Selecione a unidade</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Cargo</label>
                <select
                  value={form.job_role_id}
                  onChange={(e) => setForm((p) => ({ ...p, job_role_id: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">Sem cargo definido</option>
                  {jobRoles.map((jr) => (
                    <option key={jr.id} value={jr.id}>
                      {jr.name}{!jr.has_break ? ' (sem intervalo)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Matrícula *</label>
                <input
                  value={form.badge_number}
                  onChange={(e) => setForm((p) => ({ ...p, badge_number: e.target.value }))}
                  required
                  placeholder="CEF10_001"
                  style={inputStyle}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Nome completo *</label>
                <input
                  value={form.full_name}
                  onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                  required
                  placeholder="João da Silva"
                  style={inputStyle}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  required
                  placeholder="joao@empresa.com"
                  style={inputStyle}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>{editId ? 'Nova senha (deixe em branco para manter)' : 'Senha *'}</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  required={!editId}
                  placeholder="Mínimo 6 caracteres"
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={closeModal} style={styles.outlineBtn}>Cancelar</button>
                <button type="submit" disabled={isSaving} style={{ ...styles.primaryBtn, opacity: isSaving ? 0.7 : 1 }}>
                  {isSaving ? 'Salvando...' : editId ? 'Salvar' : 'Criar'}
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
  width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
};

const modalTitle = { fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 20 };

const fieldStyle = { display: 'flex', flexDirection: 'column', gap: 5 };
const labelStyle = { fontSize: 13, fontWeight: 600, color: '#374151' };
const inputStyle = {
  padding: '9px 12px', border: '1.5px solid #e2e8f0',
  borderRadius: 8, fontSize: 14, color: '#1e293b', outline: 'none',
};

const styles = {
  header:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  title:   { fontSize: 22, fontWeight: 800, color: '#0f172a' },
  filters: { display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  select: {
    padding: '8px 12px', border: '1.5px solid #e2e8f0',
    borderRadius: 8, fontSize: 14, color: '#374151', background: '#fff', outline: 'none',
  },
  outlineBtn: {
    padding: '8px 16px', border: '1.5px solid #1d4ed8',
    borderRadius: 8, fontSize: 14, cursor: 'pointer',
    color: '#1d4ed8', background: '#fff', fontWeight: 600,
  },
  primaryBtn: {
    padding: '8px 16px', border: 'none',
    borderRadius: 8, fontSize: 14, cursor: 'pointer',
    color: '#fff', background: '#1d4ed8', fontWeight: 600,
  },
  card: { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' },
};
