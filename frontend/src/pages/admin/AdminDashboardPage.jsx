import { useState }          from 'react';
import { useQuery }          from '@tanstack/react-query';
import api                   from '../../services/api';
import DashboardStats        from '../../components/admin/DashboardStats';
import ClocksByUnitChart     from '../../components/admin/ClocksByUnitChart';
import RecentClocksTable     from '../../components/admin/RecentClocksTable';
import AbsentEmployeesList   from '../../components/admin/AbsentEmployeesList';

// Busca o dashboard e atualiza a cada 60 segundos
function useDashboard(unitId) {
  return useQuery({
    queryKey:  ['dashboard', unitId],
    queryFn:   () => api.get('/admin/dashboard', { params: unitId ? { unitId } : {} }).then((r) => r.data),
    refetchInterval: 60 * 1000,
  });
}

function useAbsences(unitId) {
  return useQuery({
    queryKey: ['absences', unitId],
    queryFn:  () => api.get('/admin/dashboard/absences', { params: unitId ? { unitId } : {} }).then((r) => r.data),
    refetchInterval: 60 * 1000,
  });
}

function useUnits() {
  return useQuery({
    queryKey: ['units'],
    queryFn:  () => api.get('/units').then((r) => r.data.units),
  });
}

export default function AdminDashboardPage() {
  const [selectedUnit, setSelectedUnit] = useState('');
  const unitId = selectedUnit ? parseInt(selectedUnit, 10) : null;

  const { data: dashData,  isLoading: loadingDash }    = useDashboard(unitId);
  const { data: absentData, isLoading: loadingAbsent } = useAbsences(unitId);
  const { data: units = [] } = useUnits();

  const now = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div>
      {/* Cabeçalho com data e filtro de unidade */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Dashboard</h1>
          <p style={styles.pageDate}>{now}</p>
        </div>

        <div style={styles.headerRight}>
          {/* Filtro por unidade */}
          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            style={styles.select}
          >
            <option value="">Todas as unidades</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          {/* Botão de atualizar */}
          <button
            onClick={() => window.location.reload()}
            style={styles.refreshBtn}
            title="Atualizar dados"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Cards de estatísticas */}
      <DashboardStats
        summary={dashData?.summary}
        loading={loadingDash}
      />

      {/* Layout de duas colunas: gráfico + ausentes */}
      <div style={styles.twoCol}>
        <div style={{ flex: 2, minWidth: 0 }}>
          <ClocksByUnitChart data={dashData?.clocksByUnit || []} />

          {/* Tabela de bloqueios por motivo */}
          {dashData?.blockedByReason?.length > 0 && (
            <BlockedByReasonCard data={dashData.blockedByReason} />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
          <AbsentEmployeesList
            employees={absentData?.employees || []}
            loading={loadingAbsent}
          />
        </div>
      </div>

      {/* Últimos registros */}
      <div style={{ marginTop: 24 }}>
        <RecentClocksTable
          records={dashData?.recentClocks || []}
          loading={loadingDash}
        />
      </div>
    </div>
  );
}

// Sub-componente: bloqueios por motivo (últimos 7 dias)
function BlockedByReasonCard({ data }) {
  const REASON_LABELS = {
    gps_disabled:    'GPS desligado',
    outside_zone:    'Fora da zona',
    camera_denied:   'Câmera negada',
    rate_limited:    'Limite excedido',
    invalid_payload: 'Dados inválidos',
  };

  const total = data.reduce((s, d) => s + parseInt(d.total, 10), 0);

  return (
    <div style={cardStyles.container}>
      <h3 style={cardStyles.title}>
        Bloqueios por Motivo
        <span style={cardStyles.subtitle}>(últimos 7 dias)</span>
      </h3>
      {data.map((item) => {
        const pct = Math.round((item.total / total) * 100);
        return (
          <div key={item.block_reason} style={cardStyles.row}>
            <div style={cardStyles.reasonLabel}>
              {REASON_LABELS[item.block_reason] || item.block_reason}
            </div>
            <div style={cardStyles.barWrap}>
              <div style={{ ...cardStyles.bar, width: `${pct}%` }} />
            </div>
            <div style={cardStyles.count}>{item.total}</div>
          </div>
        );
      })}
    </div>
  );
}

const cardStyles = {
  container: {
    background:   '#fff',
    borderRadius: 12,
    border:       '1px solid #e2e8f0',
    padding:      '20px 24px',
    marginTop:    24,
  },
  title: {
    fontSize: 15, fontWeight: 700, color: '#0f172a',
    marginBottom: 16, display: 'flex', alignItems: 'baseline', gap: 8,
  },
  subtitle: { fontSize: 12, fontWeight: 400, color: '#94a3b8' },
  row: {
    display:    'flex', alignItems: 'center',
    gap:        12, marginBottom: 10,
  },
  reasonLabel: { fontSize: 13, color: '#374151', width: 140, flexShrink: 0 },
  barWrap: {
    flex: 1, height: 10, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden',
  },
  bar: {
    height: '100%', background: '#dc2626', borderRadius: 5,
    minWidth: 4, transition: 'width 0.4s',
  },
  count: { fontSize: 13, fontWeight: 700, color: '#dc2626', width: 32, textAlign: 'right' },
};

const styles = {
  header: {
    display:        'flex',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    marginBottom:   28,
    flexWrap:       'wrap',
    gap:            16,
  },
  pageTitle: { fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 4 },
  pageDate:  { fontSize: 13, color: '#64748b', textTransform: 'capitalize' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10 },
  select: {
    padding:      '8px 12px',
    border:       '1.5px solid #e2e8f0',
    borderRadius: 8,
    fontSize:     14,
    color:        '#374151',
    background:   '#fff',
    cursor:       'pointer',
    outline:      'none',
  },
  refreshBtn: {
    width:        36, height: 36,
    background:   '#fff',
    border:       '1.5px solid #e2e8f0',
    borderRadius: 8,
    fontSize:     18,
    cursor:       'pointer',
    color:        '#374151',
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'center',
  },
  twoCol: {
    display:  'flex',
    gap:      24,
    flexWrap: 'wrap',
  },
};
