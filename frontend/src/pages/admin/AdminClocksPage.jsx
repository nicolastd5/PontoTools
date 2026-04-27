import { useState, useEffect }    from 'react';
import { useQuery }   from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { formatInTimeZone } from 'date-fns-tz';
import api            from '../../services/api';
import Table          from '../../components/shared/Table';

const CLOCK_LABELS = {
  entry: 'Entrada', exit: 'Saída',
  break_start: 'Início intervalo', break_end: 'Fim intervalo',
};

const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const ICONS = {
  export:  'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  image:   'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  x:       'M18 6L6 18M6 6l12 12',
  arrow_l: 'M15 18l-6-6 6-6',
  arrow_r: 'M9 18l6-6-6-6',
  trash:   'M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  filter:  'M22 3H2l8 9.46V19l4 2V12.46L22 3',
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

const EMPTY_FILTERS = { unitId: '', clockType: '', startDate: '', endDate: '' };

export default function AdminClocksPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage]       = useState(1);
  const [photoModal, setPhotoModal] = useState(null);

  const { data, isLoading } = useClocks(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')),
    page
  );
  const { data: units = [] } = useUnits();

  function updateFilter(key, val) {
    setFilters((prev) => ({ ...prev, [key]: val }));
    setPage(1);
  }

  const hasFilter   = Object.values(filters).some(Boolean);
  const totalCount  = data?.pagination?.total ?? null;

  const columns = [
    {
      key: 'employee_name', label: 'Funcionário',
      render: (v, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <InitialsAvatar name={v} index={row.id} size={32} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{v}</div>
            <div style={{ fontSize: 11, color: 'var(--color-subtle)' }}>{row.badge_number}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'unit_code', label: 'Unidade',
      render: (v) => (
        <span style={{
          padding: '2px 8px', background: 'var(--color-surface)',
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--border-default)',
          fontSize: 11, fontWeight: 600, color: 'var(--color-muted)',
        }}>{v}</span>
      ),
    },
    {
      key: 'clock_type', label: 'Tipo',
      render: (v) => <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{CLOCK_LABELS[v] || v}</span>,
    },
    {
      key: 'clocked_at_utc', label: 'Horário',
      render: (v, row) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {formatInTimeZone(new Date(v), row.timezone || 'America/Sao_Paulo', 'dd/MM HH:mm')}
        </span>
      ),
    },
    {
      key: 'is_inside_zone', label: 'Status',
      render: (v) => (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 8px', borderRadius: 'var(--radius-full)',
          fontSize: 11, fontWeight: 600,
          background: v ? 'var(--color-ok-soft)'     : 'var(--color-danger-soft)',
          color:      v ? 'var(--color-ok)'           : 'var(--color-danger)',
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
            background: v ? 'var(--color-ok)' : 'var(--color-danger)',
          }} />
          {v ? 'Dentro' : 'Fora'}
        </span>
      ),
    },
    {
      key: 'distance_meters', label: 'Distância',
      render: (v) => (
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
          color: v > 100 ? 'var(--color-danger)' : 'var(--color-ok)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {Math.round(v)}m
        </span>
      ),
    },
    {
      key: 'observation', label: 'Observação',
      render: (v) => v
        ? <span style={{ fontSize: 12, color: 'var(--color-muted)', maxWidth: 160, display: 'inline-block' }} title={v}>{v.length > 40 ? v.slice(0, 40) + '…' : v}</span>
        : <span style={{ color: 'var(--color-line)', fontSize: 13 }}>—</span>,
    },
    {
      key: 'photo_path', label: 'Foto',
      render: (v, row) => (
        <button
          onClick={() => setPhotoModal({ id: row.id, observation: row.observation })}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-default)',
            background: 'transparent', color: 'var(--color-muted)',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--color-muted)'; }}
        >
          <Icon d={ICONS.image} size={13} />
          Ver
        </button>
      ),
    },
  ];

  return (
    <div>
      {/* Cabeçalho */}
      <div style={st.header}>
        <div>
          <h1 style={st.title}>Registros de Ponto</h1>
          {totalCount !== null && (
            <p style={st.subtitle}>{totalCount.toLocaleString('pt-BR')} batidas</p>
          )}
        </div>
        <button
          onClick={() => navigate('/admin/export')}
          style={st.exportBtn}
        >
          <Icon d={ICONS.export} size={15} />
          Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div style={st.filterBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-subtle)', flexShrink: 0 }}>
          <Icon d={ICONS.filter} size={13} />
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Filtros</span>
        </div>

        <select value={filters.unitId} onChange={(e) => updateFilter('unitId', e.target.value)} style={st.select}>
          <option value="">Todas as unidades</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>

        <select value={filters.clockType} onChange={(e) => updateFilter('clockType', e.target.value)} style={st.select}>
          <option value="">Todos os tipos</option>
          <option value="entry">Entrada</option>
          <option value="exit">Saída</option>
          <option value="break_start">Início intervalo</option>
          <option value="break_end">Fim intervalo</option>
        </select>

        <input type="date" value={filters.startDate} onChange={(e) => updateFilter('startDate', e.target.value)} style={st.input} />
        <input type="date" value={filters.endDate}   onChange={(e) => updateFilter('endDate',   e.target.value)} style={st.input} />

        {hasFilter && (
          <button
            onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }}
            style={st.clearBtn}
          >
            <Icon d={ICONS.x} size={13} />
            Limpar
          </button>
        )}
      </div>

      {/* Tabela */}
      <div style={st.card}>
        <Table
          columns={columns}
          rows={data?.records || []}
          pagination={data?.pagination}
          onPageChange={setPage}
          emptyMessage={isLoading ? 'Carregando...' : 'Nenhum registro encontrado.'}
        />
      </div>

      {photoModal && (
        <PhotoModal
          recordId={photoModal.id}
          observation={photoModal.observation}
          onClose={() => setPhotoModal(null)}
        />
      )}
    </div>
  );
}

