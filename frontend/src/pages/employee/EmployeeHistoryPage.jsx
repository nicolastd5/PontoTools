import { useState }  from 'react';
import { useQuery }  from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import api           from '../../services/api';
import StatusBadge   from '../../components/shared/StatusBadge';

const LABELS = {
  entry: 'Entrada', exit: 'Saída',
  break_start: 'Início intervalo', break_end: 'Fim intervalo',
};

export default function EmployeeHistoryPage() {
  const [page, setPage]           = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['clock-history', page, startDate, endDate],
    queryFn:  () => api.get('/clock/history', {
      params: { page, limit: 20, startDate: startDate || undefined, endDate: endDate || undefined },
    }).then((r) => r.data),
    keepPreviousData: true,
  });

  const records = data?.records || [];

  return (
    <div>
      <h2 style={styles.title}>Meu Histórico</h2>

      {/* Filtro de período */}
      <div style={styles.filters}>
        <input
          type="date" value={startDate}
          onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
          style={styles.input}
        />
        <span style={{ color: '#94a3b8', fontSize: 13 }}>até</span>
        <input
          type="date" value={endDate}
          onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
          style={styles.input}
        />
        {(startDate || endDate) && (
          <button onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }} style={styles.clearBtn}>
            ✕
          </button>
        )}
      </div>

      {isLoading ? (
        <div style={styles.loading}>Carregando...</div>
      ) : records.length === 0 ? (
        <div style={styles.empty}>Nenhum registro encontrado.</div>
      ) : (
        <>
          <div style={styles.list}>
            {records.map((r) => (
              <div key={r.id} style={styles.card}>
                <div style={styles.cardLeft}>
                  <div style={styles.clockType}>{LABELS[r.clock_type] || r.clock_type}</div>
                  <div style={styles.date}>
                    {formatInTimeZone(
                      new Date(r.clocked_at_utc),
                      r.timezone || 'America/Sao_Paulo',
                      'dd/MM/yyyy'
                    )}
                  </div>
                </div>
                <div style={styles.cardCenter}>
                  <div style={styles.time}>
                    {formatInTimeZone(
                      new Date(r.clocked_at_utc),
                      r.timezone || 'America/Sao_Paulo',
                      'HH:mm'
                    )}
                  </div>
                  <div style={styles.distance}>
                    {Math.round(r.distance_meters)}m
                  </div>
                </div>
                <div style={styles.cardRight}>
                  <StatusBadge isInsideZone={r.is_inside_zone} />
                </div>
              </div>
            ))}
          </div>

          {/* Paginação */}
          {data?.pagination?.totalPages > 1 && (
            <div style={styles.pagination}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                style={{ ...styles.pageBtn, opacity: page <= 1 ? 0.4 : 1 }}
              >← Anterior</button>
              <span style={styles.pageInfo}>
                {page} / {data.pagination.totalPages}
              </span>
              <button
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                style={{ ...styles.pageBtn, opacity: page >= data.pagination.totalPages ? 0.4 : 1 }}
              >Próxima →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  title:   { fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 16 },
  filters: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  input: {
    padding:      '8px 10px',
    border:       '1.5px solid #e2e8f0',
    borderRadius: 8, fontSize: 13, color: '#374151', outline: 'none',
    flex:         1, minWidth: 130,
  },
  clearBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#94a3b8', fontSize: 16, padding: '4px',
  },
  loading: { textAlign: 'center', padding: 32, color: '#94a3b8' },
  empty:   { textAlign: 'center', padding: 32, color: '#94a3b8' },
  list:    { display: 'flex', flexDirection: 'column', gap: 8 },
  card: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    background:     '#fff',
    borderRadius:   10,
    padding:        '12px 14px',
    border:         '1px solid #e2e8f0',
  },
  cardLeft:   { flex: 1 },
  clockType:  { fontSize: 14, fontWeight: 600, color: '#0f172a' },
  date:       { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  cardCenter: { textAlign: 'center', padding: '0 12px' },
  time:       { fontSize: 18, fontWeight: 800, color: '#1d4ed8' },
  distance:   { fontSize: 11, color: '#94a3b8' },
  cardRight:  {},
  pagination: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            16,
    marginTop:      16,
  },
  pageBtn: {
    padding: '7px 14px', background: '#fff',
    border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: 13, cursor: 'pointer', color: '#374151',
  },
  pageInfo: { fontSize: 13, color: '#64748b' },
};
