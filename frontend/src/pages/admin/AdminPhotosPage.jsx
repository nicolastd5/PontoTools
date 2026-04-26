import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';

const fmtDate = (s) => { if (!s) return '—'; const [y,m,d] = String(s).slice(0,10).split('-'); return `${d}/${m}/${y}`; };
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

function Icon({ d, size = 16, color = 'currentColor', strokeWidth = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  );
}

const ICON_CAMERA  = 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z';
const ICON_CLOSE   = 'M18 6 6 18M6 6l12 12';
const ICON_TRASH   = 'M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2';
const ICON_CHECK   = 'M20 6 9 17l-5-5';
const ICON_CHEVRON_LEFT  = 'M15 18l-6-6 6-6';
const ICON_CHEVRON_RIGHT = 'M9 6l6 6-6 6';

const CLOCK_LABELS = {
  entry: 'Entrada', exit: 'Saída',
  break_start: 'Início intervalo', break_end: 'Fim intervalo',
};

const STATUS_LABEL = {
  pending: 'Pendente', in_progress: 'Em andamento',
  done: 'Concluído', done_with_issues: 'C/ ressalvas', problem: 'Problema',
};

function useClocks(filters, page) {
  return useQuery({
    queryKey: ['photos-clocks', filters, page],
    queryFn:  () => api.get('/admin/clocks', { params: { ...filters, page, limit: 24 } }).then((r) => r.data),
    keepPreviousData: true,
  });
}
function useUnits() {
  return useQuery({ queryKey: ['units'], queryFn: () => api.get('/units').then((r) => r.data.units) });
}

