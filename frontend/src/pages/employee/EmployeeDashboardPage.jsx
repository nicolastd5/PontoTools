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
import Icon                  from '../../components/shared/Icon';

const CLOCK_TYPES = [
  { key: 'entry',       label: 'Entrada',         icon: 'play',   colorKey: 'ok'     },
  { key: 'break_start', label: 'Início Intervalo', icon: 'coffee', colorKey: 'warn'   },
  { key: 'break_end',   label: 'Fim Intervalo',    icon: 'arrow',  colorKey: 'info'   },
  { key: 'exit',        label: 'Saída',            icon: 'logout', colorKey: 'danger' },
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

  const weekday   = WEEKDAYS[now.getDay()].toUpperCase();
  const timeHHmm  = formatInTimeZone(now, TZ, 'HH:mm');
  const timeSS    = formatInTimeZone(now, TZ, 'ss');
  const dateLabel = now.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  const DOT_COLOR = {
    entry:       theme.ok,
    break_start: theme.warn,
    break_end:   theme.info,
    exit:        theme.danger,
  };

  const softKey = { ok: 'okSoft', warn: 'warnSoft', info: 'infoSoft', danger: 'dangerSoft' };

  return (
    <div>
      {/* Hero clock — fundo escuro com gradiente */}
      <div style={{
        background: `linear-gradient(135deg, ${theme.night} 0%, ${theme.night2} 100%)`,
        borderRadius: 20, padding: '28px 28px', color: '#fff',
        marginBottom: 16, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(circle at 100% 0%, ${theme.primary}30, transparent 50%)`,
        }}/>
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 12, color: '#ffffff80', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500, marginBottom: 8 }}>
            {weekday}
          </div>
          <div style={{ fontSize: 56, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}>
            {timeHHmm}
            <span style={{ color: '#ffffff60', fontSize: 28 }}>:{timeSS}</span>
          </div>
          <div style={{ fontSize: 13, color: '#ffffffaa' }}>{dateLabel}</div>
        </div>
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
        <div style={{ padding: '12px 16px', background: theme.card, borderRadius: 12, border: `1px solid ${theme.line}`, color: theme.muted, fontSize: 13, fontWeight: 500, marginBottom: 10 }}>
          Localização livre — você pode registrar de qualquer lugar.
        </div>
      )}

      {/* Banner serviço ativo */}
      {todayRecords.find((r) => r.clock_type === 'entry') && !todayRecords.find((r) => r.clock_type === 'exit') && (
        <div style={{ padding: '14px 16px', marginBottom: 16, background: theme.okSoft, border: `1px solid ${theme.ok}40`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: theme.ok, display: 'inline-block', flexShrink: 0 }}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: theme.ok, marginBottom: 2, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Serviço ativo</div>
            <div style={{ fontSize: 13, color: theme.ink }}>
              Iniciado às{' '}
              <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                {(() => {
                  const entry = todayRecords.find((r) => r.clock_type === 'entry');
                  return entry ? formatInTimeZone(new Date(entry.clocked_at_utc), entry.timezone || TZ, 'HH:mm') : '';
                })()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Botões de ponto — 2×2 grid com ícone */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {CLOCK_TYPES.map((ct) => {
          const color     = theme[ct.colorKey];
          const soft      = theme[softKey[ct.colorKey]] || theme.surface;
          const gpsBlocks = requireLocation && (!gpsOk || !isInsideZone);
          const seqBlocks = !available[ct.key];
          const disabled  = gpsBlocks || seqBlocks || clockMutation.isPending;
          return (
            <button
              key={ct.key}
              onClick={() => !disabled && handleClockClick(ct.key)}
              disabled={disabled}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                gap: 12, padding: '18px 16px',
                border: `1px solid ${disabled ? theme.line : color + '50'}`,
                borderRadius: 14, position: 'relative',
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                background: disabled ? theme.surface : theme.card,
                opacity: disabled ? 0.5 : 1,
                textAlign: 'left',
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: disabled ? theme.line : soft, display: 'grid', placeItems: 'center' }}>
                <Icon name={ct.icon} size={16} color={disabled ? theme.subtle : color}/>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: disabled ? theme.subtle : theme.ink, letterSpacing: '-0.01em', marginBottom: 2 }}>{ct.label}</div>
                <div style={{ fontSize: 11, color: theme.muted }}>{disabled ? 'Indisponível' : 'Toque para registrar'}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Banner fora da zona */}
      {requireLocation && gpsOk && !isInsideZone && distanceMeters !== null && (
        <div style={{ padding: '12px 14px', background: theme.dangerSoft, borderRadius: 10, border: `1px solid ${theme.danger}55`, color: theme.danger, fontSize: 13, fontWeight: 500, marginBottom: 16, lineHeight: 1.5 }}>
          Fora da zona — {Math.round(distanceMeters)}m de distância (limite: {user?.unit?.radiusMeters}m).
        </div>
      )}

      {/* Card de serviço */}
      {todayRecords.length > 0 && <ServiceCard records={todayRecords} />}

      {/* Registros de hoje */}
      {todayRecords.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: theme.subtle, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Hoje</span>
            <span style={{ fontSize: 11, color: theme.primary }}>{todayRecords.length} registro{todayRecords.length > 1 ? 's' : ''}</span>
          </div>
          <div style={{ background: theme.card, borderRadius: 14, border: `1px solid ${theme.line}`, overflow: 'hidden' }}>
            {todayRecords.map((r, i) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: i < todayRecords.length - 1 ? `1px solid ${theme.hairline}` : 'none' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: DOT_COLOR[r.clock_type] || theme.subtle, display: 'inline-block', flexShrink: 0 }}/>
                <span style={{ color: theme.ink, fontWeight: 500, fontSize: 13, flex: 1 }}>{CLOCK_TYPE_LABELS[r.clock_type]}</span>
                <span style={{ color: theme.ink, fontWeight: 600, fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>
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
