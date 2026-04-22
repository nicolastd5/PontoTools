import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, SafeAreaView,
  TextInput, Modal, Image,
} from 'react-native';
import { formatInTimeZone } from 'date-fns-tz';
import { launchCamera, type CameraOptions } from 'react-native-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useGeolocation } from '../hooks/useGeolocation';
import api from '../services/api';
import TabBar from '../components/TabBar';

type Screen = 'dashboard' | 'history' | 'services' | 'notifications' | 'profile';

const CLOCK_TYPES = [
  { key: 'entry',       label: 'Entrada',          colorKey: 'success' },
  { key: 'break_start', label: 'Início Intervalo',  colorKey: 'warning' },
  { key: 'break_end',   label: 'Fim Intervalo',     colorKey: 'info'    },
  { key: 'exit',        label: 'Saída',             colorKey: 'danger'  },
] as const;

type ClockType = typeof CLOCK_TYPES[number]['key'];

const LABELS: Record<ClockType, string> = {
  entry: 'Entrada', exit: 'Saída',
  break_start: 'Início intervalo', break_end: 'Fim intervalo',
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

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

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

  const [loading, setLoading]           = useState(false);
  const [todayRecords, setTodayRecords] = useState<ClockRecord[]>([]);
  const [available, setAvailable]       = useState<Available>({ entry: true, break_start: false, break_end: false, exit: false });
  const [maxPhotos, setMaxPhotos]           = useState(1);
  const [requireLocation, setRequireLocation] = useState(true);
  const [confirmModal, setConfirmModal] = useState<ClockType | null>(null);
  const [observation, setObservation]   = useState('');
  const [photoUris, setPhotoUris]       = useState<string[]>([]);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('front');
  const [takingPhoto, setTakingPhoto]   = useState(false);
  const [gpsSnapshot, setGpsSnapshot]   = useState<GpsSnapshot | null>(null);

  function loadToday() {
    api.get('/clock/today', { params: { timezone: tz } })
      .then((r) => {
        setTodayRecords(r.data.records || []);
        if (r.data.available)          setAvailable(r.data.available);
        if (r.data.maxPhotos)          setMaxPhotos(r.data.maxPhotos);
        if (r.data.requireLocation !== undefined) setRequireLocation(r.data.requireLocation);
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadToday();
    const id = setInterval(loadToday, 15 * 1000);
    return () => clearInterval(id);
  }, []);

  const handleClockPress = useCallback((clockType: ClockType) => {
    if (requireLocation) {
      if (gpsStatus !== 'granted') { Alert.alert('GPS necessário', 'Habilite a localização para registrar.'); return; }
      if (!isInsideZone)           { Alert.alert('Fora da zona', `Você está a ${Math.round(distanceMeters ?? 0)}m. Máximo: ${user?.unit?.radiusMeters}m.`); return; }
    }
    setObservation(''); setPhotoUris([]); setCameraFacing('front');
    setGpsSnapshot(coords ? { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy } : null);
    setConfirmModal(clockType);
  }, [gpsStatus, isInsideZone, coords, distanceMeters, user, requireLocation]);

  const handleTakePhoto = useCallback(async (facing: 'front' | 'back') => {
    setTakingPhoto(true);
    try {
      const options: CameraOptions = { mediaType: 'photo', cameraType: facing, quality: 0.7, maxWidth: 1024, maxHeight: 1024, includeBase64: false, saveToPhotos: false };
      const result = await launchCamera(options);
      if (result.didCancel || result.errorCode) return;
      const asset = result.assets?.[0];
      if (asset?.uri) setPhotoUris((prev) => [...prev, asset.uri!]);
    } finally { setTakingPhoto(false); }
  }, []);

  const handleSwitchAndShoot = useCallback(async (nextFacing: 'front' | 'back') => {
    setCameraFacing(nextFacing);
    await handleTakePhoto(nextFacing);
  }, [handleTakePhoto]);

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
      const res = await api.post('/clock', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setTodayRecords((prev) => [...prev, { id: res.data.id, clock_type: res.data.clockType, clocked_at_utc: res.data.clockedAtUtc, timezone: tz, is_inside_zone: res.data.isInsideZone }]);
      loadToday();
      Alert.alert('Registro efetuado!', `${LABELS[clockType]} às ${formatInTimeZone(new Date(res.data.clockedAtUtc), tz, 'HH:mm:ss')}`);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.blocked) Alert.alert('Bloqueado', `Você está a ${Math.round(data.distanceMeters)}m da unidade.`);
      else Alert.alert('Erro', data?.error || 'Erro ao registrar.');
    } finally { setLoading(false); setGpsSnapshot(null); }
  }

  const gpsOk           = gpsStatus === 'granted';
  const gpsBlocksButtons = requireLocation && (!gpsOk || !isInsideZone);

  const initials = user?.name
    ? user.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
    : '?';

  const DOT: Record<string, string> = {
    entry: theme.success, break_start: theme.warning, break_end: theme.info, exit: theme.danger,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, backgroundColor: theme.bg }}>
        {/* Saudação */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View>
            <Text style={{ fontSize: 13, color: theme.textSecondary }}>Olá,</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: theme.textPrimary }}>{user?.name}</Text>
          </View>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.accent, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{initials}</Text>
          </View>
        </View>

        {/* Relógio */}
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 2, color: theme.accent, textTransform: 'uppercase', marginBottom: 4 }}>
            {now.toLocaleDateString('pt-BR', { weekday: 'long' }).toUpperCase()}
          </Text>
          <Text style={{ fontSize: 48, fontWeight: '800', color: theme.textPrimary, fontVariant: ['tabular-nums'], letterSpacing: 2, lineHeight: 56 }}>
            {formatInTimeZone(now, tz, 'HH:mm')}
            <Text style={{ fontSize: 26, opacity: 0.5 }}>:{formatInTimeZone(now, tz, 'ss')}</Text>
          </Text>
          <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>
            {now.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
          </Text>
        </View>

        {/* Status GPS */}
        <View style={{ borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: theme.border,
          backgroundColor: !requireLocation ? theme.surface : gpsOk ? (isInsideZone ? theme.success + '18' : theme.danger + '18') : theme.warning + '18' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: !requireLocation ? theme.textMuted : gpsOk ? (isInsideZone ? theme.success : theme.danger) : theme.warning }} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textPrimary, flex: 1 }}>
              {!requireLocation && gpsStatus === 'granted' && `${Math.round(distanceMeters ?? 0)}m da unidade (localização livre)`}
              {!requireLocation && gpsStatus !== 'granted' && 'Localização livre — GPS não exigido'}
              {requireLocation  && gpsStatus === 'loading'     && 'Obtendo localização...'}
              {requireLocation  && gpsStatus === 'denied'      && 'GPS negado — habilite nas configurações'}
              {requireLocation  && gpsStatus === 'unavailable' && 'GPS indisponível'}
              {requireLocation  && gpsStatus === 'granted' && isInsideZone  && `Localização validada · ${Math.round(distanceMeters ?? 0)}m`}
              {requireLocation  && gpsStatus === 'granted' && !isInsideZone && `Fora da zona — ${Math.round(distanceMeters ?? 0)}m (máx: ${user?.unit?.radiusMeters}m)`}
            </Text>
          </View>
        </View>

        {loading && <ActivityIndicator color={theme.accent} style={{ marginBottom: 16 }} />}

        {/* Botões de ponto */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          {CLOCK_TYPES.map((ct) => {
            const color       = theme[ct.colorKey as keyof typeof theme] as string;
            const seqDisabled = !available[ct.key as keyof Available];
            const disabled    = gpsBlocksButtons || seqDisabled || loading;
            return (
              <TouchableOpacity
                key={ct.key}
                onPress={() => handleClockPress(ct.key)}
                disabled={disabled}
                style={{
                  width: '47%', borderRadius: 14, borderWidth: 1.5,
                  borderColor: disabled ? theme.border : color + '55',
                  backgroundColor: disabled ? theme.elevated : color + '18',
                  paddingVertical: 24, alignItems: 'center', position: 'relative',
                  opacity: seqDisabled && !gpsBlocksButtons ? 0.45 : 1,
                }}>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: disabled ? theme.textMuted : color }}>{ct.label}</Text>
                {requireLocation && !gpsOk && <Text style={{ position: 'absolute', top: 6, right: 6, fontSize: 12 }}>🔒</Text>}
                {(!requireLocation || gpsOk) && seqDisabled && <Text style={{ position: 'absolute', top: 6, right: 6, fontSize: 12 }}>⏸</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Registros de hoje */}
        {todayRecords.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Hoje</Text>
              <Text style={{ fontSize: 11, color: theme.accent }}>{todayRecords.length} registro{todayRecords.length > 1 ? 's' : ''}</Text>
            </View>
            <View style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
              {todayRecords.map((r, i) => (
                <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: i < todayRecords.length - 1 ? 1 : 0, borderBottomColor: theme.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: DOT[r.clock_type] || theme.textMuted }} />
                    <Text style={{ color: theme.textPrimary, fontWeight: '500', fontSize: 13 }}>{LABELS[r.clock_type as ClockType] ?? r.clock_type}</Text>
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
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: theme.textPrimary, marginBottom: 4 }}>
              Confirmar {confirmModal ? LABELS[confirmModal] : ''}
            </Text>
            <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 16, fontVariant: ['tabular-nums'] }}>
              {formatInTimeZone(now, tz, 'HH:mm:ss')} · {formatInTimeZone(now, tz, 'dd/MM/yyyy')}
            </Text>

            {photoUris.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {photoUris.map((uri, i) => (
                  <View key={i} style={{ marginRight: 8, position: 'relative' }}>
                    <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                    <TouchableOpacity
                      style={{ position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}
                      onPress={() => setPhotoUris((prev) => prev.filter((_, idx) => idx !== i))}>
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: cameraFacing === 'front' ? theme.accent : theme.border, backgroundColor: cameraFacing === 'front' ? theme.accent + '18' : theme.elevated, alignItems: 'center' }}
                onPress={() => handleSwitchAndShoot('front')} disabled={takingPhoto || photoUris.length >= maxPhotos}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textPrimary }}>🤳 Frontal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: cameraFacing === 'back' ? theme.accent : theme.border, backgroundColor: cameraFacing === 'back' ? theme.accent + '18' : theme.elevated, alignItems: 'center' }}
                onPress={() => handleSwitchAndShoot('back')} disabled={takingPhoto || photoUris.length >= maxPhotos}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textPrimary }}>📸 Traseira</Text>
              </TouchableOpacity>
            </View>

            {maxPhotos > 1 && (
              <Text style={{ textAlign: 'center', color: theme.textMuted, fontSize: 11, marginBottom: 12 }}>
                {photoUris.length}/{maxPhotos} foto{maxPhotos > 1 ? 's' : ''}
              </Text>
            )}

            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 6 }}>Observação (opcional)</Text>
            <TextInput
              style={{ borderWidth: 1.5, borderColor: theme.border, borderRadius: 10, padding: 12, fontSize: 14, color: theme.textPrimary, backgroundColor: theme.elevated, minHeight: 64, textAlignVertical: 'top' }}
              placeholder="Digite uma observação..." placeholderTextColor={theme.textMuted}
              value={observation} onChangeText={setObservation} multiline numberOfLines={2} maxLength={300}
            />
            <Text style={{ fontSize: 11, color: theme.textMuted, textAlign: 'right', marginTop: 4, marginBottom: 16 }}>{observation.length}/300</Text>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: theme.border, alignItems: 'center' }}
                onPress={() => { setConfirmModal(null); setGpsSnapshot(null); }}>
                <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 10, backgroundColor: theme.accent, alignItems: 'center' }}
                onPress={submitClock}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
