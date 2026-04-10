import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, SafeAreaView,
} from 'react-native';
import { formatInTimeZone } from 'date-fns-tz';
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

export default function DashboardScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const { user, logout }      = useAuth();
  const { status: gpsStatus, coords, distanceMeters, isInsideZone } = useGeolocation(user?.unit);

  const [loading, setLoading]           = useState(false);
  const [todayRecords, setTodayRecords] = useState<ClockRecord[]>([]);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    api.get('/clock/today', { params: { timezone: tz } })
      .then((r) => setTodayRecords(r.data.records || []))
      .catch(() => {});
  }, []);

  const handleClockPress = useCallback(async (clockType: ClockType) => {
    if (gpsStatus !== 'granted') {
      Alert.alert('GPS necessário', 'Habilite a localização para registrar o ponto.');
      return;
    }
    if (!isInsideZone) {
      Alert.alert('Fora da zona', `Você está a ${Math.round(distanceMeters ?? 0)}m. Máximo: ${user?.unit?.radiusMeters}m.`);
      return;
    }
    if (!coords) return;

    Alert.alert(
      'Confirmar ponto',
      `Registrar ${LABELS[clockType]}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setLoading(true);
            try {
              const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

              const formData = new FormData();
              formData.append('clock_type', clockType);
              formData.append('latitude',   String(coords.latitude));
              formData.append('longitude',  String(coords.longitude));
              formData.append('accuracy',   String(coords.accuracy ?? ''));
              formData.append('timezone',   tz);

              // Placeholder de foto (1px JPEG) — será substituído por câmera futuramente
              // React Native FormData aceita {uri, type, name} com file:// ou content://
              // Para placeholder, usamos fetch() para converter data URI em blob
              const dataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=';
              const photoBlob = await (await fetch(dataUri)).blob();
              formData.append('photo', photoBlob, 'photo.jpg');

              const res = await api.post('/clock', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
              });

              setTodayRecords((prev) => [...prev, {
                id: res.data.id,
                clock_type: res.data.clockType,
                clocked_at_utc: res.data.clockedAtUtc,
                timezone: tz,
                is_inside_zone: res.data.isInsideZone,
              }]);

              Alert.alert('Ponto registrado!', `${LABELS[clockType]} às ${formatInTimeZone(new Date(res.data.clockedAtUtc), tz, 'HH:mm')}`);
            } catch (err: any) {
              const data = err?.response?.data;
              if (data?.blocked) Alert.alert('Bloqueado', `Você está a ${Math.round(data.distanceMeters)}m da unidade.`);
              else Alert.alert('Erro', data?.error || 'Erro ao registrar ponto.');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  }, [gpsStatus, isInsideZone, coords, distanceMeters, user]);

  const gpsOk = gpsStatus === 'granted';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, styles.tabActive]}>
          <Text style={[styles.tabText, styles.tabTextActive]}>🕐 Ponto</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => onNavigate('history')}>
          <Text style={styles.tabText}>📋 Histórico</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
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

        <View style={styles.grid}>
          {CLOCK_TYPES.map((ct) => {
            const disabled = !gpsOk || !isInsideZone || loading;
            return (
              <TouchableOpacity
                key={ct.key}
                onPress={() => handleClockPress(ct.key)}
                disabled={disabled}
                style={[styles.clockBtn, {
                  backgroundColor: disabled ? '#f1f5f9' : ct.bg,
                  borderColor:     disabled ? '#e2e8f0' : ct.color + '40',
                }]}
              >
                <Text style={[styles.clockLabel, { color: disabled ? '#94a3b8' : ct.color }]}>{ct.label}</Text>
                {!gpsOk && <Text style={styles.lock}>🔒</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {todayRecords.length > 0 && (
          <View style={styles.todayBox}>
            <Text style={styles.todayTitle}>Registros de Hoje</Text>
            {todayRecords.map((r) => (
              <View key={r.id} style={styles.todayRow}>
                <Text style={styles.todayType}>{LABELS[r.clock_type as ClockType] ?? r.clock_type}</Text>
                <Text style={styles.todayTime}>
                  {formatInTimeZone(new Date(r.clocked_at_utc), r.timezone || 'America/Sao_Paulo', 'HH:mm')}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tabBar:        { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tab:           { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive:     { borderBottomWidth: 2, borderBottomColor: '#1d4ed8' },
  tabText:       { fontSize: 14, color: '#94a3b8', fontWeight: '600' },
  tabTextActive: { color: '#1d4ed8' },
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
  todayTime:     { color: '#0f172a', fontWeight: 'bold', marginRight: 10 },
  dot:           { width: 8, height: 8, borderRadius: 4 },
  logoutBtn:     { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 32 },
  logoutText:    { color: '#64748b', fontWeight: '600' },
});
