// App principal do funcionário — batida de ponto com GPS e câmera
import { useState, useEffect }  from 'react';
import { Navigate }             from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone }  from 'date-fns-tz';
import api                   from '../../services/api';
import { useAuth }           from '../../contexts/AuthContext';
import { useToast }          from '../../contexts/ToastContext';
import { useGeolocation }    from '../../hooks/useGeolocation';
import GpsStatus             from '../../components/employee/GpsStatus';
import CameraCapture         from '../../components/employee/CameraCapture';
import ServiceCard           from '../../components/employee/ServiceCard';

const CLOCK_TYPES = [
  { key: 'entry',       label: 'Entrada',           icon: '▶', color: '#16a34a', bg: '#f0fdf4' },
  { key: 'break_start', label: 'Início Intervalo',  icon: '⏸', color: '#d97706', bg: '#fffbeb' },
  { key: 'break_end',   label: 'Fim Intervalo',     icon: '▶', color: '#0369a1', bg: '#f0f9ff' },
  { key: 'exit',        label: 'Saída',             icon: '⏹', color: '#dc2626', bg: '#fef2f2' },
];

const CLOCK_TYPE_LABELS = {
  entry: 'Entrada', exit: 'Saída',
  break_start: 'Início intervalo', break_end: 'Fim intervalo',
};

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function EmployeeDashboardPage() {
  const { user }        = useAuth();
  const { success, error, warning } = useToast();
  const queryClient     = useQueryClient();
  const now             = useLiveClock();

  const [cameraFor, setCameraFor] = useState(null);
  const [gpsSnapshot, setGpsSnapshot] = useState(null);

  const { status: gpsStatus, coords, distanceMeters, isInsideZone } = useGeolocation(user?.unit);

  const { data: todayData } = useQuery({
    queryKey: ['clock-today'],
    queryFn:  () => api.get('/clock/today', { params: { timezone: TZ } }).then((r) => r.data),
    refetchInterval: 15 * 1000,
  });

  const clockMutation = useMutation({
    mutationFn: (formData) => api.post('/clock', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['clock-today']);
      success(`Ponto registrado! ${CLOCK_TYPE_LABELS[res.data.clockType]} às ${
        formatInTimeZone(new Date(res.data.clockedAtUtc), TZ, 'HH:mm')
      }`);
    },
    onError: (err) => {
      const data = err.response?.data;
      if (data?.blocked && data?.reason === 'outside_zone') {
        warning(`Bloqueado: você está a ${Math.round(data.distanceMeters)}m da unidade (máximo: ${data.radiusMeters}m).`);
      } else {
        error(data?.error || 'Erro ao registrar ponto. Tente novamente.');
      }
    },
  });

  const todayRecords    = todayData?.records || [];
  const requireLocation = todayData?.requireLocation ?? true;
  const available       = todayData?.available ?? { entry: true, break_start: false, break_end: false, exit: false };
  const maxPhotos       = todayData?.maxPhotos ?? 1;
  const gpsOk           = gpsStatus === 'granted';

  function handleClockClick(clockType) {
    if (requireLocation) {
      if (gpsStatus !== 'granted') {
        warning('Habilite o GPS para registrar o ponto.');
        return;
      }
      if (!isInsideZone) {
        warning(`Você está a ${Math.round(distanceMeters || 0)}m da unidade. Máximo permitido: ${user?.unit?.radiusMeters}m.`);
        return;
      }
    }
    setGpsSnapshot(coords || null);
    setCameraFor(clockType);
  }

  async function handlePhotoCapture(blobs) {
    const clockType = cameraFor;
    const coordsToSend = gpsSnapshot || coords;
    setCameraFor(null);

    const formData = new FormData();
    formData.append('clock_type', clockType);
    formData.append('timezone',   TZ);

    if (coordsToSend) {
      formData.append('latitude',  String(coordsToSend.latitude));
      formData.append('longitude', String(coordsToSend.longitude));
      formData.append('accuracy',  String(coordsToSend.accuracy || ''));
    } else {
      formData.append('latitude',  '0');
      formData.append('longitude', '0');
      formData.append('accuracy',  '');
    }

    if (blobs.length > 0) {
      blobs.forEach((blob, i) => formData.append('photo', blob, `photo_${i}.jpg`));
    } else {
      // Placeholder 1px JPEG quando o funcionário não tirou foto
      const dataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=';
      const blob = await (await fetch(dataUri)).blob();
      formData.append('photo', blob, 'photo.jpg');
    }

    try {
      await clockMutation.mutateAsync(formData);
    } finally {
      setGpsSnapshot(null);
    }
  }

  if (todayData?.servicesOnly) {
    return <Navigate to="/services" replace />;
  }

  return (
    <div>
      {/* Cabeçalho com relógio em tempo real */}
      <div style={styles.dateBar}>
        <span style={styles.dateText}>
          {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
        <span style={styles.timeText}>
          {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>

      {/* Status do GPS — oculto quando localização é livre e GPS não obtido */}
      {(requireLocation || gpsOk) && (
        <div style={{ marginBottom: 20 }}>
          <GpsStatus
            status={gpsStatus}
            distanceMeters={distanceMeters}
            isInsideZone={isInsideZone}
            radiusMeters={user?.unit?.radiusMeters}
            requireLocation={requireLocation}
          />
        </div>
      )}

      {/* Info quando localização é livre e GPS não está disponível */}
      {!requireLocation && !gpsOk && (
        <div style={{ ...styles.freeBanner, marginBottom: 20 }}>
          📍 Localização livre — você pode registrar de qualquer lugar.
        </div>
      )}

      {/* Info quando localização é livre e GPS está disponível */}
      {!requireLocation && gpsOk && distanceMeters !== null && (
        <div style={{ ...styles.freeBanner, marginBottom: 20 }}>
          📍 {Math.round(distanceMeters)}m da unidade — localização livre para este cargo.
        </div>
      )}

      {/* Botões de batida */}
      {/* Card de serviço em andamento / concluído */}
      {todayRecords.length > 0 && (
        <ServiceCard records={todayRecords} />
      )}
      <div style={styles.clockGrid}>
        {CLOCK_TYPES.map((ct) => {
          const gpsBlocks = requireLocation && (!gpsOk || !isInsideZone);
          const seqBlocks = !available[ct.key];
          const disabled  = gpsBlocks || seqBlocks || clockMutation.isPending;
          return (
            <button
              key={ct.key}
              onClick={() => handleClockClick(ct.key)}
              disabled={disabled}
              style={{
                ...styles.clockBtn,
                background:  disabled ? '#f1f5f9' : ct.bg,
                borderColor: disabled ? '#e2e8f0' : ct.color + '40',
                color:       disabled ? '#94a3b8' : ct.color,
                cursor:      disabled ? 'not-allowed' : 'pointer',
                opacity:     seqBlocks && !gpsBlocks ? 0.45 : clockMutation.isPending ? 0.7 : 1,
              }}
            >
              <span style={styles.clockIcon}>{ct.icon}</span>
              <span style={styles.clockLabel}>{ct.label}</span>
              {requireLocation && !gpsOk && <span style={styles.lockIcon}>🔒</span>}
              {(!requireLocation || gpsOk) && seqBlocks && <span style={styles.lockIcon}>⏸</span>}
            </button>
          );
        })}
      </div>

      {/* Aviso de bloqueio por zona (só quando localização é exigida) */}
      {requireLocation && gpsOk && !isInsideZone && distanceMeters !== null && (
        <div style={styles.blockedBanner}>
          ⛔ Fora da zona — {Math.round(distanceMeters)}m de distância
          (limite: {user?.unit?.radiusMeters}m). Aproxime-se da unidade para registrar o ponto.
        </div>
      )}

      {/* Registros de hoje */}
      {todayRecords.length > 0 && (
        <div style={styles.todayBox}>
          <h3 style={styles.todayTitle}>Registros de Hoje</h3>
          {todayRecords.map((r) => (
            <div key={r.id} style={styles.todayRecord}>
              <div style={styles.todayType}>{CLOCK_TYPE_LABELS[r.clock_type]}</div>
              <div style={styles.todayTime}>
                {formatInTimeZone(new Date(r.clocked_at_utc), r.timezone || TZ, 'HH:mm')}
              </div>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: r.is_inside_zone ? '#16a34a' : '#dc2626',
              }} />
            </div>
          ))}
        </div>
      )}

      {/* Modal de câmera */}
      {cameraFor && (
        <CameraCapture
          clockType={cameraFor}
          maxPhotos={maxPhotos}
          onCapture={handlePhotoCapture}
          onCancel={() => {
            setCameraFor(null);
            setGpsSnapshot(null);
          }}
        />
      )}
    </div>
  );
}

