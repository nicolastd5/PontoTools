import { formatInTimeZone } from 'date-fns-tz';

function localTime(utcStr, tz) {
  if (!utcStr) return '—';
  return formatInTimeZone(new Date(utcStr), tz || 'America/Sao_Paulo', 'HH:mm');
}

function elapsed(fromUtc, toUtc) {
  const diff = Math.max(0, Math.floor((new Date(toUtc || Date.now()) - new Date(fromUtc)) / 1000));
  const h    = Math.floor(diff / 3600);
  const m    = Math.floor((diff % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m`;
}

export default function TodayServicesTable({ services = [], loading }) {
  if (loading) return <p style={{ color: '#94a3b8', fontSize: 13 }}>Carregando serviços...</p>;
  if (!services.length) return <p style={{ color: '#94a3b8', fontSize: 13 }}>Nenhum serviço registrado hoje.</p>;

  const active    = services.filter((s) => s.entry_time && !s.exit_time);
  const completed = services.filter((s) => s.entry_time && s.exit_time);

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Serviços de Hoje</h3>

      <div style={{ padding: '16px 20px' }}>
        {active.length > 0 && (
          <>
            <div style={styles.sectionLabel}>Em andamento ({active.length})</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['Funcionário', 'Unidade', 'Início', 'Decorrido', 'Zona'].map((h) => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {active.map((s) => (
                    <tr key={s.employee_id}>
                      <td style={styles.td}>{s.full_name}</td>
                      <td style={styles.td}>{s.unit_name}</td>
                      <td style={styles.td}>{localTime(s.entry_time, s.entry_timezone)}</td>
                      <td style={styles.td}>{elapsed(s.entry_time)}</td>
                      <td style={styles.td}>
                        <span style={{ color: s.all_inside_zone ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                          {s.all_inside_zone ? '✓' : '✗'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {completed.length > 0 && (
          <>
            <div style={{ ...styles.sectionLabel, marginTop: active.length ? 16 : 0 }}>
              Concluídos ({completed.length})
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['Funcionário', 'Unidade', 'Início', 'Fim', 'Total', 'Zona'].map((h) => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {completed.map((s) => (
                    <tr key={s.employee_id}>
                      <td style={styles.td}>{s.full_name}</td>
                      <td style={styles.td}>{s.unit_name}</td>
                      <td style={styles.td}>{localTime(s.entry_time, s.entry_timezone)}</td>
                      <td style={styles.td}>{localTime(s.exit_time, s.exit_timezone)}</td>
                      <td style={styles.td}>{elapsed(s.entry_time, s.exit_time)}</td>
                      <td style={styles.td}>
                        <span style={{ color: s.all_inside_zone ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                          {s.all_inside_zone ? '✓' : '✗'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: '#fff', borderRadius: 12,
    border: '1px solid #e2e8f0', marginTop: 24,
  },
  title: {
    fontSize: 15, fontWeight: 700, color: '#0f172a',
    padding: '18px 20px', borderBottom: '1px solid #f1f5f9',
    margin: 0,
  },
  sectionLabel: { fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    padding: '10px 14px', textAlign: 'left',
    fontSize: 11, fontWeight: 700, color: '#64748b',
    background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
    textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
  },
  td: { padding: '8px 10px', borderBottom: '1px solid #f8fafc', color: '#374151' },
};
