// mobile/src/screens/ServicesScreen.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Modal, ScrollView, Alert, ActivityIndicator,
  RefreshControl, TextInput, Image,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import api from '../services/api';
import TabBar from '../components/TabBar';
import CameraModal from '../components/CameraModal';
import { useTheme } from '../contexts/ThemeContext';
import { useServiceLocationTracking } from '../contexts/ServiceLocationTrackingContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import type { Theme } from '../theme';

type Screen = 'dashboard' | 'history' | 'services' | 'notifications' | 'profile';

interface ServicePhoto {
  id: number;
  phase: 'before' | 'after';
  service_order_id?: number;
}

interface ServiceOrder {
  id: number;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'done' | 'done_with_issues' | 'problem';
  scheduled_date: string;
  due_time: string | null;
  unit_name: string;
  employee_posto: string | null;
  problem_description: string | null;
  issue_description: string | null;
  started_at: string | null;
  finished_at: string | null;
  photos?: ServicePhoto[];
}

const STATUS_LABEL: Record<string, string> = {
  pending:          'Pendente',
  in_progress:      'Em andamento',
  done:             'Concluído',
  done_with_issues: 'Concluído c/ ressalvas',
  problem:          'Problema',
};

function statusColor(status: string, theme: Theme): string {
  switch (status) {
    case 'pending':          return theme.textSecondary;
    case 'in_progress':      return theme.warning;
    case 'done':             return theme.success;
    case 'done_with_issues': return '#ea580c';
    case 'problem':          return theme.danger;
    default:                 return theme.textMuted;
  }
}

function statusBg(status: string, theme: Theme): string {
  switch (status) {
    case 'pending':          return theme.elevated;
    case 'in_progress':      return theme.warning + '20';
    case 'done':             return theme.success + '20';
    case 'done_with_issues': return '#ea580c20';
    case 'problem':          return theme.danger + '20';
    default:                 return theme.elevated;
  }
}

function fmtDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function getGps(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      ()    => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
  });
}

