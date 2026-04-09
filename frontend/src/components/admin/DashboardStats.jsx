// Cards de estatísticas do topo do dashboard
const CARDS = [
  {
    key:   'totalClocks',
    label: 'Batidas hoje',
    icon:  '🕐',
    color: '#1d4ed8',
    bg:    '#eff6ff',
  },
  {
    key:   'activeToday',
    label: 'Funcionários presentes',
    icon:  '✅',
    color: '#16a34a',
    bg:    '#f0fdf4',
  },
  {
    key:   'absentToday',
    label: 'Sem registro hoje',
    icon:  '⚠️',
    color: '#d97706',
    bg:    '#fffbeb',
  },
  {
    key:   'totalBlocked',
    label: 'Bloqueios hoje',
    icon:  '⛔',
    color: '#dc2626',
    bg:    '#fef2f2',
  },
];

export default function DashboardStats({ summary, loading }) {
  if (loading) {
    return (
      <div style={styles.grid}>
        {CARDS.map((c) => (
          <div key={c.key} style={{ ...styles.card, background: '#f8fafc' }}>
            <div style={styles.skeleton} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={styles.grid}>
      {CARDS.map((card) => (
        <div key={card.key} style={{ ...styles.card, background: card.bg, borderColor: card.color + '20' }}>
          <div style={styles.cardHeader}>
            <span style={styles.icon}>{card.icon}</span>
            <span style={{ ...styles.label, color: card.color + 'cc' }}>{card.label}</span>
          </div>
          <div style={{ ...styles.value, color: card.color }}>
            {summary?.[card.key] ?? 0}
          </div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  grid: {
    display:             'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap:                 16,
    marginBottom:        28,
  },
  card: {
    padding:      '18px 20px',
    borderRadius: 12,
    border:       '1px solid transparent',
  },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  icon:  { fontSize: 18 },
  label: { fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
  value: { fontSize: 32, fontWeight: 800, lineHeight: 1 },
  skeleton: {
    height: 60, background: '#e2e8f0', borderRadius: 8,
    animation: 'pulse 1.5s ease-in-out infinite',
  },
};