export default function AdminPhotosPage() {
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState('clock');

  const [filters, setFilters]   = useState({ unitId: '', clockType: '', startDate: '', endDate: '' });
  const [page, setPage]         = useState(1);
  const [lightbox, setLightbox] = useState(null);
  const [thumbs, setThumbs]     = useState({});
  const [deleting, setDeleting] = useState(null);
  const [selectMode, setSelectMode]   = useState(false);
  const [selected, setSelected]       = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [svcPhotoSrc, setSvcPhotoSrc]     = useState({});
  const [svcDetails, setSvcDetails]       = useState({});
  const [svcLightbox, setSvcLightbox]     = useState(null);
  const [svcDeleting, setSvcDeleting]     = useState(null);
  const [svcDeletingId, setSvcDeletingId] = useState(null);

  const { data: svcData, isLoading: svcLoading } = useQuery({
    queryKey: ['admin-services-gallery'],
    queryFn:  () => api.get('/services').then((r) => r.data.services),
    enabled:  tab === 'services',
  });

  async function loadSvcDetail(id) {
    if (svcDetails[id]) return;
    const res = await api.get(`/services/${id}`);
    setSvcDetails((p) => ({ ...p, [id]: res.data }));
  }

  async function deleteSvcPhoto(photoId, serviceId) {
    if (!window.confirm('Apagar esta foto permanentemente?')) return;
    setSvcDeleting(photoId);
    try {
      await api.delete(`/services/${serviceId}/photos/${photoId}`);
      setSvcDetails((p) => {
        const svc = p[serviceId]; if (!svc) return p;
        return { ...p, [serviceId]: { ...svc, photos: svc.photos.filter((ph) => ph.id !== photoId) } };
      });
      const key = `${serviceId}_${photoId}`;
      setSvcPhotoSrc((p) => { const n = { ...p }; delete n[key]; return n; });
      success('Foto apagada.');
    } catch { error('Erro ao apagar foto.'); }
    finally { setSvcDeleting(null); }
  }

  async function deleteSvcService(sv) {
    if (!window.confirm(`Apagar o serviço "${sv.title}" e todas as suas fotos permanentemente?`)) return;
    setSvcDeletingId(sv.id);
    try {
      await api.delete(`/services/${sv.id}`);
      setSvcDetails((p) => { const n = { ...p }; delete n[sv.id]; return n; });
      queryClient.invalidateQueries(['admin-services-gallery']);
      queryClient.invalidateQueries(['admin-services']);
      success('Serviço apagado.');
    } catch { error('Erro ao apagar serviço.'); }
    finally { setSvcDeletingId(null); }
  }

  async function loadSvcPhoto(photoId, serviceId) {
    const key = `${serviceId}_${photoId}`;
    if (svcPhotoSrc[key]) return;
    try {
      const res = await api.get(`/services/${serviceId}/photos/${photoId}`, { responseType: 'blob' });
      setSvcPhotoSrc((p) => ({ ...p, [key]: URL.createObjectURL(res.data) }));
    } catch {}
  }

  const { data, isLoading } = useClocks(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')),
    page
  );
  const { data: units = [] } = useUnits();
  const records = data?.records || [];

  useEffect(() => { setSelected(new Set()); }, [filters, page]);

  function updateFilter(key, val) { setFilters((p) => ({ ...p, [key]: val })); setPage(1); }

  const loadThumb = useCallback(async (record) => {
    if (thumbs[record.id] !== undefined) return;
    setThumbs((p) => ({ ...p, [record.id]: 'loading' }));
    try {
      const res = await api.get(`/admin/clocks/${record.id}/photo`, { responseType: 'blob' });
      const isPlaceholder = res.headers['x-photo-placeholder'] === 'true';
      const url = isPlaceholder ? 'placeholder' : URL.createObjectURL(res.data);
      const extRes = await api.get(`/admin/clocks/${record.id}/photos`);
      setThumbs((p) => ({ ...p, [record.id]: { primary: url, extras: extRes.data.photos || [] } }));
    } catch {
      setThumbs((p) => ({ ...p, [record.id]: { primary: 'error', extras: [] } }));
    }
  }, [thumbs]);

  useEffect(() => { records.forEach((r) => loadThumb(r)); }, [records]); // eslint-disable-line

  async function openLightbox(record) {
    if (selectMode) return;
    const list = [];
    try {
      const res = await api.get(`/admin/clocks/${record.id}/photo`, { responseType: 'blob' });
      const isPlaceholder = res.headers['x-photo-placeholder'] === 'true';
      list.push({ key: 'primary', url: isPlaceholder ? null : URL.createObjectURL(res.data), isPlaceholder });
    } catch { list.push({ key: 'primary', url: null, isPlaceholder: false, error: true }); }
    try {
      const extRes = await api.get(`/admin/clocks/${record.id}/photos`);
      for (const p of extRes.data.photos || []) {
        try {
          const r = await api.get(`/admin/clocks/${record.id}/photos/${p.id}`, { responseType: 'blob' });
          list.push({ key: `extra-${p.id}`, extraId: p.id, url: URL.createObjectURL(r.data) });
        } catch { list.push({ key: `extra-${p.id}`, extraId: p.id, url: null, error: true }); }
      }
    } catch {}
    setLightbox({ record, photoList: list, idx: 0 });
  }

  function toggleSelect(id, e) {
    e.stopPropagation();
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function toggleAll() {
    setSelected(selected.size === records.length ? new Set() : new Set(records.map((r) => r.id)));
  }
  function exitSelectMode() { setSelectMode(false); setSelected(new Set()); }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!window.confirm(`Apagar ${selected.size} registro(s) de ponto permanentemente?\n\nTodas as fotos associadas também serão removidas.`)) return;
    setBulkDeleting(true);
    let ok = 0, fail = 0;
    for (const id of selected) {
      try { await api.delete(`/admin/clocks/${id}`); setThumbs((p) => { const n = { ...p }; delete n[id]; return n; }); ok++; }
      catch { fail++; }
    }
    setBulkDeleting(false); setSelected(new Set()); setSelectMode(false);
    queryClient.invalidateQueries(['photos-clocks']);
    if (fail === 0) success(`${ok} registro(s) apagado(s).`);
    else error(`${ok} apagado(s), ${fail} com erro.`);
  }

  async function handleDelete() {
    if (!lightbox) return;
    const { record, photoList, idx } = lightbox;
    const current = photoList[idx];
    if (!window.confirm('Apagar esta foto permanentemente?')) return;
    setDeleting(current.key);
    try {
      if (current.key === 'primary') {
        await api.delete(`/admin/clocks/${record.id}/photo`);
        const newList = [...photoList]; newList[0] = { ...newList[0], url: null, isPlaceholder: true };
        setLightbox((p) => ({ ...p, photoList: newList }));
        setThumbs((p) => ({ ...p, [record.id]: { ...(p[record.id] || {}), primary: 'placeholder' } }));
      } else {
        await api.delete(`/admin/clocks/${record.id}/photos/${current.extraId}`);
        const newList = photoList.filter((p) => p.key !== current.key);
        setLightbox((p) => ({ ...p, photoList: newList, idx: Math.min(idx, newList.length - 1) }));
        setThumbs((prev) => {
          const t = prev[record.id]; if (!t || t === 'loading') return prev;
          return { ...prev, [record.id]: { ...t, extras: t.extras.filter((e) => e.id !== current.extraId) } };
        });
      }
      success('Foto apagada.');
    } catch { error('Erro ao apagar foto.'); }
    finally { setDeleting(null); }
  }

  async function handleDeleteRecord() {
    if (!lightbox) return;
    const { record } = lightbox;
    if (!window.confirm(`Apagar o registro de ${record.employee_name} (${CLOCK_LABELS[record.clock_type]}) permanentemente?`)) return;
    setDeleting('record');
    try {
      await api.delete(`/admin/clocks/${record.id}`);
      setLightbox(null);
      setThumbs((p) => { const n = { ...p }; delete n[record.id]; return n; });
      queryClient.invalidateQueries(['photos-clocks']);
      success('Registro apagado.');
    } catch { error('Erro ao apagar registro.'); }
    finally { setDeleting(null); }
  }

  const lb = lightbox;
  const current = lb ? lb.photoList[lb.idx] : null;
  const total = lb ? lb.photoList.length : 0;
  const allSelected = records.length > 0 && selected.size === records.length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-ink)', margin: 0, letterSpacing: '-0.03em' }}>Galeria de Fotos</h1>
        {tab === 'clock' && (
          <div style={{ display: 'flex', gap: 8 }}>
            {!selectMode ? (
              <button onClick={() => setSelectMode(true)} style={outlineBtn}>
                <Icon d={ICON_CHECK} size={14} color="var(--color-primary)" /> Selecionar
              </button>
            ) : (
              <>
                <button onClick={toggleAll} style={outlineBtn}>{allSelected ? 'Desmarcar todos' : 'Selecionar todos'}</button>
                <button onClick={exitSelectMode} style={ghostBtn}>Cancelar</button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: 'var(--color-hairline)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {[{ key: 'clock', label: 'Ponto' }, { key: 'services', label: 'Serviços' }].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '7px 20px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: tab === t.key ? 'var(--bg-card)' : 'transparent',
            color: tab === t.key ? 'var(--color-primary)' : 'var(--color-muted)',
            boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Services tab ── */}
      {tab === 'services' && (
        <div>
          {svcLoading ? <p style={{ color: 'var(--color-muted)', padding: 24 }}>Carregando...</p>
          : !svcData?.length ? <p style={{ color: 'var(--color-muted)', padding: 24 }}>Nenhum serviço encontrado.</p>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {svcData.map((sv) => {
                loadSvcDetail(sv.id);
                const full   = svcDetails[sv.id];
                const photos = full?.photos || [];
                return (
                  <div key={sv.id} style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--color-line)', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: photos.length ? 12 : 0, gap: 8 }}>
                      <div>
                        <span style={{ fontWeight: 700, color: 'var(--color-ink)', fontSize: 14 }}>{sv.title}</span>
                        <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--color-muted)' }}>
                          {sv.employee_name} · {fmtDate(sv.scheduled_date)} · {STATUS_LABEL[sv.status]}
                        </span>
                      </div>
                      <button onClick={() => deleteSvcService(sv)} disabled={svcDeletingId === sv.id}
                        style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, fontSize: 12, color: 'var(--color-danger)', cursor: 'pointer', fontWeight: 600, opacity: svcDeletingId === sv.id ? 0.6 : 1 }}>
                        <Icon d={ICON_TRASH} size={13} color="var(--color-danger)" />
                        {svcDeletingId === sv.id ? 'Apagando...' : 'Apagar serviço'}
                      </button>
                    </div>
                    {photos.length === 0 && <span style={{ fontSize: 12, color: 'var(--color-subtle)', fontStyle: 'italic' }}>Sem fotos</span>}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {photos.map((photo) => {
                        const key = `${sv.id}_${photo.id}`;
                        loadSvcPhoto(photo.id, sv.id);
                        const src = svcPhotoSrc[key];
                        return (
                          <div key={photo.id} style={{ position: 'relative' }}>
                            <div onClick={() => src && setSvcLightbox(src)}
                              style={{ width: 88, height: 88, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-line)', background: 'var(--color-hairline)', cursor: src ? 'zoom-in' : 'default' }}>
                              {src ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-subtle)' }}><Icon d={ICON_CAMERA} size={20} color="var(--color-subtle)" /></div>}
                            </div>
                            {src && (
                              <button onClick={(e) => { e.stopPropagation(); deleteSvcPhoto(photo.id, sv.id); }}
                                disabled={svcDeleting === photo.id}
                                style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(239,68,68,0.85)', border: 'none', borderRadius: '50%', width: 20, height: 20, color: '#fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {svcDeleting === photo.id ? '…' : '✕'}
                              </button>
                            )}
                            <span style={{ display: 'block', textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--color-subtle)', marginTop: 3 }}>
                              {photo.phase === 'before' ? 'Antes' : 'Depois'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {svcLightbox && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setSvcLightbox(null)}>
              <img src={svcLightbox} alt="" style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} />
              <button onClick={() => setSvcLightbox(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 40, height: 40, color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon d={ICON_CLOSE} size={16} color="#fff" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Clock tab ── */}
      {tab === 'clock' && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            {[
              <select key="unit" value={filters.unitId} onChange={(e) => updateFilter('unitId', e.target.value)} style={selectStyle}>
                <option value="">Todas as unidades</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>,
              <select key="type" value={filters.clockType} onChange={(e) => updateFilter('clockType', e.target.value)} style={selectStyle}>
                <option value="">Todos os tipos</option>
                <option value="entry">Entrada</option>
                <option value="exit">Saída</option>
                <option value="break_start">Início intervalo</option>
                <option value="break_end">Fim intervalo</option>
              </select>,
              <input key="sd" type="date" value={filters.startDate} onChange={(e) => updateFilter('startDate', e.target.value)} style={selectStyle} />,
              <input key="ed" type="date" value={filters.endDate} onChange={(e) => updateFilter('endDate', e.target.value)} style={selectStyle} />,
            ]}
            <button onClick={() => { setFilters({ unitId: '', clockType: '', startDate: '', endDate: '' }); setPage(1); }} style={ghostBtn}>Limpar ×</button>
          </div>

          {isLoading ? (
            <p style={{ color: 'var(--color-muted)', padding: 24 }}>Carregando...</p>
          ) : records.length === 0 ? (
            <p style={{ color: 'var(--color-muted)', padding: 24 }}>Nenhum registro encontrado.</p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(156px, 1fr))', gap: 12, marginBottom: 24 }}>
                {records.map((record) => {
                  const thumb      = thumbs[record.id];
                  const loading_   = !thumb || thumb === 'loading';
                  const isPh       = thumb?.primary === 'placeholder' || thumb?.primary === 'error';
                  const extraCount = thumb?.extras?.length || 0;
                  const isSelected = selected.has(record.id);

                  return (
                    <div key={record.id}
                      onClick={selectMode ? (e) => toggleSelect(record.id, e) : () => openLightbox(record)}
                      style={{ position: 'relative', background: 'var(--bg-card)', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', outline: isSelected ? `2.5px solid var(--color-primary)` : '2.5px solid transparent', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

                      {selectMode && (
                        <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }} onClick={(e) => toggleSelect(record.id, e)}>
                          <input type="checkbox" checked={isSelected} readOnly style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--color-primary)' }} />
                        </div>
                      )}

                      <div style={{ position: 'relative', width: '100%', paddingBottom: '75%', background: 'var(--color-hairline)' }}>
                        {loading_ ? (
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon d={ICON_CAMERA} size={24} color="var(--color-line)" />
                          </div>
                        ) : isPh ? (
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon d={ICON_CAMERA} size={24} color="var(--color-subtle)" />
                          </div>
                        ) : (
                          <img src={thumb.primary} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                        {extraCount > 0 && (
                          <span style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '2px 6px' }}>+{extraCount}</span>
                        )}
                      </div>

                      <div style={{ padding: '8px 10px' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-ink)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{record.employee_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{CLOCK_LABELS[record.clock_type]}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                          {formatInTimeZone(new Date(record.clocked_at_utc), record.timezone || 'America/Sao_Paulo', 'dd/MM HH:mm')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {data?.pagination && data.pagination.totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, padding: '16px 0' }}>
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={pageBtn}>
                    <Icon d={ICON_CHEVRON_LEFT} size={16} color="var(--color-muted)" />
                  </button>
                  <span style={{ fontSize: 13, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
                    {page} / {data.pagination.totalPages}
                  </span>
                  <button onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))} disabled={page === data.pagination.totalPages} style={pageBtn}>
                    <Icon d={ICON_CHEVRON_RIGHT} size={16} color="var(--color-muted)" />
                  </button>
                </div>
              )}
            </>
          )}

          {/* Bulk action bar */}
          {selectMode && selected.size > 0 && (
            <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-card)', border: '1px solid var(--color-line)', borderRadius: 12, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 500, whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)' }}>{selected.size} registro(s) selecionado(s)</span>
              <button onClick={handleBulkDelete} disabled={bulkDeleting}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px', background: 'var(--color-danger)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: bulkDeleting ? 0.7 : 1 }}>
                <Icon d={ICON_TRASH} size={14} color="#fff" />
                {bulkDeleting ? 'Apagando...' : `Apagar ${selected.size} registro(s)`}
              </button>
            </div>
          )}

          {/* Lightbox */}
          {lb && current && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(9,9,11,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={() => setLightbox(null)}>
              <div style={{ background: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth: 620, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 20px', borderBottom: '1px solid var(--color-hairline)' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-ink)' }}>{lb.record.employee_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      {CLOCK_LABELS[lb.record.clock_type]} · {formatInTimeZone(new Date(lb.record.clocked_at_utc), lb.record.timezone || 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm')}
                      {total > 1 && <span style={{ marginLeft: 8 }}>({lb.idx + 1}/{total})</span>}
                    </div>
                  </div>
                  <button onClick={() => setLightbox(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--color-muted)' }}>
                    <Icon d={ICON_CLOSE} size={18} color="var(--color-muted)" />
                  </button>
                </div>

                <div style={{ textAlign: 'center', padding: '0 20px', minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {current.isPlaceholder || !current.url ? (
                    <div style={{ color: 'var(--color-subtle)' }}>
                      <Icon d={ICON_CAMERA} size={48} color="var(--color-line)" />
                      <p style={{ marginTop: 12, fontSize: 13 }}>Foto removida ou não disponível.</p>
                    </div>
                  ) : current.error ? (
                    <div style={{ color: 'var(--color-danger)' }}>
                      <p style={{ fontSize: 13 }}>Erro ao carregar foto.</p>
                    </div>
                  ) : (
                    <img src={current.url} alt="" style={{ maxWidth: '100%', maxHeight: 420, borderRadius: 8, objectFit: 'contain' }} />
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 20px', flexWrap: 'wrap' }}>
                  {total > 1 && (
                    <button onClick={() => setLightbox((p) => ({ ...p, idx: Math.max(0, p.idx - 1) }))}
                      disabled={lb.idx === 0} style={{ ...pageBtn, opacity: lb.idx === 0 ? 0.3 : 1 }}>
                      <Icon d={ICON_CHEVRON_LEFT} size={16} color="var(--color-muted)" />
                    </button>
                  )}
                  {current.url && !current.isPlaceholder && (
                    <button onClick={handleDelete} disabled={!!deleting}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13, color: 'var(--color-danger)', cursor: 'pointer', fontWeight: 600, opacity: deleting ? 0.6 : 1 }}>
                      <Icon d={ICON_TRASH} size={13} color="var(--color-danger)" />
                      {deleting === current.key ? 'Apagando...' : 'Apagar foto'}
                    </button>
                  )}
                  <button onClick={handleDeleteRecord} disabled={!!deleting}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 13, color: '#991b1b', cursor: 'pointer', fontWeight: 700, opacity: deleting ? 0.6 : 1 }}>
                    <Icon d={ICON_TRASH} size={13} color="#991b1b" />
                    {deleting === 'record' ? 'Apagando...' : 'Apagar registro'}
                  </button>
                  {total > 1 && (
                    <button onClick={() => setLightbox((p) => ({ ...p, idx: Math.min(total - 1, p.idx + 1) }))}
                      disabled={lb.idx === total - 1} style={{ ...pageBtn, opacity: lb.idx === total - 1 ? 0.3 : 1 }}>
                      <Icon d={ICON_CHEVRON_RIGHT} size={16} color="var(--color-muted)" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const selectStyle = { padding: '8px 11px', border: '1.5px solid var(--color-line)', borderRadius: 8, fontSize: 13, color: 'var(--color-ink)', background: 'var(--bg-card)', outline: 'none' };
const outlineBtn  = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1.5px solid var(--color-line)', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: 'var(--color-primary)', background: 'var(--bg-card)', fontWeight: 600 };
const ghostBtn    = { padding: '8px 14px', background: 'var(--color-hairline)', border: '1.5px solid var(--color-line)', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: 'var(--color-muted)', fontWeight: 600 };
const pageBtn     = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'var(--color-hairline)', border: '1px solid var(--color-line)', borderRadius: 8, cursor: 'pointer' };
