// Tabela de últimos registros de ponto no dashboard
import { formatInTimeZone } from 'date-fns-tz';
import StatusBadge from '../shared/StatusBadge';

const CLOCK_TYPE_LABELS = {
  entry:       'Entrada',
  exit:        'Saída',
  break_start: 'Início intervalo',
  break_end:   'Fim intervalo',
};

export default function RecentClocksTable({ records = [], loading }) {
  if (loading) {
    return <div style={styles.loading}>Carregando registros...</div>;
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Últimos Registros</h3>
      {records.length === 0 ? (
        <div style={styles.empty}>Nenhum registro hoje ainda.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Funcionário', 'Unidade', 'Tipo', 'Horário (local)', 'Status', 'Distância'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={r.id} style={i % 2 !== 0 ? { background: '#f8fafc' } : {}}>
                  <td style={styles.td}>
                    <div style={styles.empName}>{r.employee_name}</div>
                    <div style={styles.empBadge}>{r.badge_number}</div>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.unitChip}>{r.unit_code}</span>
                  </td>
                  <td style={styles.td}>
                    {CLOCK_TYPE_LABELS[r.clock_type] || r.clock_type}
                  </td>
                  <td style={styles.td}>
                    {formatInTimeZone(
                      new Date(r.clocked_at_utc),
                      r.timezone || 'America/Sao_Paulo',
                      'dd/MM/yyyy HH:mm'
                    )}
                  </td>
                  <td style={styles.td}>
                    <StatusBadge isInsideZone={r.is_inside_zone} />
                  </td>
                  <td style={styles.td}>
                    <span style={{ color: r.distance_meters > 100 ? '#dc2626' : '#16a34a', fontWeight: 600, fontSize: 13 }}>
                      {Math.round(r.distance_meters)}m
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    background:   '#fff',
    borderRadius: 12,
    border:       '1px solid #e2e8f0',
    overflow:     'hidden',
  },
  title: {
    fontSize: 15, fontWeight: 700, color: '#0f172a',
    padding: '18px 20px', borderBottom: '1px solid #f1f5f9',
  },
  loading: { padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 14 },
  empty:   { padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    padding: '10px 14px', textAlign: 'left',
    fontSize: 11, fontWeight: 700, color: '#64748b',
    background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
    textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
  },
  td: { padding: '10px 14px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
  empName:  { fontWeight: 600, color: '#0f172a', fontSize: 13 },
  empBadge: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  unitChip: {
    padding: '2px 8px', background: '#eff6ff', color: '#1d4ed8',
    borderRadius: 4, fontSize: 11, fontWeight: 700,
  },
};
