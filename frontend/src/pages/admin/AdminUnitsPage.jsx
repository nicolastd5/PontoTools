import { useQuery }  from '@tanstack/react-query';
import api           from '../../services/api';

export default function AdminUnitsPage() {
  const { data: units = [], isLoading } = useQuery({
    queryKey: ['units-admin'],
    queryFn:  () => api.get('/units').then((r) => r.data.units),
  });

  return (
    <div>
      <h1 style={styles.title}>Unidades</h1>
      <p style={styles.subtitle}>Gerencie as unidades e seus pontos de referência GPS.</p>

      {isLoading ? (
        <p style={{ color: '#94a3b8' }}>Carregando...</p>
      ) : (
        <div style={styles.grid}>
          {units.map((u) => (
            <div key={u.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.code}>{u.code}</span>
                <span style={{ ...styles.badge, background: u.active ? '#dcfce7' : '#f1f5f9', color: u.active ? '#166534' : '#64748b' }}>
                  {u.active ? 'Ativa' : 'Inativa'}
                </span>
              </div>
              <h3 style={styles.name}>{u.name}</h3>
              {u.address && <p style={styles.address}>{u.address}</p>}
              <div style={styles.coords}>
                <div style={styles.coordItem}>
                  <span style={styles.coordLabel}>Lat</span>
                  <span style={styles.coordValue}>{parseFloat(u.latitude).toFixed(6)}</span>
                </div>
                <div style={styles.coordItem}>
                  <span style={styles.coordLabel}>Lng</span>
                  <span style={styles.coordValue}>{parseFloat(u.longitude).toFixed(6)}</span>
                </div>
                <div style={styles.coordItem}>
                  <span style={styles.coordLabel}>Raio</span>
                  <span style={styles.coordValue}>{u.radius_meters}m</span>
                </div>
              </div>
              <a
                href={`https://maps.google.com/?q=${u.latitude},${u.longitude}`}
                target="_blank"
                rel="noreferrer"
                style={styles.mapLink}
              >
                Ver no mapa ↗
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  title:    { fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 24 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
  },
  card: {
    background: '#fff', borderRadius: 12,
    border: '1px solid #e2e8f0', padding: '20px 20px',
  },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  code:    { fontSize: 12, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', padding: '2px 8px', borderRadius: 4 },
  badge:   { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 },
  name:    { fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
  address: { fontSize: 12, color: '#64748b', marginBottom: 14, lineHeight: 1.5 },
  coords:  { display: 'flex', gap: 12, marginBottom: 14 },
  coordItem:  { display: 'flex', flexDirection: 'column', gap: 2 },
  coordLabel: { fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' },
  coordValue: { fontSize: 12, color: '#374151', fontWeight: 600 },
  mapLink: { fontSize: 12, color: '#1d4ed8', textDecoration: 'none', fontWeight: 600 },
};
