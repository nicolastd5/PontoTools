import { useState, useEffect }  from 'react';
import { Navigate }             from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone }  from 'date-fns-tz';
import api                   from '../../services/api';
import { useAuth }           from '../../contexts/AuthContext';
import { useTheme }          from '../../contexts/ThemeContext';
import { useToast }          from '../../contexts/ToastContext';
import { useGeolocation }    from '../../hooks/useGeolocation';
import GpsStatus             from '../../components/employee/GpsStatus';
import CameraCapture         from '../../components/employee/CameraCapture';
import ServiceCard           from '../../components/employee/ServiceCard';

const CLOCK_TYPES = [
  { key: 'entry',       label: 'Entrada',          colorKey: 'success' },
  { key: 'break_start', label: 'Início Intervalo',  colorKey: 'warning' },
  { key: 'break_end',   label: 'Fim Intervalo',     colorKey: 'info'    },
  { key: 'exit',        label: 'Saída',             colorKey: 'danger'  },
];

const CLOCK_TYPE_LABELS = {
  entry: 'Entrada', exit: 'Saída',
  break_start: 'Início intervalo', break_end: 'Fim intervalo',
};

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

const WEEKDAYS = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];

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
  const { theme }       = useTheme();
  const { success, error, warning } = useToast();
  const queryClient     = useQueryClient();
  const now             = useLiveClock();

  const [cameraFor, setCameraFor]       = useState(null);
  const [gpsSnapshot, setGpsSnapshot]   = useState(null);

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
    const clockType    = cameraFor;
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

  if (todayData?.servicesOnly) return <Navigate to="/services" replace />;

  const initials = user?.name
    ? user.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : '?';

  const weekday   = WEEKDAYS[now.getDay()].toUpperCase();
  const timeHHmm  = formatInTimeZone(now, TZ, 'HH:mm');
  const timeSS    = formatInTimeZone(now, TZ, 'ss');
  const dateLabel = now.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });

  const DOT_COLOR = { entry: theme.success, break_start: theme.warning, break_end: theme.info, exit: theme.danger };

  return (
    <div>
      {/* Saudação */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, color: theme.textSecondary }}>Olá,</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: theme.textPrimary }}>{user?.name}</div>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 20, background: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 13 }}>
          {initials}
        </div>
      </div>

      {/* Relógio */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: theme.accent, textTransform: 'uppercase', marginBottom: 4 }}>{weekday}</div>
        <div style={{ fontSize: 48, fontWeight: 800, color: theme.textPrimary, fontVariantNumeric: 'tabular-nums', letterSpacing: 2, lineHeight: 1 }}>
          {timeHHmm}
          <span style={{ fontSize: 26, opacity: 0.5 }}>:{timeSS}</span>
        </div>
        <div style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>{dateLabel}</div>
      </div>

      {/* Status GPS */}
      {(requireLocation || gpsOk) && (
        <div style={{ marginBottom: 10 }}>
          <GpsStatus
            status={gpsStatus}
            distanceMeters={distanceMeters}
            isInsideZone={isInsideZone}
            radiusMeters={user?.unit?.radiusMeters}
            requireLocation={requireLocation}
          />
        </div>
      )}

      {!requireLocation && !gpsOk && (
        <div style={{ padding: '12px 14px', background: theme.surface, borderRadius: 12, border: `1px solid ${theme.border}`, color: theme.textSecondary, fontSize: 13, fontWeight: 500, marginBottom: 10 }}>
          Localização livre — você pode registrar de qualquer lugar.
        </div>
      )}

      {!requireLocation && gpsOk && distanceMeters !== null && (
        <div style={{ padding: '12px 14px', background: theme.surface, borderRadius: 12, border: `1px solid ${theme.border}`, color: theme.textSecondary, fontSize: 13, fontWeight: 500, marginBottom: 10 }}>
          {Math.round(distanceMeters)}m da unidade — localização livre para este cargo.
        </div>
      )}

      {/* Card de serviço */}
      {todayRecords.length > 0 && <ServiceCard records={todayRecords} />}

      {/* Botões de ponto */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16, marginTop: 4 }}>
        {CLOCK_TYPES.map((ct) => {
          const color     = theme[ct.colorKey];
          const gpsBlocks = requireLocation && (!gpsOk || !isInsideZone);
          const seqBlocks = !available[ct.key];
          const disabled  = gpsBlocks || seqBlocks || clockMutation.isPending;
          return (
            <button
              key={ct.key}
              onClick={() => handleClockClick(ct.key)}
              disabled={disabled}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '20px 12px', border: `1.5px solid`,
                borderColor: disabled ? theme.border : color + '55',
                borderRadius: 14,
                background:  disabled ? theme.elevated : color + '18',
                color:       disabled ? theme.textMuted : color,
                cursor:      disabled ? 'not-allowed' : 'pointer',
                opacity:     seqBlocks && !gpsBlocks ? 0.45 : clockMutation.isPending ? 0.7 : 1,
                position:    'relative',
                transition:  'all 0.15s',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700 }}>{ct.label}</span>
              {requireLocation && !gpsOk && <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 12, opacity: 0.6 }}>🔒</span>}
              {(!requireLocation || gpsOk) && seqBlocks && <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 12, opacity: 0.6 }}>⏸</span>}
            </button>
          );
        })}
      </div>

      {/* Banner bloqueado por zona */}
      {requireLocation && gpsOk && !isInsideZone && distanceMeters !== null && (
        <div style={{ padding: '12px 14px', background: theme.danger + '18', borderRadius: 10, border: `1px solid ${theme.danger}55`, color: theme.danger, fontSize: 13, fontWeight: 500, marginBottom: 16, lineHeight: 1.5 }}>
          Fora da zona — {Math.round(distanceMeters)}m de distância (limite: {user?.unit?.radiusMeters}m).
        </div>
      )}

      {/* Registros de hoje */}
      {todayRecords.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Hoje</span>
            <span style={{ fontSize: 11, color: theme.accent }}>{todayRecords.length} registro{todayRecords.length > 1 ? 's' : ''}</span>
          </div>
          <div style={{ background: theme.surface, borderRadius: 12, border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
            {todayRecords.map((r, i) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < todayRecords.length - 1 ? `1px solid ${theme.border}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: DOT_COLOR[r.clock_type] || theme.textMuted }} />
                  <span style={{ fontSize: 13, color: theme.textPrimary }}>{CLOCK_TYPE_LABELS[r.clock_type]}</span>
                </div>
                <span style={{ fontSize: 13, color: theme.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
                  {formatInTimeZone(new Date(r.clocked_at_utc), r.timezone || TZ, 'HH:mm')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {cameraFor && (
        <CameraCapture
          clockType={cameraFor}
          maxPhotos={maxPhotos}
          onCapture={handlePhotoCapture}
          onCancel={() => { setCameraFor(null); setGpsSnapshot(null); }}
        />
      )}
    </div>
  );
}
