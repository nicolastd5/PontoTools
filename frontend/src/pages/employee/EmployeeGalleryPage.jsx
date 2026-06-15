import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import usePullToRefresh from '../../hooks/usePullToRefresh';
import PullToRefreshIndicator from '../../components/shared/PullToRefreshIndicator';

function Icon({ d, size = 16, color = 'currentColor', strokeWidth = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const ICON_CAMERA = 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z';
const ICON_CLOSE  = 'M18 6 6 18M6 6l12 12';
const ICON_SEARCH = 'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z';
const ICON_FILTER = 'M22 3H2l8 9.46V19l4 2v-8.54z';

const STATUS_LABEL = {
  pending:          'Pendente',
  in_progress:      'Em andamento',
  done:             'Concluído',
  done_with_issues: 'C/ ressalvas',
  problem:          'Problema',
};

const STATUS_COLOR = {
  pending:          '#f59e0b',
  in_progress:      '#3b82f6',
  done:             '#10b981',
  done_with_issues: '#f97316',
  problem:          '#ef4444',
};

const CLOCK_LABEL = {
  entry: 'Entrada', exit: 'Saída',
  break_start: 'Início Intervalo', break_end: 'Fim Intervalo',
};

export default function EmployeeGalleryPage() {
  const [tab, setTab]           = useState('clock');
  const [lightbox, setLightbox] = useState(null);
  const [photoSrc, setPhotoSrc] = useState({});
  const queryClient             = useQueryClient();

  // Service gallery filters
  const [svcSearch, setSvcSearch]     = useState('');
  const [svcStatus, setSvcStatus]     = useState('');
  const [svcPhase, setSvcPhase]       = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const handleRefresh = useCallback(() => {
    return queryClient.invalidateQueries(['my-clock-history-gallery', 'my-services-gallery']);
  }, [queryClient]);
  const { containerRef, pullY, refreshing: ptrRefreshing } = usePullToRefresh(handleRefresh);

  const { data: clockData, isLoading: clockLoading } = useQuery({
    queryKey: ['my-clock-history-gallery'],
    queryFn:  () => api.get('/clock/history', { params: { limit: 50, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } }).then((r) => r.data.records),
    enabled:  tab === 'clock',
  });

  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['my-services-gallery'],
    queryFn:  () => api.get('/services').then((r) => r.data.services),
    enabled:  tab === 'services',
  });

  const [serviceDetails, setServiceDetails] = useState({});

  async function loadServiceDetail(id) {
    if (serviceDetails[id]) return;
    const res = await api.get(`/services/${id}`);
    setServiceDetails((p) => ({ ...p, [id]: res.data }));
  }

  async function loadClockPhoto(record) {
    if (!record.photo_path || photoSrc[record.id]) return;
    try {
      const res = await api.get(`/clock/${record.id}/photo`, { responseType: 'blob' });
      setPhotoSrc((p) => ({ ...p, [record.id]: URL.createObjectURL(res.data) }));
    } catch {}
  }

  async function loadServicePhoto(photoId, serviceId) {
    const key = `s_${photoId}`;
    if (photoSrc[key]) return;
    try {
      const res = await api.get(`/services/${serviceId}/photos/${photoId}`, { responseType: 'blob' });
      setPhotoSrc((p) => ({ ...p, [key]: URL.createObjectURL(res.data) }));
    } catch {}
  }

  const clockRecords = clockData || [];
  const servicesAll  = servicesData || [];

  const filteredServices = useMemo(() => {
    return servicesAll.filter((sv) => {
      if (svcSearch && !sv.title.toLowerCase().includes(svcSearch.toLowerCase())) return false;
      if (svcStatus && sv.status !== svcStatus) return false;
      if (svcPhase) {
        const full   = serviceDetails[sv.id];
        const photos = full?.photos || [];
        if (!photos.some((p) => p.phase === svcPhase)) return false;
      }
      return true;
    });
  }, [servicesAll, svcSearch, svcStatus, svcPhase, serviceDetails]);

  const activeFilterCount = [svcSearch, svcStatus, svcPhase].filter(Boolean).length;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <PullToRefreshIndicator pullY={pullY} refreshing={ptrRefreshing} />
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-ink)', marginBottom: 16, letterSpacing: '-0.03em' }}>Galeria</h1>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, padding: 4, marginBottom: 20, background: 'var(--color-hairline)', borderRadius: 10, width: 'fit-content' }}>
        {[{ key: 'clock', label: 'Registros' }, { key: 'services', label: 'Serviços' }].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '7px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: tab === t.key ? 'var(--bg-card)' : 'transparent',
            color: tab === t.key ? 'var(--color-primary)' : 'var(--color-muted)',
            boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Clock photos */}
      {tab === 'clock' && (
        clockLoading ? <p style={{ color: 'var(--color-muted)', padding: '24px 0', textAlign: 'center' }}>Carregando...</p>
        : clockRecords.filter((r) => r.photo_path).length === 0 ? <p style={{ color: 'var(--color-subtle)', padding: '24px 0', textAlign: 'center' }}>Nenhuma foto de registro encontrada.</p>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {clockRecords.filter((r) => r.photo_path).map((record) => {
              loadClockPhoto(record);
              const src = photoSrc[record.id];
              return (
                <div key={record.id} style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--color-line)', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div onClick={() => src && setLightbox(src)}
                      style={{ width: 70, height: 70, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-line)', background: 'var(--color-hairline)', flexShrink: 0, cursor: src ? 'zoom-in' : 'default' }}>
                      {src ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Icon d={ICON_CAMERA} size={22} color="var(--color-line)" /></div>}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-ink)', marginBottom: 2 }}>{CLOCK_LABEL[record.clock_type] || record.clock_type}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                        {new Date(record.clocked_at_utc).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                      {record.unit_name && <div style={{ fontSize: 12, color: 'var(--color-subtle)', marginTop: 2 }}>{record.unit_name}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Service photos */}
      {tab === 'services' && (
        servicesLoading ? <p style={{ color: 'var(--color-muted)', padding: '24px 0', textAlign: 'center' }}>Carregando...</p>
        : (
          <>
            {/* Filter bar */}
            <div style={{ marginBottom: 14 }}>
              {/* Search + toggle */}
              <div style={{ display: 'flex', gap: 8, marginBottom: showFilters ? 10 : 0 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <Icon d={ICON_SEARCH} size={14} color="var(--color-muted)" />
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar serviço..."
                    value={svcSearch}
                    onChange={(e) => setSvcSearch(e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '8px 10px 8px 30px', border: '1px solid var(--color-line)',
                      borderRadius: 8, fontSize: 13, background: 'var(--bg-card)',
                      color: 'var(--color-ink)', outline: 'none',
                    }}
                  />
                </div>
                <button
                  onClick={() => setShowFilters((v) => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '8px 12px', border: '1px solid var(--color-line)',
                    borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: activeFilterCount > 0 ? 'var(--color-primary)' : 'var(--bg-card)',
                    color: activeFilterCount > 0 ? '#fff' : 'var(--color-ink)',
                    flexShrink: 0,
                  }}
                >
                  <Icon d={ICON_FILTER} size={13} color={activeFilterCount > 0 ? '#fff' : 'var(--color-ink)'} />
                  Filtros
                  {activeFilterCount > 0 && (
                    <span style={{ background: 'rgba(255,255,255,0.3)', borderRadius: 10, padding: '1px 6px', fontSize: 11 }}>
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Expandable filter dropdowns */}
              {showFilters && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--color-line)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 130 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</label>
                    <select
                      value={svcStatus}
                      onChange={(e) => setSvcStatus(e.target.value)}
                      style={{ padding: '6px 8px', border: '1px solid var(--color-line)', borderRadius: 7, fontSize: 12, background: 'var(--bg-card)', color: 'var(--color-ink)', cursor: 'pointer' }}
                    >
                      <option value="">Todos</option>
                      {Object.entries(STATUS_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 130 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fase da foto</label>
                    <select
                      value={svcPhase}
                      onChange={(e) => setSvcPhase(e.target.value)}
                      style={{ padding: '6px 8px', border: '1px solid var(--color-line)', borderRadius: 7, fontSize: 12, background: 'var(--bg-card)', color: 'var(--color-ink)', cursor: 'pointer' }}
                    >
                      <option value="">Todas</option>
                      <option value="before">Antes</option>
                      <option value="after">Depois</option>
                    </select>
                  </div>
                  {(svcStatus || svcPhase) && (
                    <button
                      onClick={() => { setSvcStatus(''); setSvcPhase(''); }}
                      style={{ alignSelf: 'flex-end', padding: '6px 10px', border: '1px solid var(--color-line)', borderRadius: 7, fontSize: 12, cursor: 'pointer', background: 'transparent', color: 'var(--color-muted)' }}
                    >
                      Limpar
                    </button>
                  )}
                </div>
              )}

              {/* Result count */}
              {servicesAll.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 8 }}>
                  {filteredServices.length === servicesAll.length
                    ? `${servicesAll.length} serviço${servicesAll.length !== 1 ? 's' : ''}`
                    : `${filteredServices.length} de ${servicesAll.length} serviço${servicesAll.length !== 1 ? 's' : ''}`}
                </div>
              )}
            </div>

            {/* Results */}
            {servicesAll.length === 0 ? (
              <p style={{ color: 'var(--color-subtle)', padding: '24px 0', textAlign: 'center' }}>Nenhum serviço encontrado.</p>
            ) : filteredServices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <p style={{ color: 'var(--color-subtle)', marginBottom: 10 }}>Nenhum serviço corresponde aos filtros.</p>
                <button
                  onClick={() => { setSvcSearch(''); setSvcStatus(''); setSvcPhase(''); }}
                  style={{ fontSize: 13, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  Limpar filtros
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {filteredServices.map((sv) => {
                  loadServiceDetail(sv.id);
                  const full   = serviceDetails[sv.id];
                  const allPhotos = full?.photos || [];
                  const photos = svcPhase ? allPhotos.filter((p) => p.phase === svcPhase) : allPhotos;
                  return (
                    <div key={sv.id} style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--color-line)', padding: '13px 14px' }}>
                      <div style={{ marginBottom: photos.length ? 10 : 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-ink)', marginBottom: 2 }}>{sv.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                            {(() => { const [y,m,d] = sv.scheduled_date.slice(0,10).split('-'); return `${d}/${m}/${y}`; })()}
                          </div>
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, flexShrink: 0,
                          background: `${STATUS_COLOR[sv.status]}18`,
                          color: STATUS_COLOR[sv.status],
                        }}>
                          {STATUS_LABEL[sv.status]}
                        </span>
                      </div>
                      {photos.length === 0 && <div style={{ fontSize: 12, color: 'var(--color-subtle)', fontStyle: 'italic' }}>Sem fotos{svcPhase ? ` (${svcPhase === 'before' ? 'antes' : 'depois'})` : ''}</div>}
                      {photos.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {photos.map((photo) => {
                            const key = `s_${photo.id}`;
                            loadServicePhoto(photo.id, sv.id);
                            const src = photoSrc[key];
                            return (
                              <div key={photo.id}>
                                <div onClick={() => src && setLightbox(src)}
                                  style={{ width: 72, height: 72, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-line)', background: 'var(--color-hairline)', cursor: src ? 'zoom-in' : 'default' }}>
                                  {src ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Icon d={ICON_CAMERA} size={20} color="var(--color-line)" /></div>}
                                </div>
                                <span style={{ display: 'block', textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--color-subtle)', marginTop: 3 }}>{photo.phase === 'before' ? 'Antes' : 'Depois'}</span>
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
          </>
        )
      )}

      {/* Lightbox */}
      {lightbox && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} />
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 40, height: 40, color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon d={ICON_CLOSE} size={16} color="#fff" />
          </button>
        </div>
      )}
    </div>
  );
}
