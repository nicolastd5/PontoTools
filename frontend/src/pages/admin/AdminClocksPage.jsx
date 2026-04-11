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

function PhotoModal({ recordId, observation, onClose }) {
  const [src, setSrc]       = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ok | placeholder | error

  useEffect(() => {
    let objectUrl = null;
    setStatus('loading');
    setSrc(null);

    api.get(`/admin/clocks/${recordId}/photo`, { responseType: 'blob' })
      .then((res) => {
        if (res.headers['x-photo-placeholder'] === 'true') {
          setStatus('placeholder');
          return;
        }
        objectUrl = URL.createObjectURL(res.data);
        setSrc(objectUrl);
        setStatus('ok');
      })
      .catch(() => setStatus('error'));

    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [recordId]);

  return (
    <div style={modal.overlay} onClick={onClose}>
      <div style={modal.box} onClick={(e) => e.stopPropagation()}>
        <div style={modal.header}>
          <span style={modal.title}>Foto do Registro #{recordId}</span>
          <button onClick={onClose} style={modal.closeBtn}>✕</button>
        </div>
        <div style={modal.body}>
          {status === 'loading' && (
            <p style={{ color: '#64748b', padding: 24 }}>Carregando foto...</p>
          )}
          {status === 'ok' && (
            <img src={src} alt="Foto do ponto" style={modal.img} />
          )}
          {status === 'placeholder' && (
            <div style={{ padding: 32, color: '#94a3b8', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
              <p>Foto placeholder — câmera não implementada no app ainda.</p>
            </div>
          )}
          {status === 'error' && (
            <div style={{ padding: 32, color: '#dc2626', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
              <p>Erro ao carregar foto.</p>
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
