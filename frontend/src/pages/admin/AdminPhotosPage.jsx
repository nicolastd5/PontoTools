import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const CLOCK_LABELS = {
  entry: 'Entrada', exit: 'Saída',
  break_start: 'Início intervalo', break_end: 'Fim intervalo',
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

const STATUS_LABEL = {
  pending: 'Pendente', in_progress: 'Em andamento',
  done: 'Concluído', done_with_issues: 'C/ ressalvas', problem: 'Problema',
};

export default function AdminPhotosPage() {
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState('clock'); // 'clock' | 'services'

  const [filters, setFilters]   = useState({ unitId: '', clockType: '', startDate: '', endDate: '' });
  const [page, setPage]         = useState(1);
  const [lightbox, setLightbox] = useState(null); // { record, photoList, idx }
  const [thumbs, setThumbs]     = useState({});   // recordId → { primary, extras[] } | 'loading'
  const [deleting, setDeleting] = useState(null);

  // Seleção múltipla
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected]     = useState(new Set()); // Set de record IDs
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Aba serviços
  const [svcPhotoSrc, setSvcPhotoSrc]       = useState({});
  const [svcDetails, setSvcDetails]         = useState({});
  const [svcLightbox, setSvcLightbox]       = useState(null);
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

  // Limpa seleção ao trocar página/filtro
  useEffect(() => { setSelected(new Set()); }, [filters, page]);

  function updateFilter(key, val) {
    setFilters((p) => ({ ...p, [key]: val }));
    setPage(1);
  }

  const loadThumb = useCallback(async (record) => {
    if (thumbs[record.id] !== undefined) return;
    setThumbs((p) => ({ ...p, [record.id]: 'loading' }));
    try {
      const res = await api.get(`/admin/clocks/${record.id}/photo`, { responseType: 'blob' });
      const isPlaceholder = res.headers['x-photo-placeholder'] === 'true';
      const url = isPlaceholder ? 'placeholder' : URL.createObjectURL(res.data);
      const extRes = await api.get(`/admin/clocks/${record.id}/photos`);
      const extras = extRes.data.photos || [];
      setThumbs((p) => ({ ...p, [record.id]: { primary: url, extras } }));
    } catch {
      setThumbs((p) => ({ ...p, [record.id]: { primary: 'error', extras: [] } }));
    }
  }, [thumbs]);

  useEffect(() => { records.forEach((r) => loadThumb(r)); }, [records]); // eslint-disable-line

  async function openLightbox(record) {
    if (selectMode) return; // em modo seleção, clique = toggle
    const list = [];
    try {
      const res = await api.get(`/admin/clocks/${record.id}/photo`, { responseType: 'blob' });
      const isPlaceholder = res.headers['x-photo-placeholder'] === 'true';
      list.push({ key: 'primary', url: isPlaceholder ? null : URL.createObjectURL(res.data), isPlaceholder });
    } catch {
      list.push({ key: 'primary', url: null, isPlaceholder: false, error: true });
    }
    try {
      const extRes = await api.get(`/admin/clocks/${record.id}/photos`);
      for (const p of extRes.data.photos || []) {
        try {
          const r = await api.get(`/admin/clocks/${record.id}/photos/${p.id}`, { responseType: 'blob' });
          list.push({ key: `extra-${p.id}`, extraId: p.id, url: URL.createObjectURL(r.data) });
        } catch {
          list.push({ key: `extra-${p.id}`, extraId: p.id, url: null, error: true });
        }
      }
    } catch {}
    setLightbox({ record, photoList: list, idx: 0 });
  }

  function toggleSelect(id, e) {
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === records.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(records.map((r) => r.id)));
    }
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  // Apaga múltiplos registros de ponto
  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!window.confirm(
      `Apagar ${selected.size} registro(s) de ponto permanentemente?\n\nTodas as fotos associadas também serão removidas. Esta ação não pode ser desfeita.`
    )) return;

    setBulkDeleting(true);
    let ok = 0;
    let fail = 0;
    for (const id of selected) {
      try {
        await api.delete(`/admin/clocks/${id}`);
        setThumbs((p) => { const n = { ...p }; delete n[id]; return n; });
        ok++;
      } catch {
        fail++;
      }
    }
    setBulkDeleting(false);
    setSelected(new Set());
    setSelectMode(false);
    queryClient.invalidateQueries(['photos-clocks']);
    if (fail === 0) success(`${ok} registro(s) apagado(s).`);
    else error(`${ok} apagado(s), ${fail} com erro.`);
  }

  // Deleção individual (lightbox)
  async function handleDelete() {
    if (!lightbox) return;
    const { record, photoList, idx } = lightbox;
    const current = photoList[idx];
    if (!window.confirm('Apagar esta foto permanentemente?')) return;
    setDeleting(current.key);
    try {
      if (current.key === 'primary') {
        await api.delete(`/admin/clocks/${record.id}/photo`);
        const newList = [...photoList];
        newList[0] = { ...newList[0], url: null, isPlaceholder: true };
        setLightbox((p) => ({ ...p, photoList: newList }));
        setThumbs((p) => ({ ...p, [record.id]: { ...(p[record.id] || {}), primary: 'placeholder' } }));
      } else {
        await api.delete(`/admin/clocks/${record.id}/photos/${current.extraId}`);
        const newList = photoList.filter((p) => p.key !== current.key);
        setLightbox((p) => ({ ...p, photoList: newList, idx: Math.min(idx, newList.length - 1) }));
        setThumbs((prev) => {
          const t = prev[record.id];
          if (!t || t === 'loading') return prev;
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
    if (!window.confirm(
      `Apagar o registro de ${record.employee_name} (${CLOCK_LABELS[record.clock_type]}) permanentemente?`
    )) return;
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

  const lb      = lightbox;
  const current = lb ? lb.photoList[lb.idx] : null;
  const total   = lb ? lb.photoList.length : 0;
  const allSelected = records.length > 0 && selected.size === records.length;

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={s.title}>Galeria de Fotos</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {!selectMode ? (
            <button onClick={() => setSelectMode(true)} style={s.outlineBtn}>
              Selecionar registros
            </button>
          ) : (
            <>
              <button onClick={toggleAll} style={s.outlineBtn}>
                {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
              <button onClick={exitSelectMode} style={s.clearBtn}>Cancelar</button>
            </>
          )}
        </div>
      </div>

      {/* Submenu tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: '#f1f5f9', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        <button onClick={() => setTab('clock')}    style={{ padding: '7px 20px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: tab === 'clock'    ? '#fff' : 'transparent', color: tab === 'clock'    ? '#1d4ed8' : '#64748b', boxShadow: tab === 'clock'    ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>Ponto</button>
        <button onClick={() => setTab('services')} style={{ padding: '7px 20px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: tab === 'services' ? '#fff' : 'transparent', color: tab === 'services' ? '#1d4ed8' : '#64748b', boxShadow: tab === 'services' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>Serviços</button>
      </div>

      {/* ---- ABA SERVIÇOS ---- */}
      {tab === 'services' && (
        <div>
          {svcLoading ? <p style={{ color: '#64748b', padding: 24 }}>Carregando...</p> :
          !svcData?.length ? <p style={{ color: '#64748b', padding: 24 }}>Nenhum serviço encontrado.</p> :
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {svcData.map((sv) => {
              loadSvcDetail(sv.id);
              const full   = svcDetails[sv.id];
              const photos = full?.photos || [];
              return (
                <div key={sv.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 16px' }}>
                  <div style={{ marginBottom: photos.length ? 10 : 0 }}>
                    <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{sv.title}</span>
                    <span style={{ marginLeft: 10, fontSize: 12, color: '#64748b' }}>{sv.employee_name} · {new Date(sv.scheduled_date).toLocaleDateString('pt-BR')} · {STATUS_LABEL[sv.status]}</span>
                  </div>
                  {photos.length === 0 && <span style={{ fontSize: 12, color: '#cbd5e1', fontStyle: 'italic' }}>Sem fotos</span>}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {photos.map((photo) => {
                      const key = `${sv.id}_${photo.id}`;
                      loadSvcPhoto(photo.id, sv.id);
                      const src = svcPhotoSrc[key];
                      return (
                        <div key={photo.id} style={{ position: 'relative' }}>
                          <div
                            onClick={() => src && setSvcLightbox(src)}
                            style={{ width: 90, height: 90, borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: src ? 'zoom-in' : 'default' }}>
                            {src
                              ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#cbd5e1' }}>…</div>
                            }
                          </div>
                          <span style={{ display: 'block', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#64748b', marginTop: 3 }}>
                            {photo.phase === 'before' ? 'Antes' : 'Depois'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>}

          {/* Lightbox serviços */}
          {svcLightbox && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setSvcLightbox(null)}>
              <img src={svcLightbox} alt="" style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} />
              <button onClick={() => setSvcLightbox(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 40, height: 40, color: '#fff', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
          )}
        </div>
      )}

      {/* ---- ABA PONTO ---- */}
      {tab === 'clock' && <>

      {/* Filtros */}
      <div style={s.filters}>
        <select value={filters.unitId} onChange={(e) => updateFilter('unitId', e.target.value)} style={s.select}>
          <option value="">Todas as unidades</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select value={filters.clockType} onChange={(e) => updateFilter('clockType', e.target.value)} style={s.select}>
          <option value="">Todos os tipos</option>
          <option value="entry">Entrada</option>
          <option value="exit">Saída</option>
          <option value="break_start">Início intervalo</option>
          <option value="break_end">Fim intervalo</option>
        </select>
        <input type="date" value={filters.startDate} onChange={(e) => updateFilter('startDate', e.target.value)} style={s.input} />
        <input type="date" value={filters.endDate} onChange={(e) => updateFilter('endDate', e.target.value)} style={s.input} />
        <button onClick={() => { setFilters({ unitId: '', clockType: '', startDate: '', endDate: '' }); setPage(1); }} style={s.clearBtn}>Limpar</button>
      </div>

      {/* Grade */}
      {isLoading ? (
        <p style={{ color: '#64748b', padding: 24 }}>Carregando...</p>
      ) : records.length === 0 ? (
        <p style={{ color: '#64748b', padding: 24 }}>Nenhum registro encontrado.</p>
      ) : (
        <>
          <div style={s.grid}>
            {records.map((record) => {
              const thumb      = thumbs[record.id];
              const loading    = !thumb || thumb === 'loading';
              const isPh       = thumb?.primary === 'placeholder' || thumb?.primary === 'error';
              const extraCount = thumb?.extras?.length || 0;
              const isSelected = selected.has(record.id);

              return (
                <div key={record.id}
                  onClick={selectMode ? (e) => toggleSelect(record.id, e) : () => openLightbox(record)}
                  style={{ ...s.card, outline: isSelected ? '2.5px solid #1d4ed8' : '2.5px solid transparent', background: isSelected ? '#eff6ff' : '#fff' }}>

                  {/* Checkbox em modo seleção */}
                  {selectMode && (
                    <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }}
                      onClick={(e) => toggleSelect(record.id, e)}>
                      <input type="checkbox" checked={isSelected} readOnly
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#1d4ed8' }} />
                    </div>
                  )}

                  {/* Thumbnail */}
                  <div style={s.imgBox}>
                    {loading ? (
                      <div style={s.imgPlaceholder}>⏳</div>
                    ) : isPh ? (
                      <div style={s.imgPlaceholder}>📷</div>
                    ) : (
                      <img src={thumb.primary} alt="" style={s.img} />
                    )}
                    {extraCount > 0 && (
                      <span style={s.extraBadge}>+{extraCount}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div style={s.info}>
                    <div style={s.empName}>{record.employee_name}</div>
                    <div style={s.meta}>{CLOCK_LABELS[record.clock_type]}</div>
                    <div style={s.meta}>
                      {formatInTimeZone(new Date(record.clocked_at_utc), record.timezone || 'America/Sao_Paulo', 'dd/MM HH:mm')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Paginação */}
          {data?.pagination && data.pagination.totalPages > 1 && (
            <div style={s.pagination}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={s.pageBtn}>◀</button>
              <span style={{ fontSize: 13, color: '#64748b' }}>Página {page} de {data.pagination.totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))} disabled={page === data.pagination.totalPages} style={s.pageBtn}>▶</button>
            </div>
          )}
        </>
      )}

      {/* Barra de ação em massa (fixa em baixo) */}
      {selectMode && selected.size > 0 && (
        <div style={bulkBar}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
            {selected.size} registro(s) selecionado(s)
          </span>
          <button onClick={handleBulkDelete} disabled={bulkDeleting}
            style={{ padding: '9px 22px', background: '#dc2626', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: bulkDeleting ? 0.7 : 1 }}>
            {bulkDeleting ? 'Apagando...' : `🗑 Apagar ${selected.size} registro(s)`}
          </button>
        </div>
      )}

      {/* Lightbox */}
      {lb && current && (
        <div style={overlay} onClick={() => setLightbox(null)}>
          <div style={lbBox} onClick={(e) => e.stopPropagation()}>
            <div style={lbHeader}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{lb.record.employee_name}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {CLOCK_LABELS[lb.record.clock_type]} · {formatInTimeZone(new Date(lb.record.clocked_at_utc), lb.record.timezone || 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm')}
                  {total > 1 && <span style={{ marginLeft: 8 }}>({lb.idx + 1}/{total})</span>}
                </div>
              </div>
              <button onClick={() => setLightbox(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <div style={{ textAlign: 'center', padding: '0 20px', minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {current.isPlaceholder || !current.url ? (
                <div style={{ color: '#94a3b8' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
                  <p>Foto removida ou não disponível.</p>
                </div>
              ) : current.error ? (
                <div style={{ color: '#dc2626' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                  <p>Erro ao carregar foto.</p>
                </div>
              ) : (
                <img src={current.url} alt="" style={{ maxWidth: '100%', maxHeight: 420, borderRadius: 8, objectFit: 'contain' }} />
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px 20px', flexWrap: 'wrap' }}>
              {total > 1 && (
                <button onClick={() => setLightbox((p) => ({ ...p, idx: Math.max(0, p.idx - 1) }))}
                  disabled={lb.idx === 0} style={{ ...pageBtn, opacity: lb.idx === 0 ? 0.3 : 1 }}>◀</button>
              )}
              {current.url && !current.isPlaceholder && (
                <button onClick={handleDelete} disabled={!!deleting}
                  style={{ padding: '7px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#dc2626', cursor: 'pointer', fontWeight: 600, opacity: deleting ? 0.6 : 1 }}>
                  {deleting === current.key ? 'Apagando...' : '🗑 Apagar foto'}
                </button>
              )}
              <button onClick={handleDeleteRecord} disabled={!!deleting}
                style={{ padding: '7px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b', cursor: 'pointer', fontWeight: 700, opacity: deleting ? 0.6 : 1 }}>
                {deleting === 'record' ? 'Apagando...' : '🗑 Apagar registro'}
              </button>
              {total > 1 && (
                <button onClick={() => setLightbox((p) => ({ ...p, idx: Math.min(total - 1, p.idx + 1) }))}
                  disabled={lb.idx === total - 1} style={{ ...pageBtn, opacity: lb.idx === total - 1 ? 0.3 : 1 }}>▶</button>
              )}
            </div>
          </div>
        </div>
      )}
      </>}
    </div>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 };
const lbBox   = { background: '#fff', borderRadius: 12, width: '100%', maxWidth: 620, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.3)' };
const lbHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' };
const pageBtn  = { padding: '7px 16px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 16, cursor: 'pointer', color: '#374151' };
const bulkBar  = { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', zIndex: 500, whiteSpace: 'nowrap' };

const s = {
  title:    { fontSize: 22, fontWeight: 800, color: '#0f172a' },
  filters:  { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 },
  select:   { padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#374151', background: '#fff', outline: 'none' },
  input:    { padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#374151', outline: 'none' },
  clearBtn: { padding: '8px 16px', background: '#f1f5f9', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, cursor: 'pointer', color: '#374151' },
  outlineBtn: { padding: '8px 16px', border: '1.5px solid #1d4ed8', borderRadius: 8, fontSize: 14, cursor: 'pointer', color: '#1d4ed8', background: '#fff', fontWeight: 600 },
  grid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 },
  card:     { position: 'relative', background: '#fff', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', transition: 'outline 0.1s' },
  imgBox:   { position: 'relative', width: '100%', paddingBottom: '75%', background: '#f8fafc' },
  img:      { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
  imgPlaceholder: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#cbd5e1' },
  extraBadge: { position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '2px 7px' },
  info:     { padding: '8px 10px' },
  empName:  { fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  meta:     { fontSize: 11, color: '#64748b' },
  pagination: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, padding: '16px 0' },
  pageBtn:  { padding: '7px 16px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, cursor: 'pointer', color: '#374151' },
};
