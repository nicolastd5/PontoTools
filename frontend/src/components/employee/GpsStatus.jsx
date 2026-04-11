// Indicador de status do GPS e distância da zona
export default function GpsStatus({ status, distanceMeters, isInsideZone, radiusMeters, requireLocation = true }) {
  if (status === 'loading') {
    return (
      <div style={styles.loading}>
        <span style={styles.spinner}>⟳</span>
        Obtendo localização GPS...
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div style={styles.denied}>
        <div style={styles.deniedIcon}>📵</div>
        <div style={styles.deniedTitle}>GPS desativado</div>
        <div style={styles.deniedDesc}>
          Você precisa permitir acesso à localização para registrar o ponto.
          Acesse as configurações do seu dispositivo e habilite o GPS para este site.
        </div>
      </div>
    );
  }

  if (status === 'unavailable') {
    return (
      <div style={styles.denied}>
        <div style={styles.deniedIcon}>⚠️</div>
        <div style={styles.deniedTitle}>GPS indisponível</div>
        <div style={styles.deniedDesc}>
          Não foi possível obter sua localização. Verifique se o GPS está ativado e tente novamente.
        </div>
      </div>
    );
  }

  // GPS obtido — mostra distância e status
  const distLabel = distanceMeters !== null
    ? `${Math.round(distanceMeters)}m da unidade`
    : 'Calculando distância...';

  // Quando localização livre: sempre verde, sem indicar bloqueio
  const inside  = requireLocation ? isInsideZone : true;
  const bgColor = inside ? '#f0fdf4' : '#fef2f2';
  const bdColor = inside ? '#86efac' : '#fca5a5';
  const dotColor    = inside ? '#16a34a' : '#dc2626';
  const statusColor = inside ? '#15803d' : '#dc2626';
  const statusLabel = requireLocation
    ? (isInsideZone ? 'Dentro da zona' : 'Fora da zona')
    : 'GPS obtido';

  return (
    <div style={{ ...styles.indicator, background: bgColor, borderColor: bdColor }}>
      <div style={styles.indicatorLeft}>
        <div style={{ ...styles.dot, background: dotColor }} />
        <div>
          <div style={{ ...styles.statusText, color: statusColor }}>
            {statusLabel}
          </div>
          <div style={styles.distanceText}>{distLabel}</div>
        </div>
      </div>
      {requireLocation && (
        <div style={styles.radius}>raio: {radiusMeters}m</div>
      )}
    </div>
  );
}

const styles = {
  loading: {
    display:    'flex', alignItems: 'center', gap: 10,
    padding:    '14px 16px', background: '#f8fafc',
    borderRadius: 10, color: '#64748b', fontSize: 14,
    border:     '1px solid #e2e8f0',
  },
  spinner: { fontSize: 18, animation: 'spin 1s linear infinite' },
  denied: {
    padding: '20px', background: '#fef2f2',
    borderRadius: 12, border: '1px solid #fca5a5',
    textAlign: 'center',
  },
  deniedIcon:  { fontSize: 36, marginBottom: 8 },
  deniedTitle: { fontSize: 16, fontWeight: 700, color: '#dc2626', marginBottom: 6 },
  deniedDesc:  { fontSize: 13, color: '#991b1b', lineHeight: 1.6 },
  indicator: {
    display:      'flex', alignItems: 'center', justifyContent: 'space-between',
    padding:      '14px 16px', borderRadius: 12, border: '1px solid',
  },
  indicatorLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  dot: {
    width: 12, height: 12, borderRadius: '50%',
    flexShrink: 0,
    boxShadow: '0 0 0 3px rgba(0,0,0,0.08)',
  },
  statusText:   { fontWeight: 700, fontSize: 14 },
  distanceText: { fontSize: 12, color: '#64748b', marginTop: 2 },
  radius:       { fontSize: 11, color: '#94a3b8' },
};
