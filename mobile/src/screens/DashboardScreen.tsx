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

type Screen = 'dashboard' | 'history';

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

// Hook para relógio em tempo real com segundos
function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function DashboardScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const { user, logout }      = useAuth();
  const { status: gpsStatus, coords, distanceMeters, isInsideZone } = useGeolocation(user?.unit);
  const now = useClock();
  const tz  = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [loading, setLoading]           = useState(false);
  const [todayRecords, setTodayRecords] = useState<ClockRecord[]>([]);
  const [available, setAvailable]       = useState<Available>({
    entry: true, break_start: false, break_end: false, exit: false,
  });

  // Modal de confirmação com observação e foto
  const [confirmModal, setConfirmModal]   = useState<ClockType | null>(null);
  const [observation, setObservation]     = useState('');
  const [photoUri, setPhotoUri]           = useState<string | null>(null);
  const [cameraFacing, setCameraFacing]   = useState<'front' | 'back'>('front');
  const [takingPhoto, setTakingPhoto]     = useState(false);

  function loadToday() {
    api.get('/clock/today', { params: { timezone: tz } })
      .then((r) => {
        setTodayRecords(r.data.records || []);
        if (r.data.available) setAvailable(r.data.available);
      })
      .catch(() => {});
  }

  useEffect(() => { loadToday(); }, []);

  const handleClockPress = useCallback((clockType: ClockType) => {
    if (gpsStatus !== 'granted') {
      Alert.alert('GPS necessário', 'Habilite a localização para registrar o ponto.');
      return;
    }
    if (!isInsideZone) {
      Alert.alert('Fora da zona', `Você está a ${Math.round(distanceMeters ?? 0)}m. Máximo: ${user?.unit?.radiusMeters}m.`);
      return;
    }
    if (!coords) return;
    setObservation('');
    setPhotoUri(null);
    setConfirmModal(clockType);
  }, [gpsStatus, isInsideZone, coords, distanceMeters, user]);

  const handleTakePhoto = useCallback(async () => {
    setTakingPhoto(true);
    try {
      const options: CameraOptions = {
        mediaType: 'photo',
        cameraType: cameraFacing,
        quality: 0.7,
        maxWidth: 1024,
        maxHeight: 1024,
        includeBase64: false,
        saveToPhotos: false,
      };
      const result = await launchCamera(options);
      if (result.didCancel || result.errorCode) return;
      const asset = result.assets?.[0];
      if (asset?.uri) setPhotoUri(asset.uri);
    } finally {
      setTakingPhoto(false);
    }
  }, [cameraFacing]);

  async function submitClock() {
    if (!confirmModal || !coords) return;
    const clockType = confirmModal;
    setConfirmModal(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('clock_type', clockType);
      formData.append('latitude',   String(coords.latitude));
      formData.append('longitude',  String(coords.longitude));
      formData.append('accuracy',   String(coords.accuracy ?? ''));
      formData.append('timezone',   tz);
      if (observation.trim()) formData.append('observation', observation.trim());

      if (photoUri) {
        // Foto real da câmera
        formData.append('photo', { uri: photoUri, type: 'image/jpeg', name: 'photo.jpg' } as any);
      } else {
        // Placeholder 1px se não tirou foto
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

      // Atualiza disponibilidade dos botões
      loadToday();

      Alert.alert('Ponto registrado!', `${LABELS[clockType]} às ${formatInTimeZone(new Date(res.data.clockedAtUtc), tz, 'HH:mm:ss')}`);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.blocked) Alert.alert('Bloqueado', `Você está a ${Math.round(data.distanceMeters)}m da unidade.`);
      else Alert.alert('Erro', data?.error || 'Erro ao registrar ponto.');
    } finally {
      setLoading(false);
    }
  }

  const gpsOk = gpsStatus === 'granted';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, styles.tabActive]}>
          <Text style={[styles.tabText, styles.tabTextActive]}>🕐 Ponto</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => onNavigate('history')}>
          <Text style={styles.tabText}>📋 Histórico</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Relógio com segundos */}
        <View style={styles.clockBox}>
          <Text style={styles.clockTime}>
            {formatInTimeZone(now, tz, 'HH:mm:ss')}
          </Text>
          <Text style={styles.clockDate}>
            {formatInTimeZone(now, tz, "EEEE, dd 'de' MMMM 'de' yyyy")}
          </Text>
        </View>

        {/* Status GPS */}
        <View style={[styles.gpsBox, { backgroundColor: gpsOk ? (isInsideZone ? '#f0fdf4' : '#fef2f2') : '#fef9c3' }]}>
          <Text style={[styles.gpsText, { color: gpsOk ? (isInsideZone ? '#16a34a' : '#dc2626') : '#92400e' }]}>
            {gpsStatus === 'loading'     && '⏳ Obtendo localização...'}
            {gpsStatus === 'denied'      && '🔒 GPS negado — habilite nas configurações'}
            {gpsStatus === 'unavailable' && '📡 GPS indisponível'}
            {gpsStatus === 'granted' && isInsideZone  && `✅ Dentro da zona (${Math.round(distanceMeters ?? 0)}m)`}
            {gpsStatus === 'granted' && !isInsideZone && `⛔ Fora da zona — ${Math.round(distanceMeters ?? 0)}m (máx: ${user?.unit?.radiusMeters}m)`}
          </Text>
        </View>

        {loading && <ActivityIndicator color="#1d4ed8" style={{ marginBottom: 16 }} />}

        {/* Botões de ponto */}
        <View style={styles.grid}>
          {CLOCK_TYPES.map((ct) => {
            const gpsDisabled = !gpsOk || !isInsideZone || loading;
            const seqDisabled = !available[ct.key as keyof Available];
            const disabled    = gpsDisabled || seqDisabled;
            return (
              <TouchableOpacity
                key={ct.key}
                onPress={() => handleClockPress(ct.key)}
                disabled={disabled}
                style={[styles.clockBtn, {
                  backgroundColor: disabled ? '#f1f5f9' : ct.bg,
                  borderColor:     disabled ? '#e2e8f0' : ct.color + '40',
                  opacity:         seqDisabled && !gpsDisabled ? 0.45 : 1,
                }]}
              >
                <Text style={[styles.clockLabel, { color: disabled ? '#94a3b8' : ct.color }]}>{ct.label}</Text>
                {!gpsOk && <Text style={styles.lock}>🔒</Text>}
                {gpsOk && seqDisabled && <Text style={styles.lock}>⏸</Text>}
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

      {/* Modal de confirmação com observação */}
      <Modal visible={confirmModal !== null} transparent animationType="slide">
        <View style={modal.overlay}>
          <View style={modal.box}>
            <Text style={modal.title}>Confirmar {confirmModal ? LABELS[confirmModal] : ''}</Text>
            <Text style={modal.subtitle}>
              {formatInTimeZone(now, tz, 'HH:mm:ss')} · {formatInTimeZone(now, tz, 'dd/MM/yyyy')}
            </Text>

            {/* Seção de foto */}
            <View style={modal.photoSection}>
              {photoUri ? (
                <View style={modal.photoPreview}>
                  <Image source={{ uri: photoUri }} style={modal.photoImg} />
                  <View style={modal.photoActions}>
                    <TouchableOpacity
                      style={modal.photoBtn}
                      onPress={() => setCameraFacing(f => f === 'front' ? 'back' : 'front')}
                    >
                      <Text style={modal.photoBtnText}>🔄 {cameraFacing === 'front' ? 'Traseira' : 'Frontal'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={modal.photoBtn} onPress={handleTakePhoto} disabled={takingPhoto}>
                      <Text style={modal.photoBtnText}>📷 Refazer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={modal.photoEmpty}>
                  <Text style={modal.photoEmptyIcon}>📷</Text>
                  <Text style={modal.photoEmptyText}>Nenhuma foto tirada</Text>
                  <View style={modal.photoActions}>
                    <TouchableOpacity
                      style={modal.photoBtn}
                      onPress={() => setCameraFacing(f => f === 'front' ? 'back' : 'front')}
                    >
                      <Text style={modal.photoBtnText}>
                        {cameraFacing === 'front' ? '🤳 Frontal' : '📸 Traseira'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[modal.photoBtn, modal.photoBtnPrimary]}
                      onPress={handleTakePhoto}
                      disabled={takingPhoto}
                    >
                      <Text style={[modal.photoBtnText, { color: '#fff' }]}>
                        {takingPhoto ? 'Abrindo...' : '📷 Tirar Foto'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

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
              <TouchableOpacity style={modal.cancelBtn} onPress={() => setConfirmModal(null)}>
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
  tabBar:        { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tab:           { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive:     { borderBottomWidth: 2, borderBottomColor: '#1d4ed8' },
  tabText:       { fontSize: 14, color: '#94a3b8', fontWeight: '600' },
  tabTextActive: { color: '#1d4ed8' },
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
  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  box:              { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  title:            { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  subtitle:         { fontSize: 13, color: '#64748b', marginBottom: 16, fontVariant: ['tabular-nums'] },
  photoSection:     { marginBottom: 16 },
  photoEmpty:       { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, borderStyle: 'dashed', padding: 16, alignItems: 'center' },
  photoEmptyIcon:   { fontSize: 32, marginBottom: 6 },
  photoEmptyText:   { fontSize: 13, color: '#94a3b8', marginBottom: 12 },
  photoPreview:     { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  photoImg:         { width: '100%', height: 180, resizeMode: 'cover' },
  photoActions:     { flexDirection: 'row', gap: 8, marginTop: 10, justifyContent: 'center' },
  photoBtn:         { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  photoBtnPrimary:  { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  photoBtnText:     { fontSize: 13, fontWeight: '600', color: '#374151' },
  label:            { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input:            { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, color: '#0f172a', minHeight: 64, textAlignVertical: 'top' },
  charCount:        { fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 4, marginBottom: 16 },
  actions:          { flexDirection: 'row', gap: 12 },
  cancelBtn:        { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center' },
  cancelText:       { color: '#64748b', fontWeight: '600' },
  confirmBtn:       { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#1d4ed8', alignItems: 'center' },
  confirmText:      { color: '#fff', fontWeight: '700', fontSize: 15 },
});
