import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, SafeAreaView,
  TextInput, Modal, Image, RefreshControl,
} from 'react-native';
import { formatInTimeZone } from 'date-fns-tz';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useGeolocation } from '../hooks/useGeolocation';
import api from '../services/api';
import TabBar from '../components/TabBar';
import CameraModal from '../components/CameraModal';

type Screen = 'dashboard' | 'history' | 'services' | 'notifications' | 'profile';

const CLOCK_TYPES = [
  { key: 'entry',       label: 'Entrada',          sub: 'Início do turno',     colorKey: 'success' },
  { key: 'break_start', label: 'Início Intervalo',  sub: 'Pausa para descanso', colorKey: 'warning' },
  { key: 'break_end',   label: 'Fim Intervalo',     sub: 'Retorno ao trabalho', colorKey: 'info'    },
  { key: 'exit',        label: 'Saída',             sub: 'Encerrar turno',      colorKey: 'danger'  },
] as const;

type ClockType = typeof CLOCK_TYPES[number]['key'];

const LABELS: Record<ClockType, string> = {
  entry: 'Entrada', exit: 'Saída',
  break_start: 'Início intervalo', break_end: 'Fim intervalo',
};

/* Icon paths */
const ICONS: Record<string, string> = {
  entry:       'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4 M10 17l5-5-5-5 M15 12H3',
  break_start: 'M10 9v6M14 9v6 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  break_end:   'M5 3l14 9-14 9V3z',
  exit:        'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  pin:         'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
};

interface ClockRecord {
  id: number;
  clock_type: string;
  clocked_at_utc: string;
  timezone: string;
  is_inside_zone: boolean;
}

interface Available {
  entry: boolean; break_start: boolean; break_end: boolean; exit: boolean;
}

interface GpsSnapshot { latitude: number; longitude: number; accuracy?: number; }

