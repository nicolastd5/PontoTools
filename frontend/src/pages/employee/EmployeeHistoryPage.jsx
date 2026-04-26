import { useState, useEffect, useCallback } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import api from '../../services/api';

const LABELS = {
  entry: 'Entrada', exit: 'Saída',
  break_start: 'Início intervalo', break_end: 'Fim intervalo',
};

const TYPE_COLOR = {
  entry:       'var(--color-ok)',
  exit:        'var(--color-danger)',
  break_start: 'var(--color-warn)',
  break_end:   '#0ea5e9',
};

function groupByDate(records) {
  const groups = {};
  records.forEach((r) => {
    const tz      = r.timezone || 'America/Sao_Paulo';
    const dateKey = formatInTimeZone(new Date(r.clocked_at_utc), tz, 'yyyy-MM-dd');
    if (!groups[dateKey]) {
      const todayKey = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
      const label    = dateKey === todayKey
        ? 'HOJE'
        : formatInTimeZone(new Date(r.clocked_at_utc), tz, "dd MMM", { locale: ptBR }).toUpperCase();
      groups[dateKey] = { label, records: [] };
    }
    groups[dateKey].records.push(r);
  });
  return Object.values(groups);
}

export default function EmployeeHistoryPage() {
  const [records, setRecords] = useState([]);
  const [page, setPage]       = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchPage = useCallback(async (pageNum, reset = false) => {
    if (loading && !reset) return;
    setLoading(true);
    try {
      const { data } = await api.get('/clock/history', { params: { page: pageNum, limit: 20 } });
      setRecords((prev) => reset ? data.records : [...prev, ...data.records]);
      setPage(pageNum);
      setHasMore(pageNum < data.pagination.totalPages);
    } catch {}
    finally { setLoading(false); }
  }, [loading]);

  useEffect(() => { fetchPage(1, true); }, []);

  const groups = groupByDate(records);

  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 2 }}>Meus registros</p>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-ink)', marginBottom: 20, letterSpacing: '-0.03em' }}>Histórico</h1>

      {loading && records.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-muted)', padding: 32 }}>Carregando...</p>
      ) : groups.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-muted)', padding: 32 }}>Nenhum registro encontrado.</p>
      ) : (
        <>
          {groups.map((g, gi) => (
            <div key={gi} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-subtle)', letterSpacing: '0.08em', textTransform: 'uppercase', paddingBottom: 6, marginBottom: 4, borderBottom: '1px solid var(--color-line)' }}>
                {g.label}
              </div>
              {g.records.map((r, ri) => {
                const tz   = r.timezone || 'America/Sao_Paulo';
                const time = formatInTimeZone(new Date(r.clocked_at_utc), tz, 'HH:mm');
                const dot  = TYPE_COLOR[r.clock_type] || 'var(--color-muted)';
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: ri < g.records.length - 1 ? '1px solid var(--color-hairline)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: 'var(--color-ink)', fontWeight: 500 }}>{LABELS[r.clock_type] || r.clock_type}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {!r.is_inside_zone && (
                        <span style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-danger)', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>Fora</span>
                      )}
                      <span style={{ fontSize: 13, color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>{time}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {hasMore && (
            <button onClick={() => fetchPage(page + 1)} disabled={loading}
              style={{ width: '100%', padding: '12px', background: 'var(--color-hairline)', border: '1px solid var(--color-line)', borderRadius: 10, color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', marginBottom: 8 }}>
              {loading ? 'Carregando...' : 'Carregar mais'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
