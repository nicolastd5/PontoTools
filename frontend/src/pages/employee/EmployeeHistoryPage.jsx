import { useState, useEffect, useCallback } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import api         from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import usePullToRefresh from '../../hooks/usePullToRefresh';
import PullToRefreshIndicator from '../../components/shared/PullToRefreshIndicator';

const LABELS = {
  entry: 'Entrada', exit: 'Saída',
  break_start: 'Início intervalo', break_end: 'Fim intervalo',
};

function getTypeColor(type, theme) {
  return { entry: theme.ok, break_start: theme.warn, break_end: theme.info, exit: theme.danger }[type] || theme.subtle;
}

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
  const { theme }             = useTheme();
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

  const handleRefresh = useCallback(() => fetchPage(1, true), []);
  const { containerRef, pullY, refreshing: ptrRefreshing } = usePullToRefresh(handleRefresh);

  const groups = groupByDate(records);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <PullToRefreshIndicator pullY={pullY} refreshing={ptrRefreshing} />
      <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.textPrimary, marginBottom: 16 }}>Histórico</h1>

      {loading && records.length === 0 ? (
        <p style={{ textAlign: 'center', color: theme.muted, padding: 32 }}>Carregando...</p>
      ) : groups.length === 0 ? (
        <div style={{ background: theme.card, border: `1px dashed ${theme.line}`, borderRadius: 14, padding: '56px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: theme.muted }}>Nenhum registro encontrado.</div>
        </div>
      ) : (
        <>
          {groups.map((g, gi) => (
            <div key={gi} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: theme.subtle, letterSpacing: '0.08em', textTransform: 'uppercase', paddingBottom: 6, marginBottom: 4, borderBottom: `1px solid ${theme.hairline}` }}>
                {g.label}
              </div>
              <div style={{ background: theme.card, borderRadius: 14, border: `1px solid ${theme.line}`, overflow: 'hidden' }}>
                {g.records.map((r, ri) => {
                  const tz   = r.timezone || 'America/Sao_Paulo';
                  const time = formatInTimeZone(new Date(r.clocked_at_utc), tz, 'HH:mm');
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: ri < g.records.length - 1 ? `1px solid ${theme.hairline}` : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: getTypeColor(r.clock_type, theme), flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: theme.ink, fontWeight: 500 }}>{LABELS[r.clock_type] || r.clock_type}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {!r.is_inside_zone && (
                          <span style={{ background: theme.dangerSoft, border: `1px solid ${theme.danger}55`, color: theme.danger, fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, letterSpacing: '0.04em' }}>Fora</span>
                        )}
                        <span style={{ fontSize: 13, color: theme.muted, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>{time}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {hasMore && (
            <button
              onClick={() => fetchPage(page + 1)}
              disabled={loading}
              style={{ width: '100%', padding: '12px', background: theme.card, border: `1px solid ${theme.line}`, borderRadius: 10, color: theme.primary, fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', marginBottom: 8 }}
            >
              {loading ? 'Carregando...' : 'Carregar mais'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