const AVATAR_GRADIENTS = [
  ['#4f46e5', '#8b5cf6'],
  ['#0ea5e9', '#4f46e5'],
  ['#10b981', '#0ea5e9'],
  ['#f59e0b', '#ef4444'],
  ['#8b5cf6', '#ec4899'],
];
function avatarColors(name: string) {
  const code = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[code % AVATAR_GRADIENTS.length];
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/* Simple SVG-like icon via Text for RN (Unicode fallback) */
const DOT_COLORS: Record<string, string> = {
  entry: '#10b981', break_start: '#f59e0b', break_end: '#0ea5e9', exit: '#ef4444',
};

export default function DashboardScreen({
  onNavigate, unreadCount = 0, servicesOnly = false,
}: {
  onNavigate: (s: Screen) => void;
  unreadCount?: number;
  servicesOnly?: boolean;
}) {
  const { user }  = useAuth();
  const { theme } = useTheme();
  const { status: gpsStatus, coords, distanceMeters, isInsideZone } = useGeolocation(user?.unit);
  const now = useClock();
  const tz  = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [loading, setLoading]               = useState(false);
  const [refreshing, setRefreshing]         = useState(false);
  const [todayRecords, setTodayRecords]     = useState<ClockRecord[]>([]);
  const [available, setAvailable]           = useState<Available>({ entry: true, break_start: false, break_end: false, exit: false });
  const [maxPhotos, setMaxPhotos]           = useState(1);
  const [requireLocation, setRequireLocation] = useState(true);
  const [confirmModal, setConfirmModal]     = useState<ClockType | null>(null);
  const [observation, setObservation]       = useState('');
  const [photoUris, setPhotoUris]           = useState<string[]>([]);
  const [cameraFacing, setCameraFacing]     = useState<'front' | 'back'>('front');
  const [cameraOpen, setCameraOpen]         = useState(false);
  const [gpsSnapshot, setGpsSnapshot]       = useState<GpsSnapshot | null>(null);

  function loadToday() {
    api.get('/clock/today', { params: { timezone: tz } })
      .then((r) => {
        setTodayRecords(r.data.records || []);
        if (r.data.available)                   setAvailable(r.data.available);
        if (r.data.maxPhotos)                   setMaxPhotos(r.data.maxPhotos);
        if (r.data.requireLocation !== undefined) setRequireLocation(r.data.requireLocation);
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadToday();
    const id = setInterval(loadToday, 15 * 1000);
    return () => clearInterval(id);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    api.get('/clock/today', { params: { timezone: tz } })
      .then((r) => {
        setTodayRecords(r.data.records || []);
        if (r.data.available)                    setAvailable(r.data.available);
        if (r.data.maxPhotos)                    setMaxPhotos(r.data.maxPhotos);
        if (r.data.requireLocation !== undefined) setRequireLocation(r.data.requireLocation);
      })
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [tz]);

  const handleClockPress = useCallback((clockType: ClockType) => {
    if (requireLocation) {
      if (gpsStatus !== 'granted') { Alert.alert('GPS necessário', 'Habilite a localização para registrar.'); return; }
      if (!isInsideZone)           { Alert.alert('Fora da zona', `Você está a ${Math.round(distanceMeters ?? 0)}m. Máximo: ${user?.unit?.radiusMeters}m.`); return; }
    }
    setObservation(''); setPhotoUris([]); setCameraFacing('front');
    setGpsSnapshot(coords ? { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy } : null);
    setConfirmModal(clockType);
  }, [gpsStatus, isInsideZone, coords, distanceMeters, user, requireLocation]);

  const handleOpenCamera   = useCallback((facing: 'front' | 'back') => { setCameraFacing(facing); setCameraOpen(true); }, []);
  const handleCameraCapture = useCallback((uri: string) => { setCameraOpen(false); setPhotoUris((p) => [...p, uri]); }, []);
  const handleCameraCancel  = useCallback(() => { setCameraOpen(false); }, []);

  async function submitClock() {
    if (!confirmModal) return;
    const clockType    = confirmModal;
    const coordsToSend = gpsSnapshot || coords;
    setConfirmModal(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('clock_type', clockType);
      formData.append('timezone',   tz);
      formData.append('latitude',   coordsToSend ? String(coordsToSend.latitude)  : '0');
      formData.append('longitude',  coordsToSend ? String(coordsToSend.longitude) : '0');
      formData.append('accuracy',   coordsToSend ? String(coordsToSend.accuracy ?? '') : '');
      if (observation.trim()) formData.append('observation', observation.trim());
      if (photoUris.length > 0) {
        photoUris.forEach((uri, i) => formData.append('photo', { uri, type: 'image/jpeg', name: `photo_${i}.jpg` } as any));
      } else {
        const dataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=';
        const photoBlob = await (await fetch(dataUri)).blob();
        formData.append('photo', photoBlob, 'photo.jpg');
      }
      const res = await api.post('/clock', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      setTodayRecords((prev) => [...prev, { id: res.data.id, clock_type: res.data.clockType, clocked_at_utc: res.data.clockedAtUtc, timezone: tz, is_inside_zone: res.data.isInsideZone }]);
      loadToday();
      Alert.alert('Registro efetuado!', `${LABELS[clockType]} às ${formatInTimeZone(new Date(res.data.clockedAtUtc), tz, 'HH:mm:ss')}`);
    } catch (err: any) {
      const data   = err?.response?.data;
      const status = err?.response?.status;
      if (data?.blocked) {
        Alert.alert('Bloqueado', `Você está a ${Math.round(data.distanceMeters)}m da unidade.`);
      } else {
        const msg =
          data?.error ||
          (status === 413 ? 'Foto grande demais para envio.' :
           status === 401 ? 'Sessão expirada, faça login novamente.' :
           err?.code === 'ECONNABORTED' ? 'Tempo esgotado — verifique sua conexão.' :
           err?.message || 'Erro ao registrar.');
        Alert.alert('Erro', msg);
      }
    } finally { setLoading(false); setGpsSnapshot(null); }
  }

  const gpsOk          = gpsStatus === 'granted';
  const gpsBlocksButtons = !gpsOk || (requireLocation && !isInsideZone);

  const initials = user?.name
    ? user.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
    : '?';
  const [avatarStart, avatarEnd] = avatarColors(user?.name || '');

  /* GPS indicator values */
  const gpsColor = gpsOk
    ? (requireLocation && !isInsideZone ? theme.danger : theme.success)
    : theme.warning;
  const gpsBg = gpsOk
    ? (requireLocation && !isInsideZone ? theme.dangerSoft : theme.successSoft)
    : theme.warningSoft;
  const gpsText = (() => {
    if (gpsStatus === 'loading')     return 'Obtendo localização GPS...';
    if (gpsStatus === 'denied')      return 'GPS negado — habilite nas configurações';
    if (gpsStatus === 'unavailable') return 'GPS indisponível';
    if (!requireLocation)            return `GPS ativo · ${Math.round(distanceMeters ?? 0)}m da unidade`;
    if (isInsideZone)                return 'Localização validada';
    return `Fora da zona — ${Math.round(distanceMeters ?? 0)}m`;
  })();
  const gpsDetail = (() => {
    if (!requireLocation && gpsOk)      return `Fora da zona não bloqueia · ${Math.round(distanceMeters ?? 0)}m`;
    if (requireLocation && isInsideZone) return `Dentro da zona · ${Math.round(distanceMeters ?? 0)}m`;
    if (requireLocation && !isInsideZone) return `Máximo: ${user?.unit?.radiusMeters}m`;
    return '';
  })();

  const weekday = now.toLocaleDateString('pt-BR', { weekday: 'long' }).toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24, backgroundColor: theme.bg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[theme.primary]} tintColor={theme.primary} />}
      >

        {/* Header: saudação + avatar */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View>
            <Text style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '500' }}>Olá,</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5 }}>{user?.name}</Text>
          </View>
          {/* Avatar com gradiente */}
          <View style={{
            width: 42, height: 42, borderRadius: 12,
            backgroundColor: avatarStart,
            justifyContent: 'center', alignItems: 'center',
            shadowColor: avatarStart, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
          }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{initials}</Text>
          </View>
        </View>

        {/* Hero clock card */}
        <View style={{
          borderRadius: 20, padding: 20, marginBottom: 12,
          backgroundColor: '#09090b',
          shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24,
          overflow: 'hidden',
        }}>
          {/* Radial glow */}
          <View style={{
            position: 'absolute', top: -40, right: -40,
            width: 160, height: 160, borderRadius: 80,
            backgroundColor: 'rgba(79,70,229,0.25)',
          }} />
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: 'rgba(161,161,170,0.7)', textTransform: 'uppercase', marginBottom: 6 }}>
            {weekday}
          </Text>
          <Text style={{ color: '#fff', letterSpacing: -1, lineHeight: 56 }}>
            <Text style={{ fontSize: 52, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
              {formatInTimeZone(now, tz, 'HH:mm')}
            </Text>
            <Text style={{ fontSize: 28, fontWeight: '600', color: 'rgba(255,255,255,0.5)', fontVariant: ['tabular-nums'] }}>
              :{formatInTimeZone(now, tz, 'ss')}
            </Text>
          </Text>
          <Text style={{ fontSize: 12, color: 'rgba(161,161,170,0.6)', marginTop: 4 }}>
            {now.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        </View>

        {/* GPS status */}
        <View style={{
          borderRadius: 14, padding: '12px' as any,
          paddingVertical: 12, paddingHorizontal: 14,
          backgroundColor: theme.surface,
          borderWidth: 1, borderColor: theme.border,
          marginBottom: 12,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            {/* Icon container */}
            <View style={{
              width: 32, height: 32, borderRadius: 8,
              backgroundColor: gpsBg,
              justifyContent: 'center', alignItems: 'center', flexShrink: 0,
            }}>
              <Text style={{ fontSize: 14 }}>📍</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textPrimary }}>{gpsText}</Text>
              {gpsDetail ? <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 1 }}>{gpsDetail}</Text> : null}
            </View>
          </View>
          {/* Dot pulsante */}
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: gpsColor, flexShrink: 0 }} />
        </View>

        {loading && <ActivityIndicator color={theme.primary} style={{ marginVertical: 8 }} />}

        {/* Botões de ponto — coluna, ícone no topo */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          {CLOCK_TYPES.map((ct) => {
            const color      = theme[ct.colorKey as keyof typeof theme] as string;
            const softColor  = theme[`${ct.colorKey}Soft` as keyof typeof theme] as string;
            const seqDisabled = !available[ct.key as keyof Available];
            const disabled    = gpsBlocksButtons || seqDisabled || loading;
            return (
              <TouchableOpacity
                key={ct.key}
                onPress={() => handleClockPress(ct.key)}
                disabled={disabled}
                style={{
                  width: '47%',
                  borderRadius: 14, borderWidth: 1.5,
                  borderColor: disabled ? theme.border : color + '50',
                  backgroundColor: disabled ? theme.elevated : softColor || color + '15',
                  padding: 14,
                  flexDirection: 'column', alignItems: 'flex-start',
                  opacity: seqDisabled && !gpsBlocksButtons ? 0.45 : 1,
                }}
              >
                {/* Ícone placeholder (no RN sem lib de ícones) */}
                <View style={{
                  width: 32, height: 32, borderRadius: 8, marginBottom: 10,
                  backgroundColor: disabled ? theme.border : color + '20',
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  <Text style={{ fontSize: 14, opacity: disabled ? 0.4 : 1 }}>
                    {ct.key === 'entry' ? '▶' : ct.key === 'break_start' ? '⏸' : ct.key === 'break_end' ? '▶' : '⏹'}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: disabled ? theme.textMuted : color, marginBottom: 2 }}>
                  {ct.label}
                </Text>
                <Text style={{ fontSize: 10, color: disabled ? theme.textMuted : theme.textSecondary }}>
                  {disabled && !seqDisabled ? 'Indisponível' : ct.sub}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Registros de hoje */}
        {todayRecords.length > 0 && (
          <View style={{ marginTop: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>
                Hoje
              </Text>
              <View style={{
                paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
                backgroundColor: theme.primarySoft,
              }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.primary }}>
                  {todayRecords.length} registro{todayRecords.length > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
            <View style={{
              backgroundColor: theme.surface, borderRadius: 12,
              borderWidth: 1, borderColor: theme.border, overflow: 'hidden',
            }}>
              {todayRecords.map((r, i) => (
                <View key={r.id} style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  padding: 14,
                  borderBottomWidth: i < todayRecords.length - 1 ? 1 : 0,
                  borderBottomColor: theme.hairline,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: DOT_COLORS[r.clock_type] || theme.textMuted }} />
                    <Text style={{ color: theme.textPrimary, fontWeight: '500', fontSize: 13 }}>
                      {LABELS[r.clock_type as ClockType] ?? r.clock_type}
                    </Text>
                  </View>
                  <Text style={{ color: theme.textSecondary, fontVariant: ['tabular-nums'], fontSize: 13 }}>
                    {formatInTimeZone(new Date(r.clocked_at_utc), r.timezone || 'America/Sao_Paulo', 'HH:mm')}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <TabBar active="dashboard" onNavigate={onNavigate} unreadCount={unreadCount} servicesOnly={servicesOnly} />

      {/* Modal de confirmação */}
      <Modal visible={confirmModal !== null} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(9,9,11,0.75)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: theme.surface,
            borderTopLeftRadius: 20, borderTopRightRadius: 20,
            padding: 24, paddingBottom: 36,
          }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: theme.textPrimary, marginBottom: 2, letterSpacing: -0.5 }}>
              Confirmar {confirmModal ? LABELS[confirmModal] : ''}
            </Text>
            <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 16, fontVariant: ['tabular-nums'] }}>
              {formatInTimeZone(now, tz, 'HH:mm:ss')} · {formatInTimeZone(now, tz, 'dd/MM/yyyy')}
            </Text>

            {photoUris.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {photoUris.map((uri, i) => (
                  <View key={i} style={{ marginRight: 8, position: 'relative' }}>
                    <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                    <TouchableOpacity
                      style={{ position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}
                      onPress={() => setPhotoUris((prev) => prev.filter((_, idx) => idx !== i))}>
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: theme.border, backgroundColor: theme.elevated, alignItems: 'center' }}
                onPress={() => handleOpenCamera('front')} disabled={photoUris.length >= maxPhotos}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textPrimary }}>🤳 Frontal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: theme.border, backgroundColor: theme.elevated, alignItems: 'center' }}
                onPress={() => handleOpenCamera('back')} disabled={photoUris.length >= maxPhotos}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textPrimary }}>📸 Traseira</Text>
              </TouchableOpacity>
            </View>

            {maxPhotos > 1 && (
              <Text style={{ textAlign: 'center', color: theme.textMuted, fontSize: 11, marginBottom: 12 }}>
                {photoUris.length}/{maxPhotos} foto{maxPhotos > 1 ? 's' : ''}
              </Text>
            )}

            <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginBottom: 6 }}>Observação (opcional)</Text>
            <TextInput
              style={{
                borderWidth: 1.5, borderColor: theme.border, borderRadius: 10,
                padding: 12, fontSize: 14, color: theme.textPrimary,
                backgroundColor: theme.elevated, minHeight: 64, textAlignVertical: 'top',
              }}
              placeholder="Digite uma observação..."
              placeholderTextColor={theme.textMuted}
              value={observation} onChangeText={setObservation}
              multiline numberOfLines={2} maxLength={300}
            />
            <Text style={{ fontSize: 11, color: theme.textMuted, textAlign: 'right', marginTop: 4, marginBottom: 16 }}>
              {observation.length}/300
            </Text>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: theme.border, alignItems: 'center' }}
                onPress={() => { setConfirmModal(null); setGpsSnapshot(null); }}>
                <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#09090b', alignItems: 'center' }}
                onPress={submitClock}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>✓ Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <CameraModal
        visible={cameraOpen}
        facing={cameraFacing}
        onCapture={handleCameraCapture}
        onCancel={handleCameraCancel}
      />
    </SafeAreaView>
  );
}
