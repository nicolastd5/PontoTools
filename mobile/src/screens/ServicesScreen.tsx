// mobile/src/screens/ServicesScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Modal, ScrollView, Alert, ActivityIndicator,
  RefreshControl, TextInput, Image,
} from 'react-native';
import { launchCamera, type CameraOptions } from 'react-native-image-picker';
import Geolocation from '@react-native-community/geolocation';
import api from '../services/api';
import TabBar from '../components/TabBar';

type Screen = 'dashboard' | 'history' | 'services' | 'notifications';

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

const STATUS_COLOR: Record<string, string> = {
  pending:          '#64748b',
  in_progress:      '#d97706',
  done:             '#16a34a',
  done_with_issues: '#ea580c',
  problem:          '#dc2626',
};

const STATUS_BG: Record<string, string> = {
  pending:          '#f1f5f9',
  in_progress:      '#fffbeb',
  done:             '#f0fdf4',
  done_with_issues: '#fff7ed',
  problem:          '#fef2f2',
};

function fmtDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function getGps(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      ()    => resolve(null),
      { timeout: 6000, maximumAge: 30000 }
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
  const [services, setServices]     = useState<ServiceOrder[]>([]);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail]         = useState<ServiceOrder | null>(null);
  const [posto, setPosto]           = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fotos capturadas na sessão atual (antes de concluir)
  const [sessionPhase, setSessionPhase]   = useState<'before' | 'after' | 'issues' | null>(null);
  const [sessionUris, setSessionUris]     = useState<string[]>([]);
  const [photoConfirm, setPhotoConfirm]   = useState(false); // modal "mais fotos ou concluir"

  // Fotos salvas no servidor
  const [photoUrls, setPhotoUrls]         = useState<Record<number, string>>({});
  const [lightbox, setLightbox]           = useState<string | null>(null);

  // Modais de texto
  const [problemModal, setProblemModal] = useState(false);
  const [problemText, setProblemText]   = useState('');
  const [issuesModal, setIssuesModal]   = useState(false);
  const [issuesText, setIssuesText]     = useState('');

  const loadServices = useCallback(async (reset = false) => {
    if (!reset) setLoading(true);
    try {
      const { data } = await api.get('/services');
      setServices(data.services);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  React.useEffect(() => { loadServices(false); }, []);

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
      setDetail(data);
      setPosto(data.employee_posto || '');
    } catch {
      setDetail(service);
      setPosto(service.employee_posto || '');
    }
  }, []);

  const reloadDetail = useCallback(async (id: number) => {
    try {
      const { data } = await api.get(`/services/${id}`);
      setDetail(data);
      setPosto(data.employee_posto || '');
      setPhotoUrls({});
    } catch {}
  }, []);

  // Abre câmera nativa em tela cheia; ao voltar, exibe modal de confirmação
  const openCamera = useCallback(async (phase: 'before' | 'after' | 'issues') => {
    const options: CameraOptions = {
      mediaType: 'photo',
      cameraType: 'back',
      quality: 0.7,
      maxWidth: 1024,
      maxHeight: 1024,
      saveToPhotos: false,
    };
    const result = await launchCamera(options);
    if (result.didCancel || result.errorCode || !result.assets?.[0]?.uri) return;
    const uri = result.assets[0].uri!;
    setSessionPhase(phase);
    setSessionUris((prev) => [...prev, uri]);
    setPhotoConfirm(true); // abre modal "mais fotos ou concluir"
  }, []);

  // Tira mais uma foto na mesma fase
  const addMorePhoto = useCallback(async () => {
    setPhotoConfirm(false);
    if (!sessionPhase) return;
    const options: CameraOptions = {
      mediaType: 'photo',
      cameraType: 'back',
      quality: 0.7,
      maxWidth: 1024,
      maxHeight: 1024,
      saveToPhotos: false,
    };
    const result = await launchCamera(options);
    if (result.didCancel || result.errorCode || !result.assets?.[0]?.uri) {
      setPhotoConfirm(true); // volta ao modal se cancelou
      return;
    }
    const uri = result.assets[0].uri!;
    setSessionUris((prev) => [...prev, uri]);
    setPhotoConfirm(true);
  }, [sessionPhase]);

  // Envia todas as fotos da sessão e atualiza status
  const submitPhotos = useCallback(async () => {
    if (!detail || !sessionPhase) return;
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
        });
      }

      if (sessionPhase === 'issues') {
        await api.patch(`/services/${detail.id}/status`, {
          status: 'done_with_issues',
          issue_description: issuesText,
        });
        setIssuesText('');
      }

      setSessionPhase(null);
      setSessionUris([]);
      loadServices(false);
      await reloadDetail(detail.id);
    } catch (err: any) {
      Alert.alert('Erro', err?.response?.data?.error || 'Não foi possível enviar.');
    } finally {
      setSubmitting(false);
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
      setProblemModal(false);
      setProblemText('');
      setIssuesModal(false);
      setIssuesText('');
      loadServices(false);
      await reloadDetail(detail.id);
    } catch (err: any) {
      Alert.alert('Erro', err?.response?.data?.error || 'Não foi possível atualizar.');
    } finally {
      setSubmitting(false);
    }
  }, [detail, loadServices, reloadDetail]);

  const loadPhotoUrl = useCallback((photo: ServicePhoto, serviceId: number) => {
    if (photoUrls[photo.id]) return;
    const url = `${(api.defaults.baseURL ?? '').replace('/api', '')}/api/services/${serviceId}/photos/${photo.id}`;
    setPhotoUrls((prev) => ({ ...prev, [photo.id]: url }));
  }, [photoUrls]);

  const allPhotos    = detail?.photos ?? [];
  const beforePhotos = allPhotos.filter((p) => p.phase === 'before');
  const afterPhotos  = allPhotos.filter((p) => p.phase === 'after');

  const isActive   = detail && (detail.status === 'pending' || detail.status === 'in_progress');
  const canIssues  = detail?.status === 'in_progress';
  const canProblem = detail && (detail.status === 'in_progress' || detail.status === 'pending');

  const phaseLabel = sessionPhase === 'before' ? 'Foto de Início'
    : sessionPhase === 'after' ? 'Foto de Conclusão'
    : 'Foto de Ressalvas';

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <TabBar active="services" onNavigate={onNavigate} unreadCount={unreadCount} servicesOnly={servicesOnly} />

      <FlatList
        data={services}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadServices(true); }}
            colors={['#1d4ed8']}
          />
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity style={styles.card} onPress={() => openDetail(item)}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={1}>#{index + 1} {item.title}</Text>
              <View style={[styles.badge, { backgroundColor: STATUS_BG[item.status] }]}>
                <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] }]}>
                  {STATUS_LABEL[item.status]}
                </Text>
              </View>
            </View>
            {item.description ? (
              <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
            ) : null}
            <View style={styles.cardMetaRow}>
              <Text style={styles.cardMeta}>📅 {fmtDate(item.scheduled_date)}</Text>
              {item.due_time ? <Text style={styles.cardMeta}>⏰ até {item.due_time.slice(0, 5)}</Text> : null}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? null : (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>✅</Text>
              <Text style={{ color: '#94a3b8', fontSize: 15 }}>Nenhum serviço atribuído a você.</Text>
            </View>
          )
        }
        ListFooterComponent={loading ? <ActivityIndicator style={{ margin: 16 }} color="#1d4ed8" /> : null}
      />

      {/* Modal de detalhe */}
      <Modal visible={detail !== null && !photoConfirm} transparent animationType="slide">
        <View style={modal.overlay}>
          <View style={modal.box}>
            {detail && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={modal.header}>
                  <Text style={modal.title} numberOfLines={2}>{detail.title}</Text>
                  <TouchableOpacity onPress={() => setDetail(null)}>
                    <Text style={{ fontSize: 20, color: '#64748b' }}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={[modal.statusBadge, { backgroundColor: STATUS_BG[detail.status] }]}>
                  <Text style={[modal.statusText, { color: STATUS_COLOR[detail.status] }]}>
                    {STATUS_LABEL[detail.status]}
                  </Text>
                </View>

                <View style={modal.metaRow}>
                  <Text style={modal.metaText}>📅 {fmtDate(detail.scheduled_date)}</Text>
                  {detail.due_time ? <Text style={modal.metaText}>⏰ até {detail.due_time.slice(0, 5)}</Text> : null}
                </View>

                {(detail.started_at || detail.finished_at) ? (
                  <View style={modal.tsBox}>
                    {detail.started_at ? <Text style={modal.tsText}>▶ Iniciado em: {new Date(detail.started_at).toLocaleString('pt-BR')}</Text> : null}
                    {detail.finished_at ? <Text style={modal.tsText}>✔ Concluído em: {new Date(detail.finished_at).toLocaleString('pt-BR')}</Text> : null}
                  </View>
                ) : null}

                {detail.description ? (
                  <View style={modal.descBox}><Text style={modal.descText}>{detail.description}</Text></View>
                ) : null}

                {detail.issue_description ? (
                  <View style={[modal.descBox, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
                    <Text style={[modal.descLabel, { color: '#ea580c' }]}>Ressalvas:</Text>
                    <Text style={modal.descText}>{detail.issue_description}</Text>
                  </View>
                ) : null}

                {detail.problem_description ? (
                  <View style={[modal.descBox, { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }]}>
                    <Text style={[modal.descLabel, { color: '#dc2626' }]}>Problema:</Text>
                    <Text style={modal.descText}>{detail.problem_description}</Text>
                  </View>
                ) : null}

                {/* Fotos — Antes */}
                {beforePhotos.length > 0 && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={modal.photoSectionLabel}>FOTOS — ANTES</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {beforePhotos.map((p) => {
                        loadPhotoUrl(p, detail.id);
                        const src = photoUrls[p.id];
                        return (
                          <TouchableOpacity key={p.id} onPress={() => src && setLightbox(src)} style={modal.thumbWrap}>
                            {src
                              ? <Image source={{ uri: src }} style={modal.thumb} />
                              : <View style={[modal.thumb, { backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: '#94a3b8' }}>…</Text></View>
                            }
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* Fotos — Depois */}
                {afterPhotos.length > 0 && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={modal.photoSectionLabel}>FOTOS — DEPOIS</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {afterPhotos.map((p) => {
                        loadPhotoUrl(p, detail.id);
                        const src = photoUrls[p.id];
                        return (
                          <TouchableOpacity key={p.id} onPress={() => src && setLightbox(src)} style={modal.thumbWrap}>
                            {src
                              ? <Image source={{ uri: src }} style={modal.thumb} />
                              : <View style={[modal.thumb, { backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: '#94a3b8' }}>…</Text></View>
                            }
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* Campo Posto */}
                <View style={{ marginBottom: 14 }}>
                  <Text style={modal.fieldLabel}>Posto</Text>
                  {detail.employee_posto && detail.status !== 'pending' ? (
                    <View style={modal.fieldReadonly}>
                      <Text style={{ fontSize: 14, color: '#374151' }}>{detail.employee_posto}</Text>
                    </View>
                  ) : (
                    <TextInput
                      style={modal.fieldInput}
                      placeholder="Informe o posto de trabalho"
                      placeholderTextColor="#94a3b8"
                      value={posto}
                      onChangeText={setPosto}
                    />
                  )}
                </View>

                {submitting && <ActivityIndicator color="#1d4ed8" style={{ marginVertical: 16 }} />}

                {!submitting && isActive && (
                  <View style={{ gap: 10 }}>
                    <Text style={modal.actionsLabel}>AÇÕES</Text>

                    {detail.status === 'pending' && (
                      <TouchableOpacity
                        style={[modal.actionBtn, { backgroundColor: '#1d4ed8' }]}
                        onPress={() => { setSessionUris([]); openCamera('before'); }}
                      >
                        <Text style={modal.actionBtnText}>📷 Enviar Foto de Início</Text>
                      </TouchableOpacity>
                    )}

                    {detail.status === 'in_progress' && (
                      <TouchableOpacity
                        style={[modal.actionBtn, { backgroundColor: '#16a34a' }]}
                        onPress={() => { setSessionUris([]); openCamera('after'); }}
                      >
                        <Text style={modal.actionBtnText}>📷 Enviar Foto de Conclusão</Text>
                      </TouchableOpacity>
                    )}

                    {canIssues && (
                      <TouchableOpacity
                        style={[modal.actionBtn, { backgroundColor: '#ea580c' }]}
                        onPress={() => setIssuesModal(true)}
                      >
                        <Text style={modal.actionBtnText}>⚠️ Concluir com Ressalvas</Text>
                      </TouchableOpacity>
                    )}

                    {canProblem && (
                      <TouchableOpacity
                        style={[modal.actionBtn, { backgroundColor: '#dc2626' }]}
                        onPress={() => setProblemModal(true)}
                      >
                        <Text style={modal.actionBtnText}>🚨 Reportar Problema</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal "mais fotos ou concluir" — aparece após cada foto */}
      <Modal visible={photoConfirm} transparent animationType="slide">
        <View style={modal.overlay}>
          <View style={[modal.box, { maxHeight: '70%' }]}>
            <Text style={modal.title}>{phaseLabel}</Text>
            <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              {sessionUris.length} foto{sessionUris.length > 1 ? 's' : ''} adicionada{sessionUris.length > 1 ? 's' : ''}. O que deseja fazer?
            </Text>

            {/* Miniaturas das fotos da sessão */}
            {sessionUris.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {sessionUris.map((uri, i) => (
                  <View key={i} style={{ marginRight: 8, position: 'relative' }}>
                    <Image source={{ uri }} style={modal.thumb} />
                    <TouchableOpacity
                      style={modal.removeBtn}
                      onPress={() => setSessionUris((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={{ gap: 10 }}>
              <TouchableOpacity style={[modal.actionBtn, { backgroundColor: '#475569' }]} onPress={addMorePhoto}>
                <Text style={modal.actionBtnText}>📸 Adicionar Mais Fotos</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modal.actionBtn, { backgroundColor: '#1d4ed8' }]}
                onPress={submitPhotos}
                disabled={sessionUris.length === 0}
              >
                <Text style={modal.actionBtnText}>✓ Concluir Envio</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modal.actionBtn, { backgroundColor: '#f1f5f9' }]}
                onPress={() => { setPhotoConfirm(false); setSessionPhase(null); setSessionUris([]); }}
              >
                <Text style={[modal.actionBtnText, { color: '#64748b' }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: concluir com ressalvas */}
      <Modal visible={issuesModal} transparent animationType="fade">
        <View style={modal.overlay}>
          <View style={[modal.box, { maxHeight: '60%' }]}>
            <Text style={modal.title}>Concluir com Ressalvas</Text>
            <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
              Descreva as ressalvas. Você pode tirar uma foto (opcional).
            </Text>
            <TextInput
              style={modal.problemInput}
              placeholder="Descreva as ressalvas ou observações..."
              placeholderTextColor="#94a3b8"
              value={issuesText}
              onChangeText={setIssuesText}
              multiline
              numberOfLines={3}
              maxLength={500}
            />
            <View style={{ gap: 8, marginTop: 14 }}>
              <TouchableOpacity
                style={[modal.actionBtn, { backgroundColor: '#ea580c', opacity: !issuesText.trim() ? 0.5 : 1 }]}
                disabled={!issuesText.trim()}
                onPress={() => { setIssuesModal(false); setSessionUris([]); openCamera('issues'); }}
              >
                <Text style={modal.actionBtnText}>📷 Tirar Foto e Concluir</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modal.actionBtn, { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#ea580c', opacity: !issuesText.trim() ? 0.5 : 1 }]}
                disabled={!issuesText.trim() || submitting}
                onPress={() => handleUpdateStatus('done_with_issues', { issue_description: issuesText })}
              >
                <Text style={[modal.actionBtnText, { color: '#ea580c' }]}>Concluir Sem Foto</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modal.actionBtn, { backgroundColor: '#f1f5f9' }]}
                onPress={() => setIssuesModal(false)}
              >
                <Text style={[modal.actionBtnText, { color: '#64748b' }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: reportar problema */}
      <Modal visible={problemModal} transparent animationType="fade">
        <View style={modal.overlay}>
          <View style={[modal.box, { maxHeight: '60%' }]}>
            <Text style={modal.title}>Reportar Problema</Text>
            <TextInput
              style={modal.problemInput}
              placeholder="Descreva o problema encontrado..."
              placeholderTextColor="#94a3b8"
              value={problemText}
              onChangeText={setProblemText}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <View style={[modal.actions, { marginTop: 14 }]}>
              <TouchableOpacity style={modal.cancelBtn} onPress={() => setProblemModal(false)}>
                <Text style={modal.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modal.confirmBtn, { backgroundColor: '#dc2626', opacity: !problemText.trim() || submitting ? 0.5 : 1 }]}
                disabled={!problemText.trim() || submitting}
                onPress={() => handleUpdateStatus('problem', { problem_description: problemText })}
              >
                <Text style={modal.confirmText}>Enviar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    </View>
  );
}

const styles = StyleSheet.create({
  card:        { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, marginBottom: 10 },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle:   { fontSize: 15, fontWeight: '700', color: '#0f172a', flex: 1, marginRight: 8 },
  cardDesc:    { fontSize: 13, color: '#64748b', marginBottom: 6 },
  cardMetaRow: { flexDirection: 'row', gap: 16 },
  cardMeta:    { fontSize: 12, color: '#94a3b8' },
  badge:       { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:   { fontSize: 11, fontWeight: '700' },
});

const modal = StyleSheet.create({
  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  box:              { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, maxHeight: '92%' },
  header:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  title:            { fontSize: 17, fontWeight: '800', color: '#0f172a', flex: 1, marginRight: 12, marginBottom: 8 },
  statusBadge:      { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12 },
  statusText:       { fontSize: 12, fontWeight: '700' },
  metaRow:          { flexDirection: 'row', gap: 16, marginBottom: 14 },
  metaText:         { fontSize: 13, color: '#94a3b8' },
  tsBox:            { backgroundColor: '#f0fdf4', borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#bbf7d0' },
  tsText:           { fontSize: 13, color: '#166534', marginBottom: 2 },
  descBox:          { backgroundColor: '#f8fafc', borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  descLabel:        { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  descText:         { fontSize: 13, color: '#374151' },
  photoSectionLabel:{ fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 8 },
  thumbWrap:        { marginRight: 8 },
  thumb:            { width: 80, height: 80, borderRadius: 8, resizeMode: 'cover' },
  removeBtn:        { position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  fieldLabel:       { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  fieldInput:       { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, color: '#0f172a' },
  fieldReadonly:    { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12 },
  actionsLabel:     { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 4 },
  actionBtn:        { borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 2 },
  actionBtnText:    { color: '#fff', fontWeight: '700', fontSize: 15 },
  problemInput:     { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, color: '#0f172a', minHeight: 80, textAlignVertical: 'top', marginBottom: 4 },
  actions:          { flexDirection: 'row', gap: 12 },
  cancelBtn:        { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center' },
  cancelText:       { color: '#64748b', fontWeight: '600' },
  confirmBtn:       { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#1d4ed8', alignItems: 'center' },
  confirmText:      { color: '#fff', fontWeight: '700', fontSize: 15 },
});
