import { useState }  from 'react';
import { useQuery }  from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import api           from '../../services/api';
import Table         from '../../components/shared/Table';
import StatusBadge   from '../../components/shared/StatusBadge';

function Icon({ d, size = 16, color = 'currentColor', strokeWidth = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const ICON_FILTER  = 'M3 6h18M7 12h10M11 18h2';
const ICON_SHIELD  = 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z';

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

const REASON_LABEL = {
  gps_disabled: 'GPS desligado',
  outside_zone: 'Fora da zona',
  camera_denied: 'Câmera negada',
  rate_limited: 'Limite excedido',
};

const REASON_COLOR = {
  gps_disabled:  { bg: 'rgba(245,158,11,0.1)',  color: '#b45309' },
  outside_zone:  { bg: 'rgba(239,68,68,0.1)',   color: '#dc2626' },
  camera_denied: { bg: 'rgba(99,102,241,0.1)',  color: '#6366f1' },
  rate_limited:  { bg: 'rgba(161,161,170,0.15)', color: '#71717a' },
};

export default function AdminBlockedPage() {
  const [filters, setFilters] = useState({ unitId: '', reason: '', startDate: '', endDate: '' });
  const [page, setPage]       = useState(1);

  const { data, isLoading } = useBlocked(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')),
    page
  );
  const { data: units = [] } = useUnits();

  const hasFilters = Object.values(filters).some(Boolean);

  function updateFilter(key, val) {
    setFilters((prev) => ({ ...prev, [key]: val }));
    setPage(1);
  }

  function clearFilters() {
    setFilters({ unitId: '', reason: '', startDate: '', endDate: '' });
    setPage(1);
  }

  const columns = [
    {
      key: 'attempted_at', label: 'Data/Hora',
      render: (v, row) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
          {formatInTimeZone(new Date(v), row.timezone || 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm:ss')}
        </span>
      ),
    },
    {
      key: 'employee_name', label: 'Funcionário',
      render: (v, row) => v ? (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-ink)' }}>{v}</div>
          <div style={{ fontSize: 11, color: 'var(--color-subtle)', marginTop: 1 }}>{row.badge_number}</div>
        </div>
      ) : <span style={{ color: 'var(--color-subtle)' }}>—</span>,
    },
    {
      key: 'unit_code', label: 'Unidade',
      render: (v) => v ? (
        <span style={{
          padding: '2px 8px', background: 'var(--color-primary-soft)',
          color: 'var(--color-primary)', borderRadius: 4, fontSize: 11, fontWeight: 700,
          fontFamily: 'var(--font-mono)',
        }}>{v}</span>
      ) : '—',
    },
    {
      key: 'block_reason', label: 'Motivo',
      render: (v) => {
        const c = REASON_COLOR[v] || { bg: 'var(--color-hairline)', color: 'var(--color-muted)' };
        return (
          <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color }}>
            {REASON_LABEL[v] || v}
          </span>
        );
      },
    },
    {
      key: 'distance_meters', label: 'Distância',
      render: (v) => v != null ? (
        <span style={{ color: 'var(--color-danger)', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 13 }}>
          {Math.round(v)}m
        </span>
      ) : '—',
    },
    {
      key: 'ip_address', label: 'IP',
      render: (v) => (
        <code style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>{v || '—'}</code>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon d={ICON_SHIELD} size={20} color="#ef4444" />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-ink)', margin: 0, letterSpacing: '-0.03em' }}>
            Tentativas Bloqueadas
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '4px 0 0' }}>
            Registros de acessos bloqueados por GPS desligado, fora de zona ou outros motivos.
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-line)', borderRadius: 12, padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Icon d={ICON_FILTER} size={16} color="var(--color-muted)" />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Filtros</span>

        <select value={filters.unitId} onChange={(e) => updateFilter('unitId', e.target.value)} style={selectStyle}>
          <option value="">Todas as unidades</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>

        <select value={filters.reason} onChange={(e) => updateFilter('reason', e.target.value)} style={selectStyle}>
          <option value="">Todos os motivos</option>
          <option value="gps_disabled">GPS desligado</option>
          <option value="outside_zone">Fora da zona</option>
          <option value="camera_denied">Câmera negada</option>
          <option value="rate_limited">Limite excedido</option>
        </select>

        <input type="date" value={filters.startDate}
          onChange={(e) => updateFilter('startDate', e.target.value)} style={selectStyle} />
        <input type="date" value={filters.endDate}
          onChange={(e) => updateFilter('endDate', e.target.value)} style={selectStyle} />

        {hasFilters && (
          <button onClick={clearFilters} style={clearBtnStyle}>
            Limpar ×
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--color-line)', overflow: 'hidden' }}>
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

const selectStyle = {
  padding: '7px 11px', border: '1.5px solid var(--color-line)',
  borderRadius: 8, fontSize: 13, color: 'var(--color-ink)',
  background: 'var(--bg-card)', outline: 'none', cursor: 'pointer',
};

const clearBtnStyle = {
  padding: '7px 14px', background: 'var(--color-hairline)',
  border: '1.5px solid var(--color-line)', borderRadius: 8,
  fontSize: 13, cursor: 'pointer', color: 'var(--color-muted)', fontWeight: 600,
};