const styles = {
  dateBar: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   20,
  },
  dateText: { fontSize: 14, color: '#475569', textTransform: 'capitalize', fontWeight: 500 },
  timeText: { fontSize: 18, fontWeight: 800, color: '#0f172a', fontVariant: 'tabular-nums' },
  clockGrid: {
    display:             'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap:                 12,
    marginBottom:        16,
  },
  clockBtn: {
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    gap:           8,
    padding:       '20px 16px',
    border:        '2px solid',
    borderRadius:  14,
    transition:    'all 0.15s',
    position:      'relative',
  },
  clockIcon:  { fontSize: 28 },
  clockLabel: { fontSize: 13, fontWeight: 700 },
  lockIcon: {
    position: 'absolute', top: 8, right: 8,
    fontSize: 14, opacity: 0.6,
  },
  freeBanner: {
    padding:      '12px 16px',
    background:   '#f8fafc',
    borderRadius: 10,
    border:       '1px solid #e2e8f0',
    color:        '#64748b',
    fontSize:     13,
    fontWeight:   500,
  },
  blockedBanner: {
    padding:      '12px 16px',
    background:   '#fef2f2',
    borderRadius: 10,
    border:       '1px solid #fca5a5',
    color:        '#dc2626',
    fontSize:     13,
    fontWeight:   500,
    marginBottom: 16,
    lineHeight:   1.5,
  },
  todayBox: {
    background:   '#fff',
    borderRadius: 12,
    border:       '1px solid #e2e8f0',
    overflow:     'hidden',
    marginTop:    8,
  },
  todayTitle: {
    fontSize:     14, fontWeight: 700, color: '#0f172a',
    padding:      '14px 16px', borderBottom: '1px solid #f1f5f9',
  },
  todayRecord: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '12px 16px',
    borderBottom:   '1px solid #f8fafc',
    fontSize:       14,
  },
  todayType: { color: '#374151', fontWeight: 500 },
  todayTime: { color: '#0f172a', fontWeight: 700 },
};
