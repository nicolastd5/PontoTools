import { useMemo, useState } from 'react';
import { useQuery }          from '@tanstack/react-query';
import api                   from '../../services/api';
import Icon                  from '../../components/shared/Icon';

function useUnits() {
  return useQuery({
    queryKey: ['units'],
    queryFn:  () => api.get('/units').then((r) => r.data.units || []),
  });
}

function useLiveTracking(unitId) {
  return useQuery({
    queryKey: ['service-tracking-live', unitId],
    queryFn:  () => api.get('/service-tracking/live', { params: unitId ? { unitId } : {} }).then((r) => r.data.locations || []),
    refetchInterval: 30 * 1000,
  });
}

function signalStatus(location) {
  const age = location.signal_age_seconds;
  if (age == null || age > 300) return STATUS_THEME.offline;
  if (age <= 60) return STATUS_THEME.online;
  return STATUS_THEME.recent;
}

function formatSignalAge(seconds) {
  if (seconds == null) return 'Sem envio';
  if (seconds <= 0) return 'agora';
  if (seconds < 60) return `${Math.round(seconds)}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

function formatAccuracy(value) {
  if (value == null || value === '') return '-';
  const accuracy = Number(value);
  return Number.isFinite(accuracy) ? `${Math.round(accuracy)}m` : '-';
}

function hasCoordinates(location) {
  return location.latitude != null && location.longitude != null;
}

function mapUrl(location) {
  return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
}

const STATUS_THEME = {
  online:  { key: 'online',  label: 'Online',    color: 'var(--color-ok)',     bg: 'var(--color-ok-soft)' },
  recent:  { key: 'recent',  label: 'Recente',   color: 'var(--color-warn)',   bg: 'var(--color-warn-soft)' },
  offline: { key: 'offline', label: 'Sem sinal', color: 'var(--color-danger)', bg: 'var(--color-danger-soft)' },
};

const SERVICE_STATUS_LABEL = {
  pending:     'Pendente',
  in_progress: 'Em andamento',
};

export default function AdminServiceTrackingPage() {
  const [selectedUnit, setSelectedUnit] = useState('');
  const unitId = selectedUnit ? Number.parseInt(selectedUnit, 10) : null;

  const { data: units = [] } = useUnits();
  const { data: locations = [], isLoading } = useLiveTracking(unitId);

  const summary = useMemo(() => locations.reduce((acc, location) => {
    const status = signalStatus(location);
    acc[status.key] += 1;
    return acc;
  }, { online: 0, recent: 0, offline: 0 }), [locations]);

  return (
    <div>
      <div style={st.header}>
        <div>
          <h1 style={st.title}>Rastreamento</h1>
          <p style={st.subtitle}>Acompanhe o último sinal de funcionários em serviços ativos ou pendentes.</p>
        </div>

        <label style={st.filterLabel}>
          Unidade
          <select value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)} style={st.select}>
            <option value="">Todas as unidades</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={st.summaryGrid}>
        <SummaryCard label="Online" value={summary.online} theme={STATUS_THEME.online} />
        <SummaryCard label="Recente" value={summary.recent} theme={STATUS_THEME.recent} />
        <SummaryCard label="Sem sinal" value={summary.offline} theme={STATUS_THEME.offline} />
      </div>

      <div style={st.card}>
        <div style={st.cardHeader}>
          <div>
            <div style={st.cardTitle}>Serviços rastreados</div>
            <div style={st.cardHint}>Atualização automática a cada 30s</div>
          </div>
        </div>

        {isLoading ? (
          <div style={st.empty}>Carregando rastreamento...</div>
        ) : locations.length === 0 ? (
          <div style={st.empty}>Nenhum serviço ativo ou pendente encontrado.</div>
        ) : (
          <div style={st.tableWrap}>
            <table style={st.table}>
              <thead>
                <tr>
                  <Th>Funcionário</Th>
                  <Th>Serviço</Th>
                  <Th>Unidade</Th>
                  <Th>Status</Th>
                  <Th>Último sinal</Th>
                  <Th>Precisão</Th>
                  <Th>Origem</Th>
                  <Th>Mapa</Th>
                </tr>
              </thead>
              <tbody>
                {locations.map((location) => {
                  const signal = signalStatus(location);
                  return (
                    <tr key={location.service_order_id} style={st.row}>
                      <Td strong>{location.employee_name || '-'}</Td>
                      <Td>
                        <div style={st.serviceTitle}>{location.service_title || '-'}</div>
                        <div style={st.serviceStatus}>{SERVICE_STATUS_LABEL[location.service_status] || location.service_status || '-'}</div>
                      </Td>
                      <Td>{location.unit_name || '-'}</Td>
                      <Td>
                        <span style={{ ...st.badge, color: signal.color, background: signal.bg }}>
                          {signal.label}
                        </span>
                      </Td>
                      <Td>{formatSignalAge(location.signal_age_seconds)}</Td>
                      <Td>{formatAccuracy(location.accuracy_meters)}</Td>
                      <Td>{location.source || '-'}</Td>
                      <Td>
                        {hasCoordinates(location) ? (
                          <a href={mapUrl(location)} target="_blank" rel="noreferrer" style={st.mapLink}>
                            <Icon name="pin" size={14} />
                            Abrir
                          </a>
                        ) : (
                          <span style={st.muted}>-</span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, theme }) {
  return (
    <div style={st.summaryCard}>
      <span style={{ ...st.summaryIcon, color: theme.color, background: theme.bg }}>
        <Icon name="pin" size={15} />
      </span>
      <span style={st.summaryLabel}>{label}</span>
      <strong style={st.summaryValue}>{value}</strong>
    </div>
  );
}

function Th({ children }) {
  return <th style={st.th}>{children}</th>;
}

function Td({ children, strong = false }) {
  return <td style={{ ...st.td, fontWeight: strong ? 700 : 500 }}>{children}</td>;
}

const st = {
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: 16, flexWrap: 'wrap', marginBottom: 18,
  },
  title: {
    fontSize: 22, fontWeight: 800, color: 'var(--color-ink)',
    margin: '0 0 4px', letterSpacing: '-0.03em',
  },
  subtitle: { fontSize: 13, color: 'var(--color-muted)', margin: 0 },
  filterLabel: {
    display: 'flex', flexDirection: 'column', gap: 6,
    fontSize: 11, fontWeight: 700, color: 'var(--color-subtle)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  select: {
    minWidth: 220, padding: '8px 11px', border: '1px solid var(--color-line)',
    borderRadius: 8, fontSize: 13, color: 'var(--color-ink)',
    background: 'var(--bg-card)', textTransform: 'none', letterSpacing: 0,
  },
  summaryGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12, marginBottom: 16,
  },
  summaryCard: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'var(--bg-card)', border: '1px solid var(--color-line)',
    borderRadius: 10, padding: '14px 16px',
  },
  summaryIcon: {
    width: 32, height: 32, borderRadius: 8,
    display: 'grid', placeItems: 'center', flexShrink: 0,
  },
  summaryLabel: { fontSize: 12, color: 'var(--color-muted)', flex: 1 },
  summaryValue: {
    fontSize: 22, color: 'var(--color-ink)',
    fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
  },
  card: {
    background: 'var(--bg-card)', border: '1px solid var(--color-line)',
    borderRadius: 12, overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 16px', borderBottom: '1px solid var(--color-hairline)',
  },
  cardTitle: {
    fontSize: 13, fontWeight: 700, color: 'var(--color-ink)',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  cardHint: { fontSize: 12, color: 'var(--color-subtle)', marginTop: 2 },
  empty: { padding: 32, textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 880 },
  th: {
    textAlign: 'left', padding: '11px 14px', fontSize: 11,
    color: 'var(--color-subtle)', textTransform: 'uppercase',
    letterSpacing: '0.06em', borderBottom: '1px solid var(--color-hairline)',
  },
  td: {
    padding: '13px 14px', fontSize: 13, color: 'var(--color-ink)',
    borderBottom: '1px solid var(--color-hairline)', verticalAlign: 'middle',
  },
  row: { background: 'var(--bg-card)' },
  serviceTitle: { color: 'var(--color-ink)', fontWeight: 700, marginBottom: 2 },
  serviceStatus: { color: 'var(--color-muted)', fontSize: 12 },
  badge: {
    display: 'inline-flex', alignItems: 'center',
    borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 700,
  },
  mapLink: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 700,
  },
  muted: { color: 'var(--color-muted)' },
};
