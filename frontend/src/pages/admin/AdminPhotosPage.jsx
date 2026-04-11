import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
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

export default function AdminPhotosPage() {
  const { success, error } = useToast();

  const [filters, setFilters] = useState({ unitId: '', clockType: '', startDate: '', endDate: '' });
  const [page, setPage]       = useState(1);
  const [lightbox, setLightbox] = useState(null); // { record, photoList, idx }
  const [thumbs, setThumbs]   = useState({}); // recordId → { primary: url|null|'placeholder', extras: [{id, url}] }
  const [deleting, setDeleting] = useState(null);

  const { data, isLoading } = useClocks(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')),
    page
  );
  const { data: units = [] } = useUnits();
  const records = data?.records || [];

  function updateFilter(key, val) {
    setFilters((p) => ({ ...p, [key]: val }));
    setPage(1);
  }

  // Load thumbnail for a record
  const loadThumb = useCallback(async (record) => {
    if (thumbs[record.id] !== undefined) return;
    setThumbs((p) => ({ ...p, [record.id]: 'loading' }));

    try {
      const res = await api.get(`/admin/clocks/${record.id}/photo`, { responseType: 'blob' });
      const isPlaceholder = res.headers['x-photo-placeholder'] === 'true';
      const url = isPlaceholder ? 'placeholder' : URL.createObjectURL(res.data);

      // Load extras count
      const extRes = await api.get(`/admin/clocks/${record.id}/photos`);
      const extras = extRes.data.photos || [];

      setThumbs((p) => ({ ...p, [record.id]: { primary: url, extras } }));
    } catch {
      setThumbs((p) => ({ ...p, [record.id]: { primary: 'error', extras: [] } }));
    }
  }, [thumbs]);

  // Load thumbs for visible records
  useEffect(() => {
    records.forEach((r) => loadThumb(r));
  }, [records]); // eslint-disable-line

  // Open lightbox — loads all photos for a record
  async function openLightbox(record) {
    const list = [];

    // Primary
    try {
      const res = await api.get(`/admin/clocks/${record.id}/photo`, { responseType: 'blob' });
      const isPlaceholder = res.headers['x-photo-placeholder'] === 'true';
      list.push({ key: 'primary', url: isPlaceholder ? null : URL.createObjectURL(res.data), isPlaceholder });
    } catch {
      list.push({ key: 'primary', url: null, isPlaceholder: false, error: true });
    }

    // Extras
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
        // Update thumb
        setThumbs((p) => ({
          ...p,
          [record.id]: { ...(p[record.id] || {}), primary: 'placeholder' },
        }));
      } else {
        await api.delete(`/admin/clocks/${record.id}/photos/${current.extraId}`);
        const newList = photoList.filter((p) => p.key !== current.key);
        const newIdx  = Math.min(idx, newList.length - 1);
        setLightbox((p) => ({ ...p, photoList: newList, idx: newIdx }));
        setThumbs((prev) => {
          const t = prev[record.id];
          if (!t || t === 'loading') return prev;
          return {
            ...prev,
            [record.id]: { ...t, extras: t.extras.filter((e) => e.id !== current.extraId) },
          };
        });
      }
      success('Foto apagada.');
    } catch {
      error('Erro ao apagar foto.');
    } finally {
      setDeleting(null);
    }
  }

  async function handleDeleteRecord() {
    if (!lightbox) return;
    const { record } = lightbox;
    if (!window.confirm(
      `Apagar o registro de ponto de ${record.employee_name} (${CLOCK_LABELS[record.clock_type]}) permanentemente?\n\nEsta ação não pode ser desfeita.`
    )) return;
    setDeleting('record');
    try {
      await api.delete(`/admin/clocks/${record.id}`);
      setLightbox(null);
      setThumbs((p) => { const n = { ...p }; delete n[record.id]; return n; });
      // Remove do cache local para sumir da grade sem refetch
      success('Registro apagado.');
    } catch {
      error('Erro ao apagar registro.');
    } finally {
      setDeleting(null);
    }
  }

  const lb = lightbox;
  const current = lb ? lb.photoList[lb.idx] : null;
  const total   = lb ? lb.photoList.length : 0;

  return (
    <div>
      <h1 style={s.title}>Galeria de Fotos</h1>

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

      {/* Grade de fotos */}
      {isLoading ? (
        <p style={{ color: '#64748b', padding: 24 }}>Carregando...</p>
      ) : records.length === 0 ? (
        <p style={{ color: '#64748b', padding: 24 }}>Nenhum registro encontrado.</p>
      ) : (
        <>
          <div style={s.grid}>
            {records.map((record) => {
              const thumb = thumbs[record.id];
              const isLoading = !thumb || thumb === 'loading';
              const isPh = thumb?.primary === 'placeholder' || thumb?.primary === 'error';
              const extraCount = thumb?.extras?.length || 0;

              return (
                <div key={record.id} style={s.card} onClick={() => openLightbox(record)}>
                  {/* Thumbnail */}
                  <div style={s.imgBox}>
                    {isLoading ? (
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

      {/* Lightbox */}
      {lb && current && (
        <div style={overlay} onClick={() => setLightbox(null)}>
          <div style={lbBox} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
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

            {/* Foto */}
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

            {/* Controles */}
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
    </div>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 };
const lbBox   = { background: '#fff', borderRadius: 12, width: '100%', maxWidth: 620, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.3)' };
const lbHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' };
const pageBtn  = { padding: '7px 16px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 16, cursor: 'pointer', color: '#374151' };

const s = {
  title:   { fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 20 },
  filters: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 },
  select:  { padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#374151', background: '#fff', outline: 'none' },
  input:   { padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#374151', outline: 'none' },
  clearBtn:{ padding: '8px 16px', background: '#f1f5f9', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, cursor: 'pointer', color: '#374151' },
  grid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 },
  card:    { background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 0.15s' },
  imgBox:  { position: 'relative', width: '100%', paddingBottom: '75%', background: '#f8fafc' },
  img:     { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
  imgPlaceholder: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#cbd5e1' },
  extraBadge: { position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '2px 7px' },
  info:    { padding: '8px 10px' },
  empName: { fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  meta:    { fontSize: 11, color: '#64748b' },
  pagination: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, padding: '16px 0' },
  pageBtn: { padding: '7px 16px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, cursor: 'pointer', color: '#374151' },
};
