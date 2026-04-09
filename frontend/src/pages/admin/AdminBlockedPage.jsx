import { useState }  from 'react';
import { useQuery }  from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import api           from '../../services/api';
import Table         from '../../components/shared/Table';
import StatusBadge   from '../../components/shared/StatusBadge';

function useBlocked(filters, page) {
  return useQuery({
    queryKey: ['blocked', filters, page],
    queryFn:  () => api.get('/admin/blocked', { params: { ...filters, page, limit: 25 } }).then((r) => r.data),
    keepPreviousData: true,
  });
}

function useUnits() {
  return useQuery({ queryKey: ['units'], queryFn: () => api.get('/units').then((r) => r.data.units) });
}

export default function AdminBlockedPage() {
  const [filters, setFilters] = useState({ unitId: '', reason: '', startDate: '', endDate: '' });
  const [page, setPage]       = useState(1);

  const { data, isLoading } = useBlocked(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')),
    page
  );
  const { data: units = [] } = useUnits();

  function updateFilter(key, val) {
    setFilters((prev) => ({ ...prev, [key]: val }));
    setPage(1);
  }

  const columns = [
    {
      key: 'attempted_at', label: 'Data/Hora',
      render: (v, row) => formatInTimeZone(
        new Date(v), row.timezone || 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm:ss'
      ),
    },
    {
      key: 'employee_name', label: 'Funcionário',
      render: (v, row) => v
        ? <div><div style={{ fontWeight: 600, fontSize: 13 }}>{v}</div><div style={{ fontSize: 11, color: '#94a3b8' }}>{row.badge_number}</div></div>
        : <span style={{ color: '#94a3b8' }}>—</span>,
    },
    {
      key: 'unit_code', label: 'Unidade',
      render: (v) => v ? <span style={chip}>{v}</span> : '—',
    },
    {
      key: 'block_reason', label: 'Motivo',
      render: (v) => <StatusBadge type={v} />,
    },
    {
      key: 'distance_meters', label: 'Distância',
      render: (v) => v != null ? <span style={{ color: '#dc2626', fontWeight: 600 }}>{Math.round(v)}m</span> : '—',
    },
    {
      key: 'ip_address', label: 'IP',
      render: (v) => <code style={{ fontSize: 11, color: '#64748b' }}>{v || '—'}</code>,
    },
  ];

  return (
    <div>
      <h1 style={styles.title}>Tentativas Bloqueadas</h1>
      <p style={styles.subtitle}>Registros de acessos bloqueados por GPS desligado, fora de zona ou outros motivos.</p>

      {/* Filtros */}
      <div style={styles.filters}>
        <select value={filters.unitId} onChange={(e) => updateFilter('unitId', e.target.value)} style={styles.select}>
          <option value="">Todas as unidades</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>

        <select value={filters.reason} onChange={(e) => updateFilter('reason', e.target.value)} style={styles.select}>
          <option value="">Todos os motivos</option>
          <option value="gps_disabled">GPS desligado</option>
          <option value="outside_zone">Fora da zona</option>
          <option value="camera_denied">Câmera negada</option>
          <option value="rate_limited">Limite excedido</option>
        </select>

        <input type="date" value={filters.startDate}
          onChange={(e) => updateFilter('startDate', e.target.value)} style={styles.input} />
        <input type="date" value={filters.endDate}
          onChange={(e) => updateFilter('endDate', e.target.value)} style={styles.input} />

        <button onClick={() => { setFilters({ unitId: '', reason: '', startDate: '', endDate: '' }); setPage(1); }} style={styles.clearBtn}>
          Limpar
        </button>
      </div>

      {/* Tabela */}
      <div style={styles.card}>
        <Table
          columns={columns}
          rows={data?.records || []}
          pagination={data?.pagination}
          onPageChange={setPage}
          emptyMessage={isLoading ? 'Carregando...' : 'Nenhuma tentativa bloqueada.'}
        />
      </div>
    </div>
  );
}

const chip = {
  padding: '2px 8px', background: '#eff6ff',
  color: '#1d4ed8', borderRadius: 4, fontSize: 11, fontWeight: 700,
};

const styles = {
  title:    { fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 20 },
  filters:  { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 },
  select: {
    padding: '8px 12px', border: '1.5px solid #e2e8f0',
    borderRadius: 8, fontSize: 14, color: '#374151',
    background: '#fff', outline: 'none', cursor: 'pointer',
  },
  input: {
    padding: '8px 12px', border: '1.5px solid #e2e8f0',
    borderRadius: 8, fontSize: 14, color: '#374151', outline: 'none',
  },
  clearBtn: {
    padding: '8px 16px', background: '#f1f5f9',
    border: '1.5px solid #e2e8f0', borderRadius: 8,
    fontSize: 14, cursor: 'pointer', color: '#374151',
  },
  card: { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' },
};
