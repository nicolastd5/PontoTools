import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';

const STATUS_LABEL = {
  pending:          'Pendente',
  in_progress:      'Em andamento',
  done:             'Concluído',
  done_with_issues: 'C/ ressalvas',
  problem:          'Problema',
};

export default function EmployeeGalleryPage() {
  const [tab, setTab]       = useState('clock'); // 'clock' | 'services'
  const [lightbox, setLightbox] = useState(null);
  const [photoSrc, setPhotoSrc] = useState({});

  // Fotos de ponto (histórico)
  const { data: clockData, isLoading: clockLoading } = useQuery({
    queryKey: ['my-clock-history-gallery'],
    queryFn:  () => api.get('/clock/history', { params: { limit: 50 } }).then((r) => r.data.records),
    enabled:  tab === 'clock',
  });

  // Serviços com fotos
  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['my-services-gallery'],
    queryFn:  () => api.get('/services').then((r) => r.data.services),
    enabled:  tab === 'services',
  });

  const [serviceDetails, setServiceDetails] = useState({}); // id → full service

  async function loadServiceDetail(id) {
    if (serviceDetails[id]) return;
    const res = await api.get(`/services/${id}`);
    setServiceDetails((p) => ({ ...p, [id]: res.data }));
  }

  async function loadClockPhoto(record) {
    if (!record.photo_path || photoSrc[record.id]) return;
    try {
      const res = await api.get(`/clock/${record.id}/photo`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      setPhotoSrc((p) => ({ ...p, [record.id]: url }));
    } catch {}
  }

  async function loadServicePhoto(photoId, serviceId) {
    const key = `s_${photoId}`;
    if (photoSrc[key]) return;
    try {
      const res = await api.get(`/services/${serviceId}/photos/${photoId}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      setPhotoSrc((p) => ({ ...p, [key]: url }));
    } catch {}
  }

  const clockRecords   = clockData || [];
  const servicesWithPhotos = (servicesData || []);

  return (
    <div>
      <h1 style={s.title}>Galeria</h1>

      {/* Submenu */}
      <div style={s.tabs}>
        <button onClick={() => setTab('clock')}    style={{ ...s.tab, ...(tab === 'clock'    ? s.tabActive : {}) }}>Ponto</button>
        <button onClick={() => setTab('services')} style={{ ...s.tab, ...(tab === 'services' ? s.tabActive : {}) }}>Serviços</button>
      </div>

      {/* Fotos de ponto */}
      {tab === 'clock' && (
        clockLoading ? <p style={s.empty}>Carregando...</p> :
        clockRecords.length === 0 ? <p style={s.empty}>Nenhuma foto de ponto encontrada.</p> :
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {clockRecords.filter((r) => r.photo_path).map((record) => {
            loadClockPhoto(record);
            const src = photoSrc[record.id];
            return (
              <div key={record.id} style={s.card}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div
                    onClick={() => src && setLightbox(src)}
                    style={{ ...s.thumb, cursor: src ? 'zoom-in' : 'default', flexShrink: 0 }}>
                    {src
                      ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={s.thumbPlaceholder}>📷</div>
                    }
                  </div>
                  <div>
                    <div style={s.cardLabel}>{CLOCK_LABEL[record.clock_type] || record.clock_type}</div>
                    <div style={s.cardMeta}>
                      {new Date(record.clocked_at_utc).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                    {record.unit_name && <div style={s.cardUnit}>{record.unit_name}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Fotos de serviços */}
      {tab === 'services' && (
        servicesLoading ? <p style={s.empty}>Carregando...</p> :
        servicesWithPhotos.length === 0 ? <p style={s.empty}>Nenhum serviço encontrado.</p> :
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {servicesWithPhotos.map((sv) => {
            loadServiceDetail(sv.id);
            const full = serviceDetails[sv.id];
            const photos = full?.photos || [];
            return (
              <div key={sv.id} style={s.card}>
                <div style={{ marginBottom: photos.length ? 10 : 0 }}>
                  <div style={s.cardLabel}>{sv.title}</div>
                  <div style={s.cardMeta}>
                    {new Date(sv.scheduled_date).toLocaleDateString('pt-BR')} · {STATUS_LABEL[sv.status]}
                  </div>
                </div>
                {photos.length === 0 && <div style={s.noPhoto}>Sem fotos registradas</div>}
                {photos.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {photos.map((photo) => {
                      const key = `s_${photo.id}`;
                      loadServicePhoto(photo.id, sv.id);
                      const src = photoSrc[key];
                      return (
                        <div key={photo.id} style={{ position: 'relative' }}>
                          <div
                            onClick={() => src && setLightbox(src)}
                            style={{ ...s.thumb, cursor: src ? 'zoom-in' : 'default' }}>
                            {src
                              ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <div style={s.thumbPlaceholder}>…</div>
                            }
                          </div>
                          <span style={s.phaseBadge}>{photo.phase === 'before' ? 'Antes' : 'Depois'}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} />
          <button
            onClick={() => setLightbox(null)}
            style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 40, height: 40, color: '#fff', fontSize: 20, cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

const CLOCK_LABEL = {
  entry: 'Entrada', exit: 'Saída',
  break_start: 'Início Intervalo', break_end: 'Fim Intervalo',
};

const s = {
  title:   { fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 16 },
  tabs:    { display: 'flex', gap: 0, marginBottom: 20, background: '#f1f5f9', borderRadius: 10, padding: 4 },
  tab:     { flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', background: 'transparent', color: '#64748b' },
  tabActive: { background: '#fff', color: '#1d4ed8', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' },
  card:    { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 16px' },
  thumb:   { width: 72, height: 72, borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc' },
  thumbPlaceholder: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 22, color: '#cbd5e1' },
  cardLabel: { fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 2 },
  cardMeta:  { fontSize: 12, color: '#64748b' },
  cardUnit:  { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  noPhoto:   { fontSize: 12, color: '#cbd5e1', fontStyle: 'italic' },
  phaseBadge: { display: 'block', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#64748b', marginTop: 3 },
  empty:   { color: '#94a3b8', padding: '24px 0', textAlign: 'center' },
};