/* ── Avatar de iniciais com gradiente ── */
const GRADIENTS = [
  'linear-gradient(135deg, #4f46e5, #8b5cf6)',
  'linear-gradient(135deg, #0ea5e9, #4f46e5)',
  'linear-gradient(135deg, #10b981, #0ea5e9)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #8b5cf6, #ec4899)',
];
function InitialsAvatar({ name = '', index = 0, size = 32 }) {
  const initials = name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const grad     = GRADIENTS[index % GRADIENTS.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.38,
    }}>
      {initials}
    </div>
  );
}

/* ── Modal de foto ── */
function PhotoModal({ recordId, observation, onClose }) {
  const [photoList, setPhotoList] = useState([{ key: 'primary', url: null, status: 'loading' }]);
  const [idx, setIdx]             = useState(0);

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
        setPhotoList((prev) => { const n = [...prev]; n[0] = { ...n[0], status: 'error' }; return n; });
      });

    api.get(`/admin/clocks/${recordId}/photos`)
      .then((res) => {
        const extras = res.data.photos || [];
        if (!extras.length) return;
        setPhotoList((prev) => [
          ...prev,
          ...extras.map((p) => ({ key: `extra-${p.id}`, extraId: p.id, url: null, status: 'loading' })),
        ]);
        extras.forEach((p) => {
          api.get(`/admin/clocks/${recordId}/photos/${p.id}`, { responseType: 'blob' })
            .then((r) => {
              const eUrl = URL.createObjectURL(r.data);
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
      .catch(() => {});

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
            Fotos #{recordId}
            {total > 1 && <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--color-subtle)', marginLeft: 8 }}>{idx + 1}/{total}</span>}
          </span>
          <button onClick={onClose} style={modal.closeBtn}>
            <Icon d={ICONS.x} size={16} />
          </button>
        </div>

        <div style={modal.body}>
          {current.status === 'loading' && (
            <div style={{ padding: 40, color: 'var(--color-muted)', textAlign: 'center', fontSize: 13 }}>Carregando...</div>
          )}
          {current.status === 'ok' && (
            <img src={current.url} alt="Foto do ponto" style={modal.img} />
          )}
          {current.status === 'placeholder' && (
            <div style={{ padding: 40, color: 'var(--color-subtle)', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.4 }}>📷</div>
              <p style={{ fontSize: 13 }}>Foto removida ou não disponível.</p>
            </div>
          )}
          {current.status === 'error' && (
            <div style={{ padding: 40, color: 'var(--color-danger)', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.6 }}>⚠️</div>
              <p style={{ fontSize: 13 }}>Erro ao carregar foto.</p>
            </div>
          )}

          {total > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 14 }}>
              <button
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                disabled={idx === 0}
                style={{ ...modal.navBtn, opacity: idx === 0 ? 0.3 : 1 }}
              >
                <Icon d={ICONS.arrow_l} size={16} />
              </button>
              <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>{idx + 1}/{total}</span>
              <button
                onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
                disabled={idx === total - 1}
                style={{ ...modal.navBtn, opacity: idx === total - 1 ? 0.3 : 1 }}
              >
                <Icon d={ICONS.arrow_r} size={16} />
              </button>
            </div>
          )}

          {current.status === 'ok' && (
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
              <button onClick={handleDelete} style={modal.deleteBtn}>
                <Icon d={ICONS.trash} size={13} />
                Apagar foto
              </button>
            </div>
          )}

          {observation && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--color-hairline)', borderRadius: 8, textAlign: 'left' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Observação</p>
              <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>{observation}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Estilos ── */
const st = {
  header:    { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
  title:     { fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em' },
  subtitle:  { fontSize: 12, color: 'var(--color-muted)', marginTop: 2 },
  exportBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '8px 14px', background: 'var(--color-primary)',
    color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
    transition: 'opacity 0.15s',
  },
  filterBar: {
    display: 'flex', alignItems: 'center', gap: 8,
    flexWrap: 'wrap', marginBottom: 16,
    padding: '10px 14px', background: 'var(--bg-card)',
    borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)',
  },
  select: {
    padding: '6px 10px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
    fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-card)',
    cursor: 'pointer', outline: 'none', fontFamily: 'var(--font-sans)',
  },
  input: {
    padding: '6px 10px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
    fontSize: 13, color: 'var(--text-primary)', outline: 'none',
    background: 'var(--bg-card)', fontFamily: 'var(--font-sans)',
  },
  clearBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '6px 10px', background: 'var(--color-hairline)',
    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
    fontSize: 12, cursor: 'pointer', color: 'var(--color-muted)',
    fontFamily: 'var(--font-sans)', fontWeight: 500, transition: 'all 0.15s',
  },
  card: { background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-default)', overflow: 'hidden' },
};

const modal = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(9,9,11,0.7)',
    backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  box: {
    background: 'var(--bg-card)', borderRadius: 16,
    width: '100%', maxWidth: 520,
    overflow: 'hidden', border: '1px solid var(--border-default)',
    boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px', borderBottom: '1px solid var(--color-hairline)',
  },
  title: { fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' },
  closeBtn: {
    width: 28, height: 28, background: 'var(--color-hairline)',
    border: 'none', borderRadius: 6, cursor: 'pointer',
    color: 'var(--color-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  body:    { padding: 18, textAlign: 'center' },
  img:     { maxWidth: '100%', maxHeight: 380, borderRadius: 10, objectFit: 'cover' },
  navBtn: {
    width: 32, height: 32, background: 'var(--color-hairline)',
    border: '1px solid var(--border-default)', borderRadius: 8,
    cursor: 'pointer', color: 'var(--color-muted)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  deleteBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 14px', background: 'var(--color-danger-soft)',
    border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8,
    fontSize: 12, fontWeight: 600, color: 'var(--color-danger)', cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
};
