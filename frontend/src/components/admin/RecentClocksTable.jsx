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
                <tr key={r.id} style={i % 2 !== 0 ? { background: 'var(--color-hairline)' } : {}}>
                  <td style={styles.td}>
                    <div style={styles.empName}>{r.employee_name}</div>
                    <div style={styles.empBadge}>{r.badge_number}</div>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.unitChip}>{r.unit_code}</span>
                  </td>
                  <td style={styles.td}>{CLOCK_TYPE_LABELS[r.clock_type] || r.clock_type}</td>
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
                    <span style={{ color: r.distance_meters > 100 ? 'var(--color-danger)' : 'var(--color-ok)', fontWeight: 600, fontSize: 13 }}>
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
    background:   'var(--bg-card)',
    borderRadius: 12,
    border:       '1px solid var(--border-default)',
    overflow:     'hidden',
  },
  title: {
    fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
    padding: '18px 20px', borderBottom: '1px solid var(--border-light)',
  },
  loading: { padding: 24, textAlign: 'center', color: 'var(--color-subtle)', fontSize: 14 },
  empty:   { padding: 40, textAlign: 'center', color: 'var(--color-subtle)', fontSize: 14 },
  table:   { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    padding: '10px 14px', textAlign: 'left',
    fontSize: 11, fontWeight: 700, color: 'var(--color-muted)',
    background: 'var(--color-surface)', borderBottom: '1px solid var(--border-default)',
    textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
  },
  td:       { padding: '10px 14px', borderBottom: '1px solid var(--border-light)', verticalAlign: 'middle', color: 'var(--text-primary)' },
  empName:  { fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 },
  empBadge: { fontSize: 11, color: 'var(--color-subtle)', marginTop: 2 },
  unitChip: {
    padding: '2px 8px', background: 'var(--color-primary-soft)', color: 'var(--color-primary)',
    borderRadius: 4, fontSize: 11, fontWeight: 700,
  },
};
