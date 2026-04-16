import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, SafeAreaView,
  TextInput, Modal, Image,
} from 'react-native';
import { formatInTimeZone } from 'date-fns-tz';
import { launchCamera, type CameraOptions } from 'react-native-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import api from '../services/api';
import TabBar from '../components/TabBar';

type Screen = 'dashboard' | 'history' | 'services' | 'notifications';

const CLOCK_TYPES = [
  { key: 'entry',       label: 'Entrada',          color: '#16a34a', bg: '#f0fdf4' },
  { key: 'break_start', label: 'Início Intervalo', color: '#d97706', bg: '#fffbeb' },
  { key: 'break_end',   label: 'Fim Intervalo',    color: '#0369a1', bg: '#f0f9ff' },
  { key: 'exit',        label: 'Saída',            color: '#dc2626', bg: '#fef2f2' },
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
  entry: boolean;
  break_start: boolean;
  break_end: boolean;
  exit: boolean;
}

interface GpsSnapshot {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function DashboardScreen({
  onNavigate,
  unreadCount = 0,
}: {
  onNavigate: (s: Screen) => void;
  unreadCount?: number;
}) {
  const { user, logout }      = useAuth();
  const { status: gpsStatus, coords, distanceMeters, isInsideZone } = useGeolocation(user?.unit);
  const now = useClock();
  const tz  = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [loading, setLoading]           = useState(false);
  const [todayRecords, setTodayRecords] = useState<ClockRecord[]>([]);
  const [available, setAvailable]       = useState<Available>({
    entry: true, break_start: false, break_end: false, exit: false,
  });
  const [maxPhotos, setMaxPhotos]           = useState(1);
  const [requireLocation, setRequireLocation] = useState(true);

  // Modal de confirmação
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
        if (r.data.available) setAvailable(r.data.available);
        if (r.data.maxPhotos) setMaxPhotos(r.data.maxPhotos);
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
      if (gpsStatus !== 'granted') {
        Alert.alert('GPS necessário', 'Habilite a localização para registrar o ponto.');
        return;
      }
      if (!isInsideZone) {
        Alert.alert('Fora da zona', `Você está a ${Math.round(distanceMeters ?? 0)}m. Máximo: ${user?.unit?.radiusMeters}m.`);
        return;
      }
    }
    if (!coords && requireLocation) return;
    setObservation('');
    setPhotoUris([]);
    setCameraFacing('front');
    setGpsSnapshot(coords ? { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy } : null);
    setConfirmModal(clockType);
  }, [gpsStatus, isInsideZone, coords, distanceMeters, user]);

  // Abre câmera com a facing escolhida e adiciona a foto à lista
  const handleTakePhoto = useCallback(async (facing: 'front' | 'back') => {
    setTakingPhoto(true);
    try {
      const options: CameraOptions = {
        mediaType: 'photo',
        cameraType: facing,
        quality: 0.7,
        maxWidth: 1024,
        maxHeight: 1024,
        includeBase64: false,
        saveToPhotos: false,
      };
      const result = await launchCamera(options);
      if (result.didCancel || result.errorCode) return;
      const asset = result.assets?.[0];
      if (asset?.uri) {
        setPhotoUris((prev) => [...prev, asset.uri!]);
      }
    } finally {
      setTakingPhoto(false);
    }
  }, []);

  const handleSwitchAndShoot = useCallback(async (nextFacing: 'front' | 'back') => {
    setCameraFacing(nextFacing);
    await handleTakePhoto(nextFacing);
  }, [handleTakePhoto]);

  async function submitClock() {
    if (!confirmModal) return;
    const clockType = confirmModal;
    const coordsToSend = gpsSnapshot || coords;
    setConfirmModal(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('clock_type', clockType);
      formData.append('timezone',   tz);
      // Envia coordenadas se disponíveis; senão usa 0,0 (backend trata hasValidCoords)
      formData.append('latitude',   coordsToSend ? String(coordsToSend.latitude)  : '0');
      formData.append('longitude',  coordsToSend ? String(coordsToSend.longitude) : '0');
      formData.append('accuracy',   coordsToSend ? String(coordsToSend.accuracy ?? '') : '');
      if (observation.trim()) formData.append('observation', observation.trim());

      if (photoUris.length > 0) {
        photoUris.forEach((uri, i) => {
          formData.append('photo', { uri, type: 'image/jpeg', name: `photo_${i}.jpg` } as any);
        });
      } else {
        // Placeholder 1px
        const dataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=';
        const photoBlob = await (await fetch(dataUri)).blob();
        formData.append('photo', photoBlob, 'photo.jpg');
      }

      const res = await api.post('/clock', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const newRecord: ClockRecord = {
        id: res.data.id,
        clock_type: res.data.clockType,
        clocked_at_utc: res.data.clockedAtUtc,
        timezone: tz,
        is_inside_zone: res.data.isInsideZone,
      };
      setTodayRecords((prev) => [...prev, newRecord]);
      loadToday();

      Alert.alert('Ponto registrado!', `${LABELS[clockType]} às ${formatInTimeZone(new Date(res.data.clockedAtUtc), tz, 'HH:mm:ss')}`);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.blocked) Alert.alert('Bloqueado', `Você está a ${Math.round(data.distanceMeters)}m da unidade.`);
      else Alert.alert('Erro', data?.error || 'Erro ao registrar ponto.');
    } finally {
      setLoading(false);
      setGpsSnapshot(null);
    }
  }

  const gpsOk = gpsStatus === 'granted';
  // Botões bloqueados por GPS apenas se o cargo exige localização
  const gpsBlocksButtons = requireLocation && (!gpsOk || !isInsideZone);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <TabBar active="dashboard" onNavigate={onNavigate} unreadCount={unreadCount} />

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Relógio com segundos */}
        <View style={styles.clockBox}>
          <Text style={styles.clockTime}>
            {formatInTimeZone(now, tz, 'HH:mm:ss')}
          </Text>
          <Text style={styles.clockDate}>
            {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        </View>

        {/* Status GPS */}
        <View style={[styles.gpsBox, {
          backgroundColor: !requireLocation
            ? '#f8fafc'
            : gpsOk ? (isInsideZone ? '#f0fdf4' : '#fef2f2') : '#fef9c3',
        }]}>
          <Text style={[styles.gpsText, {
            color: !requireLocation
              ? '#64748b'
              : gpsOk ? (isInsideZone ? '#16a34a' : '#dc2626') : '#92400e',
          }]}>
            {!requireLocation && gpsStatus === 'granted' && `📍 ${Math.round(distanceMeters ?? 0)}m da unidade (localização livre)`}
            {!requireLocation && gpsStatus !== 'granted' && '📍 Localização livre — GPS não exigido'}
            {requireLocation && gpsStatus === 'loading'     && '⏳ Obtendo localização...'}
            {requireLocation && gpsStatus === 'denied'      && '🔒 GPS negado — habilite nas configurações'}
            {requireLocation && gpsStatus === 'unavailable' && '📡 GPS indisponível'}
            {requireLocation && gpsStatus === 'granted' && isInsideZone  && `✅ Dentro da zona (${Math.round(distanceMeters ?? 0)}m)`}
            {requireLocation && gpsStatus === 'granted' && !isInsideZone && `⛔ Fora da zona — ${Math.round(distanceMeters ?? 0)}m (máx: ${user?.unit?.radiusMeters}m)`}
          </Text>
        </View>

        {loading && <ActivityIndicator color="#1d4ed8" style={{ marginBottom: 16 }} />}

        {/* Botões de ponto */}
        <View style={styles.grid}>
          {CLOCK_TYPES.map((ct) => {
            const seqDisabled = !available[ct.key as keyof Available];
            const disabled    = gpsBlocksButtons || seqDisabled || loading;
            return (
              <TouchableOpacity
                key={ct.key}
                onPress={() => handleClockPress(ct.key)}
                disabled={disabled}
                style={[styles.clockBtn, {
                  backgroundColor: disabled ? '#f1f5f9' : ct.bg,
                  borderColor:     disabled ? '#e2e8f0' : ct.color + '40',
                  opacity:         seqDisabled && !gpsBlocksButtons ? 0.45 : 1,
                }]}
              >
                <Text style={[styles.clockLabel, { color: disabled ? '#94a3b8' : ct.color }]}>{ct.label}</Text>
                {requireLocation && !gpsOk && <Text style={styles.lock}>🔒</Text>}
                {(!requireLocation || gpsOk) && seqDisabled && <Text style={styles.lock}>⏸</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Registros de hoje */}
        {todayRecords.length > 0 && (
          <View style={styles.todayBox}>
            <Text style={styles.todayTitle}>Registros de Hoje</Text>
            {todayRecords.map((r) => (
              <View key={r.id} style={styles.todayRow}>
                <Text style={styles.todayType}>{LABELS[r.clock_type as ClockType] ?? r.clock_type}</Text>
                <Text style={styles.todayTime}>
                  {formatInTimeZone(new Date(r.clocked_at_utc), r.timezone || 'America/Sao_Paulo', 'HH:mm:ss')}
                </Text>
                <View style={[styles.dot, { backgroundColor: r.is_inside_zone ? '#16a34a' : '#dc2626' }]} />
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal de confirmação */}
      <Modal visible={confirmModal !== null} transparent animationType="slide">
        <View style={modal.overlay}>
          <View style={modal.box}>
            <Text style={modal.title}>Confirmar {confirmModal ? LABELS[confirmModal] : ''}</Text>
            <Text style={modal.subtitle}>
              {formatInTimeZone(now, tz, 'HH:mm:ss')} · {formatInTimeZone(now, tz, 'dd/MM/yyyy')}
            </Text>

            {/* Fotos tiradas */}
            {photoUris.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {photoUris.map((uri, i) => (
                  <View key={i} style={{ marginRight: 8, position: 'relative' }}>
                    <Image source={{ uri }} style={modal.photoThumb} />
                    <TouchableOpacity
                      style={modal.photoRemove}
                      onPress={() => setPhotoUris((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Botões de câmera */}
            <View style={modal.cameraRow}>
              {/* Trocar câmera + Tirar foto (frente/trás em um só toque) */}
              <TouchableOpacity
                style={[modal.camBtn, cameraFacing === 'front' && modal.camBtnActive]}
                onPress={() => handleSwitchAndShoot('front')}
                disabled={takingPhoto || photoUris.length >= maxPhotos}
              >
                <Text style={modal.camBtnText}>🤳 Frontal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modal.camBtn, cameraFacing === 'back' && modal.camBtnActive]}
                onPress={() => handleSwitchAndShoot('back')}
                disabled={takingPhoto || photoUris.length >= maxPhotos}
              >
                <Text style={modal.camBtnText}>📸 Traseira</Text>
              </TouchableOpacity>
            </View>

            {maxPhotos > 1 && (
              <Text style={modal.photoCount}>
                {photoUris.length}/{maxPhotos} foto{maxPhotos > 1 ? 's' : ''}
                {photoUris.length >= maxPhotos ? ' (máximo atingido)' : ' — toque para adicionar'}
              </Text>
            )}

            {takingPhoto && (
              <Text style={{ textAlign: 'center', color: '#64748b', fontSize: 13, marginBottom: 8 }}>
                Abrindo câmera...
              </Text>
            )}

            <Text style={modal.label}>Observação (opcional)</Text>
            <TextInput
              style={modal.input}
              placeholder="Digite uma observação..."
              placeholderTextColor="#94a3b8"
              value={observation}
              onChangeText={setObservation}
              multiline
              numberOfLines={2}
              maxLength={300}
            />
            <Text style={modal.charCount}>{observation.length}/300</Text>

            <View style={modal.actions}>
              <TouchableOpacity style={modal.cancelBtn} onPress={() => { setConfirmModal(null); setGpsSnapshot(null); }}>
                <Text style={modal.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={modal.confirmBtn} onPress={submitClock}>
                <Text style={modal.confirmText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  clockBox:      { backgroundColor: '#fff', borderRadius: 14, padding: 20, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  clockTime:     { fontSize: 44, fontWeight: '800', color: '#0f172a', letterSpacing: 2, fontVariant: ['tabular-nums'] },
  clockDate:     { fontSize: 13, color: '#64748b', marginTop: 4, textTransform: 'capitalize' },
  gpsBox:        { borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  gpsText:       { fontSize: 14, fontWeight: '600' },
  grid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  clockBtn:      { width: '47%', borderRadius: 14, borderWidth: 2, paddingVertical: 24, alignItems: 'center', position: 'relative' },
  clockLabel:    { fontSize: 13, fontWeight: 'bold' },
  lock:          { position: 'absolute', top: 6, right: 6, fontSize: 12 },
  todayBox:      { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', marginBottom: 16 },
  todayTitle:    { fontSize: 14, fontWeight: 'bold', color: '#0f172a', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  todayRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  todayType:     { color: '#374151', fontWeight: '500', flex: 1 },
  todayTime:     { color: '#0f172a', fontWeight: 'bold', marginRight: 10, fontVariant: ['tabular-nums'] },
  dot:           { width: 8, height: 8, borderRadius: 4 },
  logoutBtn:     { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 32 },
  logoutText:    { color: '#64748b', fontWeight: '600' },
});

const modal = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  box:           { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  title:         { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  subtitle:      { fontSize: 13, color: '#64748b', marginBottom: 16, fontVariant: ['tabular-nums'] },
  photoThumb:    { width: 80, height: 80, borderRadius: 8, resizeMode: 'cover' },
  photoRemove:   { position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  cameraRow:     { flexDirection: 'row', gap: 10, marginBottom: 8 },
  camBtn:        { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', alignItems: 'center' },
  camBtnActive:  { borderColor: '#1d4ed8', backgroundColor: '#eff6ff' },
  camBtnText:    { fontSize: 14, fontWeight: '600', color: '#374151' },
  photoCount:    { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginBottom: 12 },
  label:         { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input:         { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, color: '#0f172a', minHeight: 64, textAlignVertical: 'top' },
  charCount:     { fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 4, marginBottom: 16 },
  actions:       { flexDirection: 'row', gap: 12 },
  cancelBtn:     { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center' },
  cancelText:    { color: '#64748b', fontWeight: '600' },
  confirmBtn:    { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#1d4ed8', alignItems: 'center' },
  confirmText:   { color: '#fff', fontWeight: '700', fontSize: 15 },
});
