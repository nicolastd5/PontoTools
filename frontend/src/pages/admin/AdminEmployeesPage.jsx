import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api       from '../../services/api';
import Table     from '../../components/shared/Table';
import { useToast } from '../../contexts/ToastContext';

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

export default function AdminEmployeesPage() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();
  const [filters, setFilters] = useState({ unitId: '', active: '' });
  const [page, setPage]       = useState(1);
  const [modal, setModal]     = useState(null); // null | 'create' | 'import'
  const fileRef = useRef();

  const { data, isLoading } = useEmployees(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')),
    page
  );
  const { data: units = [] } = useUnits();

  const toggleActive = useMutation({
    mutationFn: ({ id, active }) => api.patch(`/employees/${id}/active`, { active }),
    onSuccess: () => { queryClient.invalidateQueries(['employees']); success('Status atualizado.'); },
    onError:   () => error('Erro ao alterar status.'),
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
        <button
          onClick={() => toggleActive.mutate({ id: v, active: !row.active })}
          style={actionBtn}
        >
          {row.active ? 'Desativar' : 'Ativar'}
        </button>
      ),
    },
  ];

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Funcionários</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={downloadTemplate} style={styles.outlineBtn}>
            Baixar template
          </button>
          <button onClick={() => { fileRef.current?.click(); }} style={styles.outlineBtn}>
            Importar XLSX
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={handleImport} />
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
    </div>
  );
}

const actionBtn = {
  padding: '4px 12px', fontSize: 12, cursor: 'pointer',
  border: '1px solid #e2e8f0', borderRadius: 6,
  background: '#f8fafc', color: '#374151',
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
  card: { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' },
};
