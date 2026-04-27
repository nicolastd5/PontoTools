import { useTheme } from '../../contexts/ThemeContext';

export default function GpsStatus({ status, distanceMeters, isInsideZone, radiusMeters, requireLocation = true }) {
  const { theme } = useTheme();

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: theme.card, borderRadius: 12, color: theme.muted, fontSize: 13, border: `1px solid ${theme.line}` }}>
        ⟳ Obtendo localização GPS...
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div style={{ padding: '16px', background: theme.dangerSoft, borderRadius: 12, border: `1px solid ${theme.danger}55`, textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>📵</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: theme.danger, marginBottom: 4 }}>GPS desativado</div>
        <div style={{ fontSize: 12, color: theme.danger, lineHeight: 1.5 }}>
          Permita acesso à localização para registrar o ponto. Acesse as configurações do seu dispositivo.
        </div>
      </div>
    );
  }

  if (status === 'unavailable') {
    return (
      <div style={{ padding: '16px', background: theme.warnSoft, borderRadius: 12, border: `1px solid ${theme.warn}55`, textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: theme.warn, marginBottom: 4 }}>GPS indisponível</div>
        <div style={{ fontSize: 12, color: theme.warn, lineHeight: 1.5 }}>
          Não foi possível obter sua localização. Verifique o GPS e tente novamente.
        </div>
      </div>
    );
  }

  const inside     = requireLocation ? isInsideZone : true;
  const dotColor   = inside ? theme.ok : theme.danger;
  const bgColor    = inside ? theme.okSoft : theme.dangerSoft;
  const bdColor    = inside ? theme.ok + '40' : theme.danger + '40';
  const statusText = requireLocation ? (isInsideZone ? 'Localização validada' : 'Fora da zona') : 'GPS obtido';
  const distLabel  = distanceMeters !== null
    ? `${inside ? 'Dentro da zona' : 'Fora da zona'} · ${Math.round(distanceMeters)}m do ponto`
    : 'Calculando distância...';

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: bgColor, borderRadius: 12, border: `1px solid ${bdColor}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: bgColor, border: `1px solid ${bdColor}`, display: 'grid', placeItems: 'center', fontSize: 16 }}>
          📍
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: dotColor, letterSpacing: '-0.01em' }}>{statusText}</div>
          <div style={{ fontSize: 11, color: dotColor, opacity: 0.7 }}>{distLabel}</div>
        </div>
      </div>
      {requireLocation && (
        <div style={{ fontSize: 11, color: dotColor, opacity: 0.6 }}>raio: {radiusMeters}m</div>
      )}
    </div>
  );
}
