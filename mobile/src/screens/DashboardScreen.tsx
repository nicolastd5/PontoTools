import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { formatInTimeZone } from 'date-fns-tz';
import { useAuth } from '../contexts/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import api from '../services/api';

const CLOCK_TYPES = [
  { key: 'entry',       label: 'Entrada',          color: '#16a34a', bg: '#f0fdf4' },
  { key: 'break_start', label: 'Início Intervalo', color: '#d97706', bg: '#fffbeb' },
  { key: 'break_end',   label: 'Fim Intervalo',    color: '#0369a1', bg: '#f0f9ff' },
  { key: 'exit',        label: 'Saída',            color: '#dc2626', bg: '#fef2f2' },
] as const;

type ClockType = typeof CLOCK_TYPES[number]['key'];

const LABELS: Record<ClockType, string> = {
  entry:       'Entrada',
  exit:        'Saída',
  break_start: 'Início intervalo',
  break_end:   'Fim intervalo',
};

interface ClockRecord {
  id: number;
  clock_type: string;
  clocked_at_utc: string;
  timezone: string;
  is_inside_zone: boolean;
  distance_meters: number;
}

export default function DashboardScreen() {
  const { user, logout }      = useAuth();
  const { status: gpsStatus, coords, distanceMeters, isInsideZone } = useGeolocation(user?.unit);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device    = useCameraDevice('front');
  const cameraRef = useRef<Camera>(null);

  const [showCamera, setShowCamera]     = useState(false);
  const [clockingFor, setClockingFor]   = useState<ClockType | null>(null);
  const [loading, setLoading]           = useState(false);
  const [todayRecords, setTodayRecords] = useState<ClockRecord[]>([]);

  useEffect(() => {
    api.get('/clock/today')
      .then((r) => setTodayRecords(r.data.records || []))
      .catch(() => {});
  }, []);

  async function handleClockPress(clockType: ClockType) {
    if (gpsStatus !== 'granted') {
      Alert.alert('GPS necessário', 'Habilite a localização para registrar o ponto.');
      return;
    }
    if (!isInsideZone) {
      Alert.alert(
        'Fora da zona',
        `Você está a ${Math.round(distanceMeters ?? 0)}m da unidade. Máximo: ${user?.unit?.radiusMeters}m.`,
      );
      return;
    }

    if (!hasPermission) {
      const ok = await requestPermission();
      if (!ok) {
        Alert.alert('Câmera necessária', 'Permita o acesso à câmera para registrar o ponto.');
        return;
      }
    }

    setClockingFor(clockType);
    setShowCamera(true);
  }

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || !clockingFor || !coords) return;

    setLoading(true);
    setShowCamera(false);

    try {
      const photo = await cameraRef.current.takePhoto({ qualityPrioritization: 'speed' });
      const tz    = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const formData = new FormData();
      formData.append('clock_type', clockingFor);
      formData.append('latitude',   String(coords.latitude));
      formData.append('longitude',  String(coords.longitude));
      formData.append('accuracy',   String(coords.accuracy ?? ''));
      formData.append('timezone',   tz);
      formData.append('photo', {
        uri:  `file://${photo.path}`,
        type: 'image/jpeg',
        name: 'photo.jpg',
      } as any);

      const res = await api.post('/clock', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const newRecord = res.data;
      setTodayRecords((prev) => [
        ...prev,
        {
          id:              newRecord.id,
          clock_type:      newRecord.clockType,
          clocked_at_utc:  newRecord.clockedAtUtc,
          timezone:        tz,
          is_inside_zone:  newRecord.isInsideZone,
          distance_meters: newRecord.distanceMeters,
        },
      ]);

      Alert.alert(
        'Ponto registrado!',
        `${LABELS[clockingFor]} às ${formatInTimeZone(new Date(newRecord.clockedAtUtc), tz, 'HH:mm')}`,
      );
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.blocked && data?.reason === 'outside_zone') {
        Alert.alert('Bloqueado', `Você está a ${Math.round(data.distanceMeters)}m da unidade.`);
      } else {
        Alert.alert('Erro', data?.error || 'Erro ao registrar ponto.');
      }
    } finally {
      setLoading(false);
      setClockingFor(null);
    }
  }, [cameraRef, clockingFor, coords]);

  const gpsOk = gpsStatus === 'granted';

  // Tela da câmera
  if (showCamera && device) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <Camera
          ref={cameraRef}
          style={{ flex: 1 }}
          device={device}
          isActive={true}
          photo={true}
        />
        <View style={styles.cameraControls}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => { setShowCamera(false); setClockingFor(null); }}
          >
            <Text style={{ color: '#fff', fontSize: 16 }}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.captureBtn} onPress={handleCapture} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <View style={styles.captureInner} />
            }
          </TouchableOpacity>
          <View style={{ width: 80 }} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16 }}>
      {/* Cabeçalho */}
      <View style={styles.dateBar}>
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
        <Text style={styles.timeText}>
          {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>

      {/* Status do GPS */}
      <View style={[
        styles.gpsBox,
        { backgroundColor: gpsOk ? (isInsideZone ? '#f0fdf4' : '#fef2f2') : '#fef9c3' },
      ]}>
        <Text style={[
          styles.gpsText,
          { color: gpsOk ? (isInsideZone ? '#16a34a' : '#dc2626') : '#92400e' },
        ]}>
          {gpsStatus === 'loading'     && '⏳ Obtendo localização...'}
          {gpsStatus === 'denied'      && '🔒 GPS negado — habilite nas configurações'}
          {gpsStatus === 'unavailable' && '📡 GPS indisponível'}
          {gpsStatus === 'granted' && isInsideZone  && `✅ Dentro da zona (${Math.round(distanceMeters ?? 0)}m)`}
          {gpsStatus === 'granted' && !isInsideZone && `⛔ Fora da zona — ${Math.round(distanceMeters ?? 0)}m (máx: ${user?.unit?.radiusMeters}m)`}
        </Text>
      </View>

      {/* Botões de ponto */}
      <View style={styles.grid}>
        {CLOCK_TYPES.map((ct) => {
          const disabled = !gpsOk || !isInsideZone || loading;
          return (
            <TouchableOpacity
              key={ct.key}
              onPress={() => handleClockPress(ct.key)}
              disabled={disabled}
              style={[
                styles.clockBtn,
                {
                  backgroundColor: disabled ? '#f1f5f9' : ct.bg,
                  borderColor:     disabled ? '#e2e8f0' : ct.color + '40',
                },
              ]}
            >
              <Text style={[styles.clockLabel, { color: disabled ? '#94a3b8' : ct.color }]}>
                {ct.label}
              </Text>
              {!gpsOk && <Text style={styles.lock}>🔒</Text>}
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
                {formatInTimeZone(
                  new Date(r.clocked_at_utc),
                  r.timezone || 'America/Sao_Paulo',
                  'HH:mm',
                )}
              </Text>
              <View style={[styles.dot, { backgroundColor: r.is_inside_zone ? '#16a34a' : '#dc2626' }]} />
            </View>
          ))}
        </View>
      )}

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sair</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: '#f8fafc' },
  dateBar:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  dateText:       { fontSize: 13, color: '#475569', textTransform: 'capitalize', fontWeight: '500' },
  timeText:       { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  gpsBox:         { borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  gpsText:        { fontSize: 14, fontWeight: '600' },
  grid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  clockBtn:       {
    width: '47%', borderRadius: 14, borderWidth: 2,
    paddingVertical: 24, alignItems: 'center', position: 'relative',
  },
  clockLabel:     { fontSize: 13, fontWeight: 'bold' },
  lock:           { position: 'absolute', top: 6, right: 6, fontSize: 12 },
  todayBox:       {
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', marginBottom: 16,
  },
  todayTitle:     { fontSize: 14, fontWeight: 'bold', color: '#0f172a', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  todayRow:       {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#f8fafc',
  },
  todayType:      { color: '#374151', fontWeight: '500', flex: 1 },
  todayTime:      { color: '#0f172a', fontWeight: 'bold', marginRight: 10 },
  dot:            { width: 8, height: 8, borderRadius: 4 },
  logoutBtn:      { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 32 },
  logoutText:     { color: '#64748b', fontWeight: '600' },
  cameraControls: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.7)',
  },
  cancelBtn:      { width: 80, alignItems: 'flex-start' },
  captureBtn:     {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#fff',
  },
  captureInner:   { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff' },
});