export default function ServicesScreen({
  onNavigate,
  unreadCount = 0,
  servicesOnly = false,
}: {
  onNavigate: (s: Screen) => void;
  unreadCount?: number;
  servicesOnly?: boolean;
}) {
  const { theme } = useTheme();
  const { status: gpsStatus, coords } = useGeolocation(null);
  const [services, setServices]     = useState<ServiceOrder[]>([]);
  const address = useReverseGeocode(coords);
  const tracking = useServiceLocationTracking();
  const syncTrackingServices = tracking.syncServices;

  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab]               = useState<'active' | 'history'>('active');
  const [detail, setDetail]         = useState<ServiceOrder | null>(null);
  const [posto, setPosto]           = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [sessionPhase, setSessionPhase]   = useState<'before' | 'after' | 'issues' | null>(null);
  const [sessionUris, setSessionUris]     = useState<string[]>([]);
  const [photoConfirm, setPhotoConfirm]   = useState(false);
  const [cameraPhase, setCameraPhase]     = useState<'before' | 'after' | 'issues' | null>(null);

  const [photoUrls, setPhotoUrls]         = useState<Record<number, string>>({});
  const [lightbox, setLightbox]           = useState<string | null>(null);

  const [problemModal, setProblemModal] = useState(false);
  const [problemText, setProblemText]   = useState('');
  const [issuesModal, setIssuesModal]   = useState(false);
  const [issuesText, setIssuesText]     = useState('');
  const [now, setNow]                   = useState(() => Date.now());
  const timerRef                        = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef                      = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  useEffect(() => {
    if (detail?.status === 'in_progress' && detail.started_at) {
      const unlock = new Date(detail.started_at).getTime() + 5 * 60 * 1000;
      if (Date.now() < unlock) {
        timerRef.current = setInterval(() => {
          const remaining = unlock - Date.now();
          if (remaining <= 0) {
            clearInterval(timerRef.current!);
            timerRef.current = null;
          }
          setNow(Date.now());
        }, 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
      }
    }
  }, [detail?.id, detail?.status, detail?.started_at]);

  const loadServices = useCallback(async (reset = false) => {
    if (!reset) setLoading(true);
    try {
      const { data } = await api.get('/services');
      if (!mountedRef.current) return;
      const nextServices = data.services || [];
      setServices(nextServices);
      syncTrackingServices(nextServices);
    } catch {}
    finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [syncTrackingServices]);

  useEffect(() => { loadServices(false); }, [loadServices]);

  const openDetail = useCallback(async (service: ServiceOrder) => {
    setSessionPhase(null);
    setSessionUris([]);
    setPhotoConfirm(false);
    setPhotoUrls({});
    setProblemText('');
    setIssuesText('');
    setProblemModal(false);
    setIssuesModal(false);
    try {
      const { data } = await api.get(`/services/${service.id}`);
      if (!mountedRef.current) return;
      setDetail(data);
      setPosto(data.employee_posto || '');
    } catch {
      if (!mountedRef.current) return;
      setDetail(service);
      setPosto(service.employee_posto || '');
    }
  }, []);

  const reloadDetail = useCallback(async (id: number) => {
    try {
      const { data } = await api.get(`/services/${id}`);
      if (!mountedRef.current) return;
      setDetail(data);
      setPosto(data.employee_posto || '');
      setPhotoUrls({});
    } catch {}
  }, []);

  const openCamera = useCallback((phase: 'before' | 'after' | 'issues') => {
    setPhotoConfirm(false);
    setCameraPhase(phase);
  }, []);

  const handleCameraCapture = useCallback((uri: string) => {
    const phase = cameraPhase!;
    setCameraPhase(null);
    setSessionPhase((prev) => prev ?? phase);
    setSessionUris((prev) => [...prev, uri]);
    setPhotoConfirm(true);
  }, [cameraPhase]);

  const handleCameraCancel = useCallback(() => {
    setCameraPhase(null);
    if (sessionUris.length > 0) setPhotoConfirm(true);
  }, [sessionUris]);

  const addMorePhoto = useCallback(() => {
    setPhotoConfirm(false);
    if (!sessionPhase) return;
    setCameraPhase(sessionPhase);
  }, [sessionPhase]);

  const submitPhotos = useCallback(async () => {
    if (!detail || !sessionPhase) return;
    if (sessionPhase === 'before' && !posto.trim()) {
      Alert.alert('Campo obrigatório', 'Preencha o campo Posto para iniciar o serviço.');
      return;
    }
    setPhotoConfirm(false);
    setSubmitting(true);
    try {
      const phase = sessionPhase === 'issues' ? 'after' : sessionPhase;
      const gps = await getGps();

      for (const uri of sessionUris) {
        const form = new FormData();
        form.append('photo', { uri, type: 'image/jpeg', name: 'photo.jpg' } as any);
        form.append('phase', phase);
        if (gps) {
          form.append('latitude',  String(gps.latitude));
          form.append('longitude', String(gps.longitude));
        }
        if (phase === 'before' && posto.trim()) {
          form.append('employee_posto', posto.trim());
        }
        await api.post(`/services/${detail.id}/photos`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000,
        });
      }

      if (sessionPhase === 'issues') {
        await api.patch(`/services/${detail.id}/status`, {
          status: 'done_with_issues',
          issue_description: issuesText,
        });
        if (!mountedRef.current) return;
        setIssuesText('');
      }

      if (!mountedRef.current) return;
      setSessionPhase(null);
      setSessionUris([]);
      loadServices(false);
      await reloadDetail(detail.id);
    } catch (err: any) {
      if (!mountedRef.current) return;
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.error ||
        (status === 413 ? 'Foto grande demais para envio.' :
         status === 401 ? 'Sessão expirada, faça login novamente.' :
         err?.code === 'ECONNABORTED' ? 'Tempo esgotado — verifique sua conexão.' :
         err?.message || 'Não foi possível enviar.');
      Alert.alert('Erro', msg);
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }, [detail, sessionPhase, sessionUris, posto, issuesText, loadServices, reloadDetail]);

  const handleUpdateStatus = useCallback(async (
    status: 'in_progress' | 'done' | 'done_with_issues' | 'problem',
    extra?: { problem_description?: string; issue_description?: string },
  ) => {
    if (!detail) return;
    setSubmitting(true);
    try {
      await api.patch(`/services/${detail.id}/status`, { status, ...extra });
      if (!mountedRef.current) return;
      setProblemModal(false);
      setProblemText('');
      setIssuesModal(false);
      setIssuesText('');
      loadServices(false);
      await reloadDetail(detail.id);
    } catch (err: any) {
      if (!mountedRef.current) return;
      Alert.alert('Erro', err?.response?.data?.error || 'Não foi possível atualizar.');
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }, [detail, loadServices, reloadDetail]);

  const allPhotos    = detail?.photos ?? [];
  const beforePhotos = allPhotos.filter((p) => p.phase === 'before');
  const afterPhotos  = allPhotos.filter((p) => p.phase === 'after');

  useEffect(() => {
    if (!detail?.photos?.length) return;

    const apiBaseUrl = (api.defaults.baseURL ?? '').replace('/api', '');
    setPhotoUrls((prev) => {
      let changed = false;
      const next = { ...prev };

      detail.photos?.forEach((photo) => {
        if (next[photo.id]) return;
        next[photo.id] = `${apiBaseUrl}/api/services/${detail.id}/photos/${photo.id}`;
        changed = true;
      });

      return changed ? next : prev;
    });
  }, [detail?.id, detail?.photos]);

  const isActive   = detail && (detail.status === 'pending' || detail.status === 'in_progress');
  const canIssues  = detail?.status === 'in_progress';
  const canProblem = detail && (detail.status === 'in_progress' || detail.status === 'pending');

  const secsLeft = (() => {
    if (!detail?.started_at || detail.status !== 'in_progress') return 0;
    const unlock = new Date(detail.started_at).getTime() + 5 * 60 * 1000;
    return Math.max(0, Math.ceil((unlock - now) / 1000));
  })();
  const timerLabel = `${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, '0')}`;

  const phaseLabel = sessionPhase === 'before' ? 'Foto de Início'
    : sessionPhase === 'after' ? 'Foto de Conclusão'
    : 'Foto de Ressalvas';

  const gpsColor = gpsStatus === 'granted' ? theme.success
    : gpsStatus === 'loading'              ? theme.warning
    : theme.danger;

  const gpsText = gpsStatus === 'loading'     ? 'Obtendo localização GPS...'
    : gpsStatus === 'denied'                  ? 'GPS negado — habilite nas configurações'
    : gpsStatus === 'unavailable'             ? 'GPS indisponível'
    : coords
      ? `GPS ativo${coords.accuracy != null ? ` — prec. ${Math.round(coords.accuracy)}m` : ''}`
      : 'GPS ativo';

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Painel GPS */}
      <View style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 4, borderRadius: 12, padding: 12, borderWidth: 1, backgroundColor: gpsColor + '18', borderColor: gpsColor + '40' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: gpsColor }} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textPrimary, flex: 1 }}>{gpsText}</Text>
        </View>
        {address ? (
          <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4, marginLeft: 16 }} numberOfLines={2}>
            📍 {address}
          </Text>
        ) : null}
      </View>
      {tracking.active && tracking.service ? (
        <View style={{ marginHorizontal: 16, marginBottom: 4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, backgroundColor: theme.success + '15', borderColor: theme.success + '40' }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: theme.success }}>
            Localizacao em tempo real ativa para o servico #{tracking.service.id}.
          </Text>
          {tracking.lastSentAt ? (
            <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
              Ultimo envio: {new Date(tracking.lastSentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Text>
          ) : null}
        </View>
      ) : tracking.error && tracking.service ? (
        <View style={{ marginHorizontal: 16, marginBottom: 4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, backgroundColor: theme.warning + '15', borderColor: theme.warning + '40' }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: theme.warning }}>
            Rastreamento pausado: {tracking.error}
          </Text>
        </View>
      ) : null}

      {/* Tabs Ativos × Histórico */}
      <View style={{ flexDirection: 'row', marginHorizontal: 16, marginTop: 8, marginBottom: 4, backgroundColor: theme.elevated, borderRadius: 10, padding: 4, borderWidth: 1, borderColor: theme.border }}>
        {([
          { key: 'active',  label: 'Ativos'    },
          { key: 'history', label: 'Histórico' },
        ] as const).map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, backgroundColor: tab === t.key ? theme.accent : 'transparent' }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: tab === t.key ? '#fff' : theme.textSecondary }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={(() => {
          const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
          const closedStatus = ['done', 'done_with_issues', 'problem'];
          if (tab === 'active') {
            return services.filter((s) => !closedStatus.includes(s.status));
          }
          return services
            .filter((s) => closedStatus.includes(s.status) && s.finished_at && new Date(s.finished_at).getTime() >= cutoff)
            .sort((a, b) => new Date(b.finished_at!).getTime() - new Date(a.finished_at!).getTime());
        })()}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadServices(true); }}
            colors={[theme.accent]}
          />
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => openDetail(item)}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                #{index + 1} {item.title}
              </Text>
              <View style={[styles.badge, { backgroundColor: statusBg(item.status, theme) }]}>
                <Text style={[styles.badgeText, { color: statusColor(item.status, theme) }]}>
                  {STATUS_LABEL[item.status]}
                </Text>
              </View>
            </View>
            {item.description ? (
              <Text style={[styles.cardDesc, { color: theme.textSecondary }]} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
            <View style={styles.cardMetaRow}>
              <Text style={[styles.cardMeta, { color: theme.textMuted }]}>📅 {fmtDate(item.scheduled_date)}</Text>
              {item.due_time ? <Text style={[styles.cardMeta, { color: theme.textMuted }]}>⏰ até {item.due_time.slice(0, 5)}</Text> : null}
              {tab === 'history' && item.finished_at ? (
                <Text style={[styles.cardMeta, { color: theme.textMuted }]}>✔ {new Date(item.finished_at).toLocaleDateString('pt-BR')}</Text>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? null : (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>{tab === 'active' ? '✅' : '🗂️'}</Text>
              <Text style={{ color: theme.textMuted, fontSize: 15, textAlign: 'center', paddingHorizontal: 24 }}>
                {tab === 'active'
                  ? 'Nenhum serviço atribuído a você.'
                  : 'Nenhum serviço concluído nos últimos 7 dias.'}
              </Text>
            </View>
          )
        }
        ListFooterComponent={loading ? <ActivityIndicator style={{ margin: 16 }} color={theme.accent} /> : null}
      />

      {/* Modal de detalhe */}
      <Modal visible={detail !== null && !photoConfirm && cameraPhase === null} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, maxHeight: '92%' }}>
            {detail && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: theme.textPrimary, flex: 1, marginRight: 12, marginBottom: 8 }} numberOfLines={2}>
                    {detail.title}
                  </Text>
                  <TouchableOpacity onPress={() => setDetail(null)}>
                    <Text style={{ fontSize: 20, color: theme.textSecondary }}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12, backgroundColor: statusBg(detail.status, theme) }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: statusColor(detail.status, theme) }}>
                    {STATUS_LABEL[detail.status]}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 16, marginBottom: 14 }}>
                  <Text style={{ fontSize: 13, color: theme.textMuted }}>📅 {fmtDate(detail.scheduled_date)}</Text>
                  {detail.due_time ? <Text style={{ fontSize: 13, color: theme.textMuted }}>⏰ até {detail.due_time.slice(0, 5)}</Text> : null}
                </View>

                {(detail.started_at || detail.finished_at) ? (
                  <View style={{ backgroundColor: theme.success + '15', borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: theme.success + '40' }}>
                    {detail.started_at ? <Text style={{ fontSize: 13, color: theme.success, marginBottom: 2 }}>▶ Iniciado em: {new Date(detail.started_at).toLocaleString('pt-BR')}</Text> : null}
                    {detail.finished_at ? <Text style={{ fontSize: 13, color: theme.success }}>✔ Concluído em: {new Date(detail.finished_at).toLocaleString('pt-BR')}</Text> : null}
                  </View>
                ) : null}

                {detail.description ? (
                  <View style={{ backgroundColor: theme.elevated, borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: theme.border }}>
                    <Text style={{ fontSize: 13, color: theme.textSecondary }}>{detail.description}</Text>
                  </View>
                ) : null}

                {detail.issue_description ? (
                  <View style={{ backgroundColor: '#ea580c15', borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#ea580c40' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#ea580c', marginBottom: 4 }}>Ressalvas:</Text>
                    <Text style={{ fontSize: 13, color: theme.textSecondary }}>{detail.issue_description}</Text>
                  </View>
                ) : null}

                {detail.problem_description ? (
                  <View style={{ backgroundColor: theme.danger + '15', borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: theme.danger + '40' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.danger, marginBottom: 4 }}>Problema:</Text>
                    <Text style={{ fontSize: 13, color: theme.textSecondary }}>{detail.problem_description}</Text>
                  </View>
                ) : null}

                {beforePhotos.length > 0 && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>FOTOS — ANTES</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {beforePhotos.map((p) => {
                        const src = photoUrls[p.id];
                        return (
                          <TouchableOpacity key={p.id} onPress={() => src && setLightbox(src)} style={{ marginRight: 8 }}>
                            {src
                              ? <Image source={{ uri: src }} style={{ width: 80, height: 80, borderRadius: 8, resizeMode: 'cover' }} />
                              : <View style={{ width: 80, height: 80, borderRadius: 8, backgroundColor: theme.elevated, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.textMuted }}>…</Text></View>
                            }
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {afterPhotos.length > 0 && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>FOTOS — DEPOIS</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {afterPhotos.map((p) => {
                        const src = photoUrls[p.id];
                        return (
                          <TouchableOpacity key={p.id} onPress={() => src && setLightbox(src)} style={{ marginRight: 8 }}>
                            {src
                              ? <Image source={{ uri: src }} style={{ width: 80, height: 80, borderRadius: 8, resizeMode: 'cover' }} />
                              : <View style={{ width: 80, height: 80, borderRadius: 8, backgroundColor: theme.elevated, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.textMuted }}>…</Text></View>
                            }
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                <View style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 6 }}>Posto *</Text>
                  {detail.employee_posto && detail.status !== 'pending' ? (
                    <View style={{ backgroundColor: theme.elevated, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 12 }}>
                      <Text style={{ fontSize: 14, color: theme.textPrimary }}>{detail.employee_posto}</Text>
                    </View>
                  ) : (
                    <TextInput
                      style={{ borderWidth: 1.5, borderColor: theme.border, borderRadius: 10, padding: 12, fontSize: 14, color: theme.textPrimary, backgroundColor: theme.elevated }}
                      placeholder="Informe o posto de trabalho"
                      placeholderTextColor={theme.textMuted}
                      value={posto}
                      onChangeText={setPosto}
                    />
                  )}
                </View>

                {submitting && <ActivityIndicator color={theme.accent} style={{ marginVertical: 16 }} />}

                {!submitting && isActive && (
                  <View style={{ gap: 10 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>AÇÕES</Text>

                    {(gpsStatus === 'denied' || gpsStatus === 'unavailable') && (
                      <View style={{ borderRadius: 10, padding: 12, backgroundColor: theme.warning + '22', borderWidth: 1, borderColor: theme.warning + '55' }}>
                        <Text style={{ color: theme.warning, fontWeight: '600', fontSize: 13, textAlign: 'center' }}>
                          ⚠️ GPS necessário para ações
                        </Text>
                      </View>
                    )}

                    {detail.status === 'pending' && (
                      <TouchableOpacity
                        style={{ borderRadius: 10, padding: 14, alignItems: 'center', backgroundColor: theme.accent, opacity: (gpsStatus === 'denied' || gpsStatus === 'unavailable') ? 0.4 : 1 }}
                        disabled={gpsStatus === 'denied' || gpsStatus === 'unavailable'}
                        onPress={() => {
                          if (!posto.trim()) {
                            Alert.alert('Campo obrigatório', 'Preencha o campo Posto para iniciar o serviço.');
                            return;
                          }
                          setSessionUris([]);
                          openCamera('before');
                        }}
                      >
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>📷 Enviar Foto de Início</Text>
                      </TouchableOpacity>
                    )}

                    {detail.status === 'in_progress' && secsLeft > 0 && (
                      <View style={{ borderRadius: 10, padding: 14, backgroundColor: theme.warning + '22', borderWidth: 1, borderColor: theme.warning + '55', alignItems: 'center' }}>
                        <Text style={{ color: theme.warning, fontWeight: '700', fontSize: 14 }}>⏳ Aguarde para concluir</Text>
                        <Text style={{ color: theme.warning, fontSize: 24, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] }}>{timerLabel}</Text>
                        <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>Mínimo 5 min após o início</Text>
                      </View>
                    )}

                    {detail.status === 'in_progress' && (
                      <TouchableOpacity
                        style={{ borderRadius: 10, padding: 14, alignItems: 'center', backgroundColor: theme.success, opacity: (gpsStatus === 'denied' || gpsStatus === 'unavailable' || secsLeft > 0) ? 0.4 : 1 }}
                        disabled={gpsStatus === 'denied' || gpsStatus === 'unavailable' || secsLeft > 0}
                        onPress={() => { setSessionUris([]); openCamera('after'); }}
                      >
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>📷 Enviar Foto de Conclusão</Text>
                      </TouchableOpacity>
                    )}

                    {canIssues && (
                      <TouchableOpacity
                        style={{ borderRadius: 10, padding: 14, alignItems: 'center', backgroundColor: '#ea580c' }}
                        onPress={() => setIssuesModal(true)}
                      >
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>⚠️ Concluir com Ressalvas</Text>
                      </TouchableOpacity>
                    )}

                    {canProblem && (
                      <TouchableOpacity
                        style={{ borderRadius: 10, padding: 14, alignItems: 'center', backgroundColor: theme.danger }}
                        onPress={() => setProblemModal(true)}
                      >
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>🚨 Reportar Problema</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal "mais fotos ou concluir" */}
      <Modal visible={photoConfirm} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, maxHeight: '70%' }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: theme.textPrimary, marginBottom: 8 }}>{phaseLabel}</Text>
            <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 16 }}>
              {sessionUris.length} foto{sessionUris.length > 1 ? 's' : ''} adicionada{sessionUris.length > 1 ? 's' : ''}. O que deseja fazer?
            </Text>

            {sessionUris.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {sessionUris.map((uri, i) => (
                  <View key={i} style={{ marginRight: 8, position: 'relative' }}>
                    <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8, resizeMode: 'cover' }} />
                    <TouchableOpacity
                      style={{ position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}
                      onPress={() => setSessionUris((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={{ borderRadius: 10, padding: 14, alignItems: 'center', backgroundColor: theme.elevated, borderWidth: 1.5, borderColor: theme.border }}
                onPress={addMorePhoto}
              >
                <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 15 }}>📸 Adicionar Mais Fotos</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ borderRadius: 10, padding: 14, alignItems: 'center', backgroundColor: theme.accent, opacity: sessionUris.length === 0 ? 0.5 : 1 }}
                onPress={submitPhotos}
                disabled={sessionUris.length === 0}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>✓ Concluir Envio</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ borderRadius: 10, padding: 14, alignItems: 'center', backgroundColor: theme.elevated }}
                onPress={() => { setPhotoConfirm(false); setSessionPhase(null); setSessionUris([]); }}
              >
                <Text style={{ color: theme.textSecondary, fontWeight: '700', fontSize: 15 }}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: concluir com ressalvas */}
      <Modal visible={issuesModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, maxHeight: '60%' }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: theme.textPrimary, marginBottom: 8 }}>Concluir com Ressalvas</Text>
            <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 12 }}>
              Descreva as ressalvas. Você pode tirar uma foto (opcional).
            </Text>
            <TextInput
              style={{ borderWidth: 1.5, borderColor: theme.border, borderRadius: 10, padding: 12, fontSize: 14, color: theme.textPrimary, backgroundColor: theme.elevated, minHeight: 80, textAlignVertical: 'top', marginBottom: 4 }}
              placeholder="Descreva as ressalvas ou observações..."
              placeholderTextColor={theme.textMuted}
              value={issuesText}
              onChangeText={setIssuesText}
              multiline
              numberOfLines={3}
              maxLength={500}
            />
            <View style={{ gap: 8, marginTop: 14 }}>
              <TouchableOpacity
                style={{ borderRadius: 10, padding: 14, alignItems: 'center', backgroundColor: '#ea580c', opacity: !issuesText.trim() ? 0.5 : 1 }}
                disabled={!issuesText.trim()}
                onPress={() => { setIssuesModal(false); setSessionUris([]); setCameraPhase('issues'); }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>📷 Tirar Foto e Concluir</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ borderRadius: 10, padding: 14, alignItems: 'center', backgroundColor: theme.elevated, borderWidth: 1.5, borderColor: '#ea580c', opacity: !issuesText.trim() || submitting ? 0.5 : 1 }}
                disabled={!issuesText.trim() || submitting}
                onPress={() => handleUpdateStatus('done_with_issues', { issue_description: issuesText })}
              >
                <Text style={{ color: '#ea580c', fontWeight: '700', fontSize: 15 }}>Concluir Sem Foto</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ borderRadius: 10, padding: 14, alignItems: 'center', backgroundColor: theme.elevated }}
                onPress={() => setIssuesModal(false)}
              >
                <Text style={{ color: theme.textSecondary, fontWeight: '700', fontSize: 15 }}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: reportar problema */}
      <Modal visible={problemModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, maxHeight: '60%' }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: theme.textPrimary, marginBottom: 12 }}>Reportar Problema</Text>
            <TextInput
              style={{ borderWidth: 1.5, borderColor: theme.border, borderRadius: 10, padding: 12, fontSize: 14, color: theme.textPrimary, backgroundColor: theme.elevated, minHeight: 80, textAlignVertical: 'top', marginBottom: 4 }}
              placeholder="Descreva o problema encontrado..."
              placeholderTextColor={theme.textMuted}
              value={problemText}
              onChangeText={setProblemText}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: theme.border, alignItems: 'center' }}
                onPress={() => setProblemModal(false)}
              >
                <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 10, backgroundColor: theme.danger, alignItems: 'center', opacity: !problemText.trim() || submitting ? 0.5 : 1 }}
                disabled={!problemText.trim() || submitting}
                onPress={() => handleUpdateStatus('problem', { problem_description: problemText })}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Enviar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <TabBar active="services" onNavigate={onNavigate} unreadCount={unreadCount} servicesOnly={servicesOnly} />

      {/* Lightbox */}
      <Modal visible={lightbox !== null} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setLightbox(null)}
          activeOpacity={1}
        >
          {lightbox && (
            <Image source={{ uri: lightbox }} style={{ width: '95%', height: '80%', borderRadius: 8 }} resizeMode="contain" />
          )}
          <TouchableOpacity
            onPress={() => setLightbox(null)}
            style={{ position: 'absolute', top: 40, right: 20, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Câmera ao vivo */}
      <CameraModal
        visible={cameraPhase !== null}
        onCapture={handleCameraCapture}
        onCancel={handleCameraCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card:        { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 10 },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle:   { fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  cardDesc:    { fontSize: 13, marginBottom: 6 },
  cardMetaRow: { flexDirection: 'row', gap: 16 },
  cardMeta:    { fontSize: 12 },
  badge:       { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:   { fontSize: 11, fontWeight: '700' },
});
