import { useState, useEffect }    from 'react';
import { useQuery }   from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import api            from '../../services/api';
import Table          from '../../components/shared/Table';
import StatusBadge    from '../../components/shared/StatusBadge';

const CLOCK_LABELS = {
  entry: 'Entrada', exit: 'Saída',
  break_start: 'Início intervalo', break_end: 'Fim intervalo',
};

function useClocks(filters, page) {
  return useQuery({
    queryKey: ['admin-clocks', filters, page],
    queryFn:  () => api.get('/admin/clocks', { params: { ...filters, page, limit: 25 } }).then((r) => r.data),
    keepPreviousData: true,
  });
}

function useUnits() {
  return useQuery({ queryKey: ['units'], queryFn: () => api.get('/units').then((r) => r.data.units) });
}

export default function AdminClocksPage() {
  const [filters, setFilters] = useState({ unitId: '', clockType: '', startDate: '', endDate: '' });
  const [page, setPage]       = useState(1);
  const [photoModal, setPhotoModal] = useState(null); // null | { id, observation }

  const { data, isLoading } = useClocks(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')),
    page
  );
  const { data: units = [] } = useUnits();

  function updateFilter(key, val) {
    setFilters((prev) => ({ ...prev, [key]: val }));
    setPage(1);
  }

  const columns = [
    {
      key: 'employee_name', label: 'Funcionário',
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{v}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{row.badge_number}</div>
        </div>
      ),
    },
    {
      key: 'unit_code', label: 'Unidade',
      render: (v) => <span style={chipStyle}>{v}</span>,
    },
    {
      key: 'clock_type', label: 'Tipo',
      render: (v) => CLOCK_LABELS[v] || v,
    },
    {
      key: 'clocked_at_utc', label: 'Horário (local)',
      render: (v, row) => formatInTimeZone(new Date(v), row.timezone || 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm'),
    },
    {
      key: 'is_inside_zone', label: 'Status',
      render: (v) => <StatusBadge isInsideZone={v} />,
    },
    {
      key: 'distance_meters', label: 'Distância',
      render: (v) => <span style={{ color: v > 100 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{Math.round(v)}m</span>,
    },
    {
      key: 'observation', label: 'Observação',
      render: (v) => v
        ? <span style={{ fontSize: 12, color: '#374151', maxWidth: 160, display: 'inline-block' }} title={v}>{v.length > 40 ? v.slice(0, 40) + '…' : v}</span>
        : <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>,
    },
    {
      key: 'photo_path', label: 'Foto',
      render: (v, row) => (
        <button onClick={() => setPhotoModal({ id: row.id, observation: row.observation })} style={photoBtn}>
          Ver foto
        </button>
      ),
    },
  ];

  return (
    <div>
      <h1 style={styles.title}>Registros de Ponto</h1>

      {/* Filtros */}
      <div style={styles.filters}>
        <select value={filters.unitId} onChange={(e) => updateFilter('unitId', e.target.value)} style={styles.select}>
          <option value="">Todas as unidades</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>

        <select value={filters.clockType} onChange={(e) => updateFilter('clockType', e.target.value)} style={styles.select}>
          <option value="">Todos os tipos</option>
          <option value="entry">Entrada</option>
          <option value="exit">Saída</option>
          <option value="break_start">Início intervalo</option>
          <option value="break_end">Fim intervalo</option>
        </select>

        <input
          type="date" value={filters.startDate}
          onChange={(e) => updateFilter('startDate', e.target.value)}
          style={styles.input}
        />
        <input
          type="date" value={filters.endDate}
          onChange={(e) => updateFilter('endDate', e.target.value)}
          style={styles.input}
        />

        <button onClick={() => { setFilters({ unitId: '', clockType: '', startDate: '', endDate: '' }); setPage(1); }} style={styles.clearBtn}>
          Limpar
        </button>
      </div>

      {/* Tabela */}
      <div style={styles.card}>
        <Table
          columns={columns}
          rows={data?.records || []}
          pagination={data?.pagination}
          onPageChange={setPage}
          emptyMessage={isLoading ? 'Carregando...' : 'Nenhum registro encontrado.'}
        />
      </div>

      {/* Modal de foto */}
      {photoModal && (
        <PhotoModal recordId={photoModal.id} observation={photoModal.observation} onClose={() => setPhotoModal(null)} />
      )}
    </div>
  );
}

// Builds a combined list: first the primary photo (id=null), then extras from clock_photos
function PhotoModal({ recordId, observation, onClose }) {
  // photoList: array of { key, url, status }
  // index 0 = primary photo, 1+ = extra photos
  const [photoList, setPhotoList] = useState([{ key: 'primary', url: null, status: 'loading' }]);
  const [idx, setIdx]             = useState(0);

  // Load primary photo
  useEffect(() => {
    let objectUrl = null;
    setIdx(0);
    setPhotoList([{ key: 'primary', url: null, status: 'loading' }]);

    api.get(`/admin/clocks/${recordId}/photo`, { responseType: 'blob' })
      .then((res) => {
        const isPlaceholder = res.headers['x-photo-placeholder'] === 'true';
        if (!isPlaceholder) objectUrl = URL.createObjectURL(res.data);
        setPhotoList((prev) => {
          const next = [...prev];
          next[0] = { key: 'primary', url: objectUrl, status: isPlaceholder ? 'placeholder' : 'ok' };
          return next;
        });
      })
      .catch(() => {
        setPhotoList((prev) => { const n = [...prev]; n[0] = { key: 'primary', url: null, status: 'error' }; return n; });
      });

    // Load extra photos list
    api.get(`/admin/clocks/${recordId}/photos`)
      .then((res) => {
        const extras = res.data.photos || [];
        if (extras.length === 0) return;
        setPhotoList((prev) => [
          ...prev,
          ...extras.map((p) => ({ key: `extra-${p.id}`, extraId: p.id, url: null, status: 'loading' })),
        ]);
        // Load each extra lazily
        extras.forEach((p, i) => {
          let eUrl = null;
          api.get(`/admin/clocks/${recordId}/photos/${p.id}`, { responseType: 'blob' })
            .then((r) => {
              eUrl = URL.createObjectURL(r.data);
              setPhotoList((prev) => {
                const n = [...prev];
                const pos = n.findIndex((x) => x.key === `extra-${p.id}`);
                if (pos !== -1) n[pos] = { ...n[pos], url: eUrl, status: 'ok' };
                return n;
              });
            })
            .catch(() => {
              setPhotoList((prev) => {
                const n = [...prev];
                const pos = n.findIndex((x) => x.key === `extra-${p.id}`);
                if (pos !== -1) n[pos] = { ...n[pos], status: 'error' };
                return n;
              });
            });
        });
      })
      .catch(() => {}); // no extras is fine

    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [recordId]);

  const current = photoList[idx] || photoList[0];
  const total   = photoList.length;

  async function handleDelete() {
    if (!window.confirm('Apagar esta foto permanentemente?')) return;
    try {
      if (current.key === 'primary') {
        await api.delete(`/admin/clocks/${recordId}/photo`);
        setPhotoList((prev) => { const n = [...prev]; n[0] = { ...n[0], url: null, status: 'placeholder' }; return n; });
      } else {
        await api.delete(`/admin/clocks/${recordId}/photos/${current.extraId}`);
        setPhotoList((prev) => prev.filter((p) => p.key !== current.key));
        setIdx((i) => Math.max(0, i - 1));
      }
    } catch {
      alert('Erro ao apagar foto.');
    }
  }

  return (
    <div style={modal.overlay} onClick={onClose}>
      <div style={modal.box} onClick={(e) => e.stopPropagation()}>
        <div style={modal.header}>
          <span style={modal.title}>
            Fotos do Registro #{recordId}
            {total > 1 && <span style={{ fontWeight: 400, fontSize: 13, color: '#64748b', marginLeft: 8 }}>{idx + 1}/{total}</span>}
          </span>
          <button onClick={onClose} style={modal.closeBtn}>✕</button>
        </div>
        <div style={modal.body}>
          {current.status === 'loading' && (
            <p style={{ color: '#64748b', padding: 24 }}>Carregando foto...</p>
          )}
          {current.status === 'ok' && (
            <img src={current.url} alt="Foto do ponto" style={modal.img} />
          )}
          {current.status === 'placeholder' && (
            <div style={{ padding: 32, color: '#94a3b8', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
              <p>Foto removida ou não disponível.</p>
            </div>
          )}
          {current.status === 'error' && (
            <div style={{ padding: 32, color: '#dc2626', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
              <p>Erro ao carregar foto.</p>
            </div>
          )}

          {/* Navigation arrows */}
          {total > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 14 }}>
              <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}
                style={{ ...navBtn, opacity: idx === 0 ? 0.3 : 1 }}>◀</button>
              <span style={{ fontSize: 13, color: '#64748b', alignSelf: 'center' }}>{idx + 1} / {total}</span>
              <button onClick={() => setIdx((i) => Math.min(total - 1, i + 1))} disabled={idx === total - 1}
                style={{ ...navBtn, opacity: idx === total - 1 ? 0.3 : 1 }}>▶</button>
            </div>
          )}

          {/* Botão deletar — só quando há foto real */}
          {current.status === 'ok' && (
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
              <button onClick={handleDelete}
                style={{ padding: '7px 18px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}>
                🗑 Apagar foto
              </button>
            </div>
          )}

          {observation && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'left' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Observação</p>
              <p style={{ fontSize: 14, color: '#0f172a' }}>{observation}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const chipStyle = {
  padding: '2px 8px', background: '#eff6ff',
  color: '#1d4ed8', borderRadius: 4, fontSize: 11, fontWeight: 700,
};
const photoBtn = {
  padding: '4px 10px', background: '#f1f5f9',
  border: '1px solid #e2e8f0', borderRadius: 6,
  fontSize: 12, cursor: 'pointer', color: '#374151',
};
const navBtn = {
  padding: '6px 16px', background: '#f1f5f9',
  border: '1px solid #e2e8f0', borderRadius: 6,
  fontSize: 16, cursor: 'pointer', color: '#374151',
};
const modal = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  box: {
    background: '#fff', borderRadius: 12,
    width: '100%', maxWidth: 560,
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
  },
  title: { fontWeight: 700, fontSize: 15, color: '#0f172a' },
  closeBtn: {
    background: 'none', border: 'none',
    fontSize: 18, cursor: 'pointer', color: '#64748b',
  },
  body: { padding: 20, textAlign: 'center' },
  img: { maxWidth: '100%', maxHeight: 400, borderRadius: 8, objectFit: 'cover' },
};

const styles = {
  title:   { fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 20 },
  filters: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 },
  select: {
    padding: '8px 12px', border: '1.5px solid #e2e8f0',
    borderRadius: 8, fontSize: 14, color: '#374151',
    background: '#fff', outline: 'none', cursor: 'pointer',
  },
  input: {
    padding: '8px 12px', border: '1.5px solid #e2e8f0',
    borderRadius: 8, fontSize: 14, color: '#374151', outline: 'none',
  },
  clearBtn: {
    padding: '8px 16px', background: '#f1f5f9',
    border: '1.5px solid #e2e8f0', borderRadius: 8,
    fontSize: 14, cursor: 'pointer', color: '#374151',
  },
  card: { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' },
};
