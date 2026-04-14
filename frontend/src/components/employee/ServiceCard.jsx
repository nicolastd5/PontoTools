import { useState, useEffect } from 'react';
import { formatInTimeZone }    from 'date-fns-tz';

/**
 * Calcula "Xh Ym" a partir de dois Date objects.
 */
function elapsed(from, to = new Date()) {
  const diff = Math.max(0, Math.floor((to - from) / 1000));
  const h    = Math.floor(diff / 3600);
  const m    = Math.floor((diff % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m`;
}

/**
 * Formata hora local a partir de string UTC + timezone.
 */
function localTime(utcStr, tz) {
  return formatInTimeZone(new Date(utcStr), tz, 'HH:mm');
}

export default function ServiceCard({ records }) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const entry = records.find((r) => r.clock_type === 'entry');
  const exit  = records.find((r) => r.clock_type === 'exit');

  const [, tick] = useState(0);

  // Atualiza o cronômetro a cada minuto enquanto o serviço estiver em andamento
  useEffect(() => {
    if (!entry || exit) return;
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [entry, exit]);

  if (!entry) return null;

  const entryDate = new Date(entry.clocked_at_utc);
  const entryTz   = entry.timezone || tz;

  if (!exit) {
    // Em andamento
    return (
      <div style={styles.cardGreen}>
        <div style={styles.label}>▶ Serviço em andamento</div>
        <div style={styles.row}>
          <span>Início: <strong>{localTime(entry.clocked_at_utc, entryTz)}</strong></span>
          <span style={styles.sep}>|</span>
          <span>Decorrido: <strong>{elapsed(entryDate)}</strong></span>
        </div>
      </div>
    );
  }

  // Concluído
  const exitTz   = exit.timezone || tz;
  const exitDate = new Date(exit.clocked_at_utc);

  return (
    <div style={styles.cardBlue}>
      <div style={styles.label}>✓ Serviço concluído</div>
      <div style={styles.row}>
        <span>Início: <strong>{localTime(entry.clocked_at_utc, entryTz)}</strong></span>
        <span style={styles.sep}>→</span>
        <span>Fim: <strong>{localTime(exit.clocked_at_utc, exitTz)}</strong></span>
        <span style={styles.sep}>|</span>
        <span>Total: <strong>{elapsed(entryDate, exitDate)}</strong></span>
      </div>
    </div>
  );
}

const base = {
  borderRadius: 10,
  padding: '12px 16px',
  marginBottom: 16,
  border: '1.5px solid',
};

const styles = {
  cardGreen: { ...base, background: '#f0fdf4', borderColor: '#86efac' },
  cardBlue:  { ...base, background: '#eff6ff', borderColor: '#93c5fd' },
  label: { fontSize: 13, fontWeight: 700, marginBottom: 6 },
  row:   { fontSize: 14, color: '#374151', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  sep:   { color: '#94a3b8' },
};
