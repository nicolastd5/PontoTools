import { useEffect, useMemo, useState } from 'react';
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
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

function accuracyRadius(value) {
  if (value == null || value === '') return null;
  const accuracy = Number(value);
  return Number.isFinite(accuracy) && accuracy > 0 ? accuracy : null;
}

function coordinatePair(location) {
  if (!location) return null;
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? [latitude, longitude] : null;
}

function hasCoordinates(location) {
  return coordinatePair(location) != null;
}

const STATUS_THEME = {
  online:  { key: 'online',  label: 'Online',    color: 'var(--color-ok)',     bg: 'var(--color-ok-soft)',     mapColor: '#16a34a' },
  recent:  { key: 'recent',  label: 'Recente',   color: 'var(--color-warn)',   bg: 'var(--color-warn-soft)',   mapColor: '#f59e0b' },
  offline: { key: 'offline', label: 'Sem sinal', color: 'var(--color-danger)', bg: 'var(--color-danger-soft)', mapColor: '#dc2626' },
};

const SERVICE_STATUS_LABEL = {
  pending:     'Pendente',
  in_progress: 'Em andamento',
};

export default function AdminServiceTrackingPage() {
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedServiceOrderId, setSelectedServiceOrderId] = useState(null);
  const unitId = selectedUnit ? Number.parseInt(selectedUnit, 10) : null;

  const { data: units = [] } = useUnits();
  const { data: locations = [], isLoading } = useLiveTracking(unitId);

  const selectedMapLocation = useMemo(() => {
    if (selectedServiceOrderId == null) return null;
    return locations.find((location) => String(location.service_order_id) === selectedServiceOrderId) || null;
  }, [locations, selectedServiceOrderId]);

  const summary = useMemo(() => locations.reduce((acc, location) => {
    const status = signalStatus(location);
    acc[status.key] += 1;
    return acc;
  }, { online: 0, recent: 0, offline: 0 }), [locations]);

  useEffect(() => {
    if (selectedServiceOrderId == null) return;
    if (!selectedMapLocation || !hasCoordinates(selectedMapLocation)) {
      setSelectedServiceOrderId(null);
    }
  }, [selectedMapLocation, selectedServiceOrderId]);

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
                          <button type="button" onClick={() => setSelectedServiceOrderId(String(location.service_order_id))} style={st.mapButton}>
                            <Icon name="pin" size={14} />
                            Ver mapa
                          </button>
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

      {selectedMapLocation && (
        <TrackingMapModal
          location={selectedMapLocation}
          onClose={() => setSelectedServiceOrderId(null)}
        />
      )}
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

function TrackingMapModal({ location, onClose }) {
  const position = coordinatePair(location);
  const signal = signalStatus(location);
  const radius = accuracyRadius(location.accuracy_meters);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!position) return null;

  return (
    <div style={st.modalBackdrop} onMouseDown={onClose}>
      <div style={st.modal} onMouseDown={(event) => event.stopPropagation()}>
        <div style={st.modalHeader}>
          <div>
            <div style={st.modalEyebrow}>Mapa</div>
            <h2 style={st.modalTitle}>{location.employee_name || 'Funcionario'}</h2>
            <div style={st.modalSubtitle}>{location.service_title || 'Servico sem titulo'}</div>
          </div>
          <button type="button" onClick={onClose} style={st.closeButton} aria-label="Fechar mapa">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div style={st.mapFrame}>
          <MapContainer
            key={location.service_order_id}
            center={position}
            zoom={16}
            scrollWheelZoom
            style={st.map}
          >
            <MapRecentering position={position} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {radius && (
              <Circle
                center={position}
                radius={radius}
                pathOptions={st.accuracyCircle}
              />
            )}
            <CircleMarker
              center={position}
              radius={9}
              pathOptions={{ ...st.currentPoint, fillColor: signal.mapColor }}
            >
              <Popup>
                <strong>{location.employee_name || 'Funcionario'}</strong>
                <br />
                {location.service_title || 'Servico sem titulo'}
                <br />
                Ultimo sinal: {formatSignalAge(location.signal_age_seconds)}
              </Popup>
            </CircleMarker>
          </MapContainer>
        </div>

        <div style={st.modalFooter}>
          <span style={st.currentPointLegend}>
            <span style={{ ...st.currentPointDot, background: signal.mapColor }} />
            Posicao atual
          </span>
          <span style={{ ...st.badge, color: signal.color, background: signal.bg }}>
            {signal.label}
          </span>
          <span style={st.modalMeta}>Precisao: {formatAccuracy(location.accuracy_meters)}</span>
          <span style={st.modalMeta}>{position[0].toFixed(6)}, {position[1].toFixed(6)}</span>
        </div>
      </div>
    </div>
  );
}

function MapRecentering({ position }) {
  const map = useMap();
  const [latitude, longitude] = position;

  useEffect(() => {
    map.setView([latitude, longitude], map.getZoom(), { animate: true });
  }, [latitude, longitude, map]);

  return null;
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
  mapButton: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 700,
    border: 0, background: 'transparent', padding: 0, cursor: 'pointer',
    font: 'inherit',
  },
  muted: { color: 'var(--color-muted)' },
  modalBackdrop: {
    position: 'fixed', inset: 0, zIndex: 1200,
    background: 'rgba(15, 23, 42, 0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 18,
  },
  modal: {
    width: 'min(760px, 100%)', maxHeight: 'calc(100vh - 36px)',
    background: 'var(--bg-card)', border: '1px solid var(--color-line)',
    borderRadius: 12, overflow: 'hidden',
    boxShadow: '0 22px 60px rgba(15, 23, 42, 0.24)',
  },
  modalHeader: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: 14, padding: '16px 18px', borderBottom: '1px solid var(--color-hairline)',
  },
  modalEyebrow: {
    fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
    color: 'var(--color-subtle)', letterSpacing: '0.06em', marginBottom: 4,
  },
  modalTitle: {
    margin: 0, color: 'var(--color-ink)', fontSize: 18, fontWeight: 800,
    letterSpacing: 0,
  },
  modalSubtitle: {
    color: 'var(--color-muted)', fontSize: 13, marginTop: 3,
  },
  closeButton: {
    width: 34, height: 34, borderRadius: 8,
    border: '1px solid var(--color-line)', background: 'var(--bg-soft)',
    color: 'var(--color-ink)', display: 'grid', placeItems: 'center',
    cursor: 'pointer', flexShrink: 0,
  },
  mapFrame: {
    height: 'min(56vh, 430px)', minHeight: 320,
    background: 'var(--bg-soft)',
  },
  map: { width: '100%', height: '100%' },
  accuracyCircle: {
    color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.08, opacity: 0.35, weight: 1,
  },
  currentPoint: {
    color: '#ffffff', fillColor: '#16a34a', fillOpacity: 1, opacity: 1, weight: 3,
  },
  modalFooter: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    padding: '12px 18px', borderTop: '1px solid var(--color-hairline)',
  },
  modalMeta: { color: 'var(--color-muted)', fontSize: 12, fontWeight: 600 },
  currentPointLegend: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    color: 'var(--color-ink)', fontSize: 12, fontWeight: 700,
  },
  currentPointDot: {
    width: 10, height: 10, borderRadius: 999,
    border: '2px solid var(--bg-card)', boxShadow: '0 0 0 1px rgba(15, 23, 42, 0.18)',
  },
};
