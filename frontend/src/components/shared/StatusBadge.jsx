// Badge colorido para status de batida (dentro/fora/bloqueado)
const CONFIGS = {
  inside:   { label: 'Dentro da zona', bg: '#dcfce7', color: '#166534' },
  outside:  { label: 'Fora da zona',   bg: '#fee2e2', color: '#991b1b' },
  blocked:  { label: 'Bloqueado',      bg: '#fef3c7', color: '#92400e' },
  gps_disabled:   { label: 'GPS desligado',   bg: '#fef3c7', color: '#92400e' },
  outside_zone:   { label: 'Fora da zona',    bg: '#fee2e2', color: '#991b1b' },
  camera_denied:  { label: 'Câmera negada',   bg: '#f3e8ff', color: '#6b21a8' },
  rate_limited:   { label: 'Limite excedido', bg: '#fef3c7', color: '#92400e' },
  invalid_payload:{ label: 'Dados inválidos', bg: '#f1f5f9', color: '#475569' },
};

export default function StatusBadge({ type, isInsideZone }) {
  // Aceita tanto uma chave direta quanto o booleano isInsideZone
  const key    = type || (isInsideZone ? 'inside' : 'outside');
  const config = CONFIGS[key] || CONFIGS.outside;

  return (
    <span style={{
      display:      'inline-block',
      padding:      '3px 10px',
      borderRadius: 20,
      fontSize:     12,
      fontWeight:   600,
      background:   config.bg,
      color:        config.color,
      whiteSpace:   'nowrap',
    }}>
      {config.label}
    </span>
  );
}
