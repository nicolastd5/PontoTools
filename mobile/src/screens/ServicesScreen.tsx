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
}

interface ServicePhoto {
  id: number;
  phase: 'before' | 'after';
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

export default function ServicesScreen({
  onNavigate,
  unreadCount = 0,
}: {
  onNavigate: (s: Screen) => void;
  unreadCount?: number;
}) {
  const [services, setServices]         = useState<ServiceOrder[]>([]);
  const [loading, setLoading]           = useState(false);
  const [refreshing, setRefreshing]     = useState(false);
  const [selected, setSelected]         = useState<ServiceOrder | null>(null);
  const [photos, setPhotos]             = useState<ServicePhoto[]>([]);
  const [newPhotoUris, setNewPhotoUris] = useState<string[]>([]);
  const [problemText, setProblemText]   = useState('');
  const [issuesText, setIssuesText]     = useState('');
  const [posto, setPosto]               = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [showProblemInput, setShowProblemInput] = useState(false);
  const [showIssuesInput, setShowIssuesInput]   = useState(false);

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
    setSelected(service);
    setNewPhotoUris([]);
    setProblemText('');
    setIssuesText('');
    setPosto(service.employee_posto || '');
    setShowProblemInput(false);
    setShowIssuesInput(false);
    try {
      const { data } = await api.get(`/services/${service.id}`);
      setPhotos(data.photos || []);
      setSelected(data);
      setPosto(data.employee_posto || '');
    } catch { setPhotos([]); }
  }, []);

  function getGps(): Promise<{ latitude: number; longitude: number } | null> {
    return new Promise((resolve) => {
      Geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        ()    => resolve(null),
        { timeout: 6000, maximumAge: 30000 }
      );
    });
  }

  const takePhoto = useCallback(async () => {
    const options: CameraOptions = {
      mediaType: 'photo',
      cameraType: 'back',
      quality: 0.7,
      maxWidth: 1024,
      maxHeight: 1024,
      saveToPhotos: false,
    };
    const result = await launchCamera(options);
    if (result.didCancel || result.errorCode) return;
    const uri = result.assets?.[0]?.uri;
    if (uri) setNewPhotoUris((prev) => [...prev, uri]);
  }, []);

  const handleUpdateStatus = useCallback(async (
    serviceId: number,
    status: 'in_progress' | 'done' | 'done_with_issues' | 'problem',
    problemDescription?: string,
    issueDescription?: string,
  ) => {
    setSubmitting(true);
    try {
      // 1. Atualiza status
      await api.patch(`/services/${serviceId}/status`, {
        status,
        problem_description: problemDescription,
        issue_description:   issueDescription,
      });

      // 2. Envia fotos novas
      const phase = status === 'in_progress' ? 'before' : 'after';
      const gps = await getGps();
      for (const uri of newPhotoUris) {
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
        await api.post(`/services/${serviceId}/photos`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      setSelected(null);
      loadServices(false);
      Alert.alert('Atualizado!', `Status alterado para "${STATUS_LABEL[status]}".`);
    } catch (err: any) {
      Alert.alert('Erro', err?.response?.data?.error || 'Não foi possível atualizar.');
    } finally {
      setSubmitting(false);
    }
  }, [newPhotoUris, posto, loadServices]);

  const isActive = selected && (selected.status === 'pending' || selected.status === 'in_progress');

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <TabBar active="services" onNavigate={onNavigate} unreadCount={unreadCount} />

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
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openDetail(item)}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <View style={[styles.badge, { backgroundColor: STATUS_BG[item.status] }]}>
                <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] }]}>
                  {STATUS_LABEL[item.status]}
                </Text>
              </View>
            </View>
            {item.description ? (
              <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
            ) : null}
            <Text style={styles.cardMeta}>{item.unit_name} · {fmtDate(item.scheduled_date)}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? null : (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ color: '#94a3b8', fontSize: 15 }}>Nenhum serviço atribuído.</Text>
            </View>
          )
        }
        ListFooterComponent={loading ? <ActivityIndicator style={{ margin: 16 }} color="#1d4ed8" /> : null}
      />

      {/* Modal de detalhe */}
      <Modal visible={selected !== null} transparent animationType="slide">
        <View style={modal.overlay}>
          <View style={modal.box}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selected && (
                <>
                  <View style={modal.header}>
                    <Text style={modal.title}>{selected.title}</Text>
                    <TouchableOpacity onPress={() => setSelected(null)}>
                      <Text style={{ fontSize: 20, color: '#64748b' }}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[modal.statusBadge, { backgroundColor: STATUS_BG[selected.status] }]}>
                    <Text style={[modal.statusText, { color: STATUS_COLOR[selected.status] }]}>
                      {STATUS_LABEL[selected.status]}
                    </Text>
                  </View>

                  {selected.description ? (
                    <Text style={modal.desc}>{selected.description}</Text>
                  ) : null}

                  <Text style={modal.meta}>
                    {selected.unit_name} · {fmtDate(selected.scheduled_date)}
                    {selected.due_time ? ` às ${selected.due_time.slice(0, 5)}` : ''}
                  </Text>

                  {selected.problem_description ? (
                    <View style={modal.problemBox}>
                      <Text style={modal.problemLabel}>Problema relatado:</Text>
                      <Text style={modal.problemText}>{selected.problem_description}</Text>
                    </View>
                  ) : null}

                  {selected.issue_description ? (
                    <View style={[modal.problemBox, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
                      <Text style={[modal.problemLabel, { color: '#ea580c' }]}>Ressalvas:</Text>
                      <Text style={modal.problemText}>{selected.issue_description}</Text>
                    </View>
                  ) : null}

                  {(selected.started_at || selected.finished_at) ? (
                    <View style={modal.tsBox}>
                      {selected.started_at ? (
                        <Text style={modal.tsText}>▶ Iniciado em: {new Date(selected.started_at).toLocaleString('pt-BR')}</Text>
                      ) : null}
                      {selected.finished_at ? (
                        <Text style={modal.tsText}>✔ Concluído em: {new Date(selected.finished_at).toLocaleString('pt-BR')}</Text>
                      ) : null}
                    </View>
                  ) : null}

                  {/* Campo Posto */}
                  <View style={{ marginBottom: 14 }}>
                    <Text style={modal.fieldLabel}>Posto</Text>
                    {selected.employee_posto && selected.status !== 'pending' ? (
                      <View style={modal.fieldReadonly}>
                        <Text style={{ fontSize: 14, color: '#374151' }}>{selected.employee_posto}</Text>
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

                  {/* Fotos existentes */}
                  {photos.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      {photos.map((p) => (
                        <View key={p.id} style={{ marginRight: 8 }}>
                          <Image
                            source={{ uri: `${api.defaults.baseURL?.replace('/api','')}/api/services/${selected.id}/photos/${p.id}`,
                              headers: { Authorization: '' } }}
                            style={modal.thumb}
                          />
                          <Text style={modal.thumbLabel}>{p.phase === 'before' ? 'Antes' : 'Depois'}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  )}

                  {/* Fotos novas selecionadas */}
                  {newPhotoUris.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                      {newPhotoUris.map((uri, i) => (
                        <View key={i} style={{ marginRight: 8, position: 'relative' }}>
                          <Image source={{ uri }} style={modal.thumb} />
                          <TouchableOpacity
                            style={modal.removeBtn}
                            onPress={() => setNewPhotoUris((prev) => prev.filter((_, idx) => idx !== i))}
                          >
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  )}

                  {/* Botão adicionar foto */}
                  {isActive && (
                    <TouchableOpacity style={modal.photoBtn} onPress={takePhoto}>
                      <Text style={modal.photoBtnText}>📸 Adicionar foto</Text>
                    </TouchableOpacity>
                  )}

                  {/* Ações */}
                  {!submitting && !showProblemInput && !showIssuesInput && (
                    <>
                      {selected.status === 'pending' && (
                        <TouchableOpacity
                          style={[modal.actionBtn, { backgroundColor: '#d97706' }]}
                          onPress={() => handleUpdateStatus(selected.id, 'in_progress')}
                        >
                          <Text style={modal.actionBtnText}>Iniciar serviço</Text>
                        </TouchableOpacity>
                      )}

                      {selected.status === 'in_progress' && (
                        <View style={{ gap: 10 }}>
                          <TouchableOpacity
                            style={[modal.actionBtn, { backgroundColor: '#16a34a' }]}
                            onPress={() => handleUpdateStatus(selected.id, 'done')}
                          >
                            <Text style={modal.actionBtnText}>Concluir serviço</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[modal.actionBtn, { backgroundColor: '#ea580c' }]}
                            onPress={() => setShowIssuesInput(true)}
                          >
                            <Text style={modal.actionBtnText}>Concluir com ressalvas</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[modal.actionBtn, { backgroundColor: '#dc2626' }]}
                            onPress={() => setShowProblemInput(true)}
                          >
                            <Text style={modal.actionBtnText}>Reportar problema</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  )}

                  {/* Input de ressalvas */}
                  {showIssuesInput && !submitting && (
                    <View>
                      <TextInput
                        style={modal.problemInput}
                        placeholder="Descreva as ressalvas..."
                        placeholderTextColor="#94a3b8"
                        value={issuesText}
                        onChangeText={setIssuesText}
                        multiline
                        numberOfLines={3}
                        maxLength={500}
                      />
                      <TouchableOpacity
                        style={[modal.actionBtn, { backgroundColor: '#ea580c', marginTop: 10 }]}
                        onPress={() => handleUpdateStatus(selected!.id, 'done_with_issues', undefined, issuesText)}
                        disabled={!issuesText.trim()}
                      >
                        <Text style={modal.actionBtnText}>Confirmar ressalvas</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[modal.actionBtn, { backgroundColor: '#64748b', marginTop: 6 }]}
                        onPress={() => setShowIssuesInput(false)}
                      >
                        <Text style={modal.actionBtnText}>Cancelar</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Input de problema */}
                  {showProblemInput && !submitting && (
                    <View>
                      <TextInput
                        style={modal.problemInput}
                        placeholder="Descreva o problema..."
                        placeholderTextColor="#94a3b8"
                        value={problemText}
                        onChangeText={setProblemText}
                        multiline
                        numberOfLines={3}
                        maxLength={500}
                      />
                      <TouchableOpacity
                        style={[modal.actionBtn, { backgroundColor: '#dc2626', marginTop: 10 }]}
                        onPress={() => handleUpdateStatus(selected!.id, 'problem', problemText)}
                        disabled={!problemText.trim()}
                      >
                        <Text style={modal.actionBtnText}>Confirmar problema</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[modal.actionBtn, { backgroundColor: '#64748b', marginTop: 6 }]}
                        onPress={() => setShowProblemInput(false)}
                      >
                        <Text style={modal.actionBtnText}>Cancelar</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {submitting && <ActivityIndicator color="#1d4ed8" style={{ marginTop: 16 }} />}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card:       { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle:  { fontSize: 15, fontWeight: '700', color: '#0f172a', flex: 1, marginRight: 8 },
  cardDesc:   { fontSize: 13, color: '#64748b', marginBottom: 6 },
  cardMeta:   { fontSize: 12, color: '#94a3b8' },
  badge:      { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:  { fontSize: 11, fontWeight: '700' },
});

const modal = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  box:          { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, maxHeight: '90%' },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title:        { fontSize: 17, fontWeight: '800', color: '#0f172a', flex: 1, marginRight: 12 },
  statusBadge:  { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12 },
  statusText:   { fontSize: 12, fontWeight: '700' },
  desc:         { fontSize: 14, color: '#374151', marginBottom: 10, lineHeight: 20 },
  meta:         { fontSize: 12, color: '#94a3b8', marginBottom: 14 },
  fieldLabel:   { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  fieldInput:   { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, color: '#0f172a' },
  fieldReadonly:{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12 },
  problemBox:   { backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#fca5a5' },
  problemLabel: { fontSize: 11, fontWeight: '700', color: '#dc2626', marginBottom: 4 },
  problemText:  { fontSize: 13, color: '#374151' },
  tsBox:        { backgroundColor: '#f0fdf4', borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#bbf7d0' },
  tsText:       { fontSize: 13, color: '#166534', marginBottom: 2 },
  thumb:        { width: 80, height: 80, borderRadius: 8, resizeMode: 'cover' },
  thumbLabel:   { fontSize: 10, color: '#64748b', textAlign: 'center', marginTop: 2 },
  removeBtn:    { position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  photoBtn:     { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 12 },
  photoBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  actionBtn:    { borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 8 },
  actionBtnText:{ color: '#fff', fontWeight: '700', fontSize: 15 },
  problemInput: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, color: '#0f172a', minHeight: 80, textAlignVertical: 'top' },
});
