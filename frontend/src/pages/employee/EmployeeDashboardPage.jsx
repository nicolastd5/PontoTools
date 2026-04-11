// App principal do funcionário — batida de ponto com GPS e câmera
import { useState }         from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone }  from 'date-fns-tz';
import api                   from '../../services/api';
import { useAuth }           from '../../contexts/AuthContext';
import { useToast }          from '../../contexts/ToastContext';
import { useGeolocation }    from '../../hooks/useGeolocation';
import GpsStatus             from '../../components/employee/GpsStatus';
import CameraCapture         from '../../components/employee/CameraCapture';

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

export default function EmployeeDashboardPage() {
  const { user }        = useAuth();
  const { success, error, warning } = useToast();
  const queryClient     = useQueryClient();

  const [cameraFor, setCameraFor] = useState(null); // clock_type em andamento

  // GPS em tempo real
  const { status: gpsStatus, coords, distanceMeters, isInsideZone } = useGeolocation(user?.unit);

  // Registros de hoje para mostrar na tela
  const { data: todayData } = useQuery({
    queryKey:        ['clock-today'],
    queryFn:         () => api.get('/clock/today').then((r) => r.data),
    refetchInterval: 30 * 1000,
  });

  // Mutation de batida de ponto
  const clockMutation = useMutation({
    mutationFn: (formData) => api.post('/clock', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['clock-today']);
      success(`Ponto registrado! ${CLOCK_TYPE_LABELS[res.data.clockType]} às ${
        formatInTimeZone(new Date(res.data.clockedAtUtc), Intl.DateTimeFormat().resolvedOptions().timeZone, 'HH:mm')
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

  async function handleClockClick(clockType) {
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
    setCameraFor(clockType);
  }

  async function handlePhotoCapture(blob) {
    const clockType = cameraFor;
    setCameraFor(null);

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const formData = new FormData();
    formData.append('clock_type', clockType);
    formData.append('latitude',   String(coords.latitude));
    formData.append('longitude',  String(coords.longitude));
    formData.append('accuracy',   String(coords.accuracy || ''));
    formData.append('timezone',   tz);
    formData.append('photo',      blob, 'photo.jpg');

    await clockMutation.mutateAsync(formData);
  }

  const todayRecords    = todayData?.records || [];
  const requireLocation = todayData?.requireLocation ?? true;
  const gpsOk           = gpsStatus === 'granted';

  return (
    <div>
      {/* Cabeçalho com data atual */}
      <div style={styles.dateBar}>
        <span style={styles.dateText}>
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
        <span style={styles.timeText}>
          {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Status do GPS */}
      <div style={{ marginBottom: 20 }}>
        <GpsStatus
          status={gpsStatus}
          distanceMeters={distanceMeters}
          isInsideZone={isInsideZone}
          radiusMeters={user?.unit?.radiusMeters}
        />
      </div>

      {/* Botões de batida — só habilitados dentro da zona */}
      <div style={styles.clockGrid}>
        {CLOCK_TYPES.map((ct) => {
          const gpsBlocks = requireLocation && (!gpsOk || !isInsideZone);
          const disabled  = gpsBlocks || clockMutation.isPending;
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
                opacity:     clockMutation.isPending ? 0.7 : 1,
              }}
            >
              <span style={styles.clockIcon}>{ct.icon}</span>
              <span style={styles.clockLabel}>{ct.label}</span>
              {requireLocation && !gpsOk && <span style={styles.lockIcon}>🔒</span>}
            </button>
          );
        })}
      </div>

      {/* Aviso de bloqueio (só quando localização é exigida) */}
      {requireLocation && gpsOk && !isInsideZone && distanceMeters !== null && (
        <div style={styles.blockedBanner}>
          ⛔ Fora da zona — {Math.round(distanceMeters)}m de distância
          (limite: {user?.unit?.radiusMeters}m). Aproxime-se da unidade para registrar o ponto.
        </div>
      )}
      {/* Info quando localização é livre */}
      {!requireLocation && distanceMeters !== null && (
        <div style={styles.freeBanner}>
          📍 {Math.round(distanceMeters)}m da unidade — localização livre para este cargo.
        </div>
      )}

      {/* Registros de hoje */}
      {todayRecords.length > 0 && (
        <div style={styles.todayBox}>
          <h3 style={styles.todayTitle}>Registros de Hoje</h3>
          {todayRecords.map((r) => (
            <div key={r.id} style={styles.todayRecord}>
              <div style={styles.todayType}>
                {CLOCK_TYPE_LABELS[r.clock_type]}
              </div>
              <div style={styles.todayTime}>
                {formatInTimeZone(
                  new Date(r.clocked_at_utc),
                  r.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
                  'HH:mm'
                )}
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
          onCapture={handlePhotoCapture}
          onCancel={() => setCameraFor(null)}
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
  timeText: { fontSize: 18, fontWeight: 800, color: '#0f172a' },
  clockGrid: {
    display:             'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap:                 12,
    marginBottom:        16,
  },
  clockBtn: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    gap:            8,
    padding:        '20px 16px',
    border:         '2px solid',
    borderRadius:   14,
    transition:     'all 0.15s',
    position:       'relative',
  },
  clockIcon:  { fontSize: 28 },
  clockLabel: { fontSize: 13, fontWeight: 700 },
  lockIcon: {
    position:  'absolute', top: 8, right: 8,
    fontSize:  14, opacity: 0.6,
  },
  freeBanner: {
    padding:      '12px 16px',
    background:   '#f8fafc',
    borderRadius: 10,
    border:       '1px solid #e2e8f0',
    color:        '#64748b',
    fontSize:     13,
    fontWeight:   500,
    marginBottom: 16,
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
