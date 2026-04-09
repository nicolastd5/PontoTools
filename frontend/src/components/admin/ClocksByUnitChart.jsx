// Gráfico de barras horizontal: batidas por unidade hoje
export default function ClocksByUnitChart({ data = [] }) {
  if (!data.length) return null;

  const max = Math.max(...data.map((d) => parseInt(d.total_clocks, 10)), 1);

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Batidas por Unidade — Hoje</h3>
      <div style={styles.chart}>
        {data.map((unit) => {
          const total      = parseInt(unit.total_clocks, 10);
          const outside    = parseInt(unit.outside_zone, 10);
          const pct        = Math.round((total / max) * 100);

          return (
            <div key={unit.id} style={styles.row}>
              <div style={styles.unitLabel} title={unit.name}>
                {unit.code}
              </div>
              <div style={styles.barContainer}>
                <div style={{ ...styles.bar, width: `${pct}%` }}>
                  {total > 0 && (
                    <span style={styles.barLabel}>{total}</span>
                  )}
                </div>
                {outside > 0 && (
                  <span style={styles.outsideTag}>{outside} fora</span>
                )}
              </div>
              <div style={styles.employees}>
                {unit.unique_employees} func.
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  container: {
    background:   '#fff',
    borderRadius: 12,
    padding:      '20px 24px',
    border:       '1px solid #e2e8f0',
    marginBottom: 24,
  },
  title: { fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 18 },
  chart: { display: 'flex', flexDirection: 'column', gap: 12 },
  row:   { display: 'flex', alignItems: 'center', gap: 12 },
  unitLabel: {
    width:       56,
    fontSize:    12,
    fontWeight:  700,
    color:       '#475569',
    flexShrink:  0,
    overflow:    'hidden',
    textOverflow:'ellipsis',
    whiteSpace:  'nowrap',
  },
  barContainer: {
    flex:       1,
    display:    'flex',
    alignItems: 'center',
    gap:        8,
    background: '#f1f5f9',
    borderRadius: 6,
    height:     28,
    position:   'relative',
    overflow:   'hidden',
  },
  bar: {
    minWidth:     4,
    height:       '100%',
    background:   'linear-gradient(90deg, #1d4ed8, #3b82f6)',
    borderRadius: 6,
    display:      'flex',
    alignItems:   'center',
    transition:   'width 0.4s ease',
  },
  barLabel: {
    paddingLeft: 8,
    color:       '#fff',
    fontSize:    12,
    fontWeight:  700,
  },
  outsideTag: {
    position:   'absolute',
    right:      8,
    fontSize:   11,
    color:      '#dc2626',
    fontWeight: 600,
  },
  employees: { fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', width: 56, textAlign: 'right' },
};
