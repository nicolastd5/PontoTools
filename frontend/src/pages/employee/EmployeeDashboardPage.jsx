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

/* ── Ícone SVG inline ── */
const Icon = ({ d, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

/* Ícones por tipo de batida */
const CLOCK_ICONS = {
  entry:       'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4 M10 17l5-5-5-5 M15 12H3',
  break_start: 'M10 9v6M14 9v6 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  break_end:   'M5 3l14 9-14 9V3z',
  exit:        'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
};

/* Cores por tipo */
const CLOCK_COLORS = {
  entry:       { main: '#10b981', soft: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
  break_start: { main: '#f59e0b', soft: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  break_end:   { main: '#0ea5e9', soft: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.3)' },
  exit:        { main: '#ef4444', soft: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)'  },
};

const CLOCK_TYPES = [
  { key: 'entry',       label: 'Entrada',         sub: 'Início do turno'   },
  { key: 'break_start', label: 'Início Intervalo', sub: 'Pausa para descanso' },
  { key: 'break_end',   label: 'Fim Intervalo',    sub: 'Retorno ao trabalho' },
  { key: 'exit',        label: 'Saída',            sub: 'Encerrar turno'   },
];

const CLOCK_TYPE_LABELS = {
  entry: 'Entrada', exit: 'Saída',
  break_start: 'Início intervalo', break_end: 'Fim intervalo',
};

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #4f46e5, #8b5cf6)',
  'linear-gradient(135deg, #0ea5e9, #4f46e5)',
  'linear-gradient(135deg, #10b981, #0ea5e9)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
];

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
  const { success, error, warning } = useToast();
  const queryClient     = useQueryClient();
  const now             = useLiveClock();

  const [cameraFor, setCameraFor]     = useState(null);
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
      if (gpsStatus !== 'granted') { warning('Habilite o GPS para registrar o ponto.'); return; }
      if (!isInsideZone) { warning(`Você está a ${Math.round(distanceMeters || 0)}m da unidade. Máximo: ${user?.unit?.radiusMeters}m.`); return; }
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

  const initials   = user?.name ? user.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() : '?';
  const avatarGrad = AVATAR_GRADIENTS[(user?.name || '').charCodeAt(0) % AVATAR_GRADIENTS.length] || AVATAR_GRADIENTS[0];

  const weekday  = WEEKDAYS[now.getDay()].toUpperCase();
  const timeHHmm = formatInTimeZone(now, TZ, 'HH:mm');
  const timeSS   = formatInTimeZone(now, TZ, 'ss');
  const dateLabel = now.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>

      {/* ── Saudação ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Olá,</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{user?.name}</div>
        </div>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: avatarGrad,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, color: '#fff', fontSize: 14,
        }}>
          {initials}
        </div>
      </div>

      {/* ── Hero clock card ── */}
      <div style={{
        borderRadius: 16, marginBottom: 12,
        background: 'linear-gradient(135deg, #09090b 0%, #1c1c1f 100%)',
        position: 'relative', overflow: 'hidden',
        padding: '20px 24px 22px',
        border: '1px solid #27272a',
      }}>
        {/* Radial glow */}
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 160, height: 160,
          borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(79,70,229,0.25) 0%, transparent 70%)',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(161,161,170,0.6)', textTransform: 'uppercase', marginBottom: 6 }}>
            {weekday}
          </div>
          <div style={{
            fontSize: 52, fontWeight: 800, lineHeight: 1,
            fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.03em', color: '#f4f4f5',
          }}>
            {timeHHmm}
            <span style={{ fontSize: 26, color: 'rgba(244,244,245,0.45)', fontWeight: 600 }}>:{timeSS}</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(161,161,170,0.55)', marginTop: 6 }}>{dateLabel}</div>
        </div>
      </div>

      {/* ── GPS status ── */}
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
        <div style={{ padding: '11px 14px', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-default)', color: 'var(--color-muted)', fontSize: 13, fontWeight: 500, marginBottom: 10 }}>
          Localização livre — você pode registrar de qualquer lugar.
        </div>
      )}

      {!requireLocation && gpsOk && distanceMeters !== null && (
        <div style={{ padding: '11px 14px', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-default)', color: 'var(--color-muted)', fontSize: 13, fontWeight: 500, marginBottom: 10 }}>
          {Math.round(distanceMeters)}m da unidade — localização livre para este cargo.
        </div>
      )}

      {/* Fora da zona */}
      {requireLocation && gpsOk && !isInsideZone && distanceMeters !== null && (
        <div style={{ padding: '11px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.25)', color: 'var(--color-danger)', fontSize: 13, fontWeight: 500, marginBottom: 10, lineHeight: 1.5 }}>
          Fora da zona — {Math.round(distanceMeters)}m (limite: {user?.unit?.radiusMeters}m).
        </div>
      )}

      {/* Serviço ativo */}
      {todayRecords.length > 0 && <ServiceCard records={todayRecords} />}

      {/* ── Botões de ponto ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16, marginTop: 4 }}>
        {CLOCK_TYPES.map((ct) => {
          const clr       = CLOCK_COLORS[ct.key];
          const gpsBlocks = requireLocation && (!gpsOk || !isInsideZone);
          const seqBlocks = !available[ct.key];
          const disabled  = gpsBlocks || seqBlocks || clockMutation.isPending;

          return (
            <button
              key={ct.key}
              onClick={() => handleClockClick(ct.key)}
              disabled={disabled}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10,
                padding: '16px 14px 14px',
                borderRadius: 14,
                border: `1px solid ${disabled ? 'var(--border-default)' : clr.border}`,
                background: disabled ? 'var(--bg-card)' : clr.soft,
                color:      disabled ? 'var(--color-subtle)' : clr.main,
                cursor:     disabled ? 'not-allowed' : 'pointer',
                opacity:    seqBlocks && !gpsBlocks ? 0.45 : clockMutation.isPending ? 0.7 : 1,
                transition: 'all 0.15s',
                textAlign:  'left',
              }}
              onMouseEnter={(e) => {
                if (disabled) return;
                e.currentTarget.style.transform  = 'translateY(-1px)';
                e.currentTarget.style.boxShadow  = `0 8px 20px -8px ${clr.main}55`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Ícone no topo */}
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: disabled ? 'var(--color-hairline)' : clr.border,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon d={CLOCK_ICONS[ct.key]} size={18} />
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{ct.label}</div>
                <div style={{ fontSize: 11, fontWeight: 500, color: disabled ? 'var(--color-subtle)' : 'inherit', opacity: 0.7, marginTop: 2 }}>
                  {disabled && seqBlocks ? 'Indisponível' : ct.sub}
                </div>
              </div>

              {/* Lock/pause indicator */}
              {requireLocation && !gpsOk && (
                <div style={{ position: 'absolute', top: 8, right: 10, fontSize: 12, opacity: 0.5 }}>🔒</div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Registros de hoje ── */}
      {todayRecords.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-subtle)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Hoje
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600, color: 'var(--color-primary)',
              background: 'var(--color-primary-soft)', padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
            }}>
              {todayRecords.length} registro{todayRecords.length > 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-default)', overflow: 'hidden' }}>
            {todayRecords.map((r, i) => {
              const clr = CLOCK_COLORS[r.clock_type] || { main: 'var(--color-muted)' };
              return (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderBottom: i < todayRecords.length - 1 ? '1px solid var(--color-hairline)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: clr.main, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                      {CLOCK_TYPE_LABELS[r.clock_type]}
                    </span>
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatInTimeZone(new Date(r.clocked_at_utc), r.timezone || TZ, 'HH:mm')}
                  </span>
                </div>
              );
            })}
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
