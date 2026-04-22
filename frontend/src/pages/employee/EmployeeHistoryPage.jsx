import { useState, useEffect, useCallback } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import api         from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';

const LABELS = {
  entry: 'Entrada', exit: 'Saída',
  break_start: 'Início intervalo', break_end: 'Fim intervalo',
};

function getTypeColor(type, theme) {
  return { entry: theme.success, break_start: theme.warning, break_end: theme.info, exit: theme.danger }[type] || theme.textMuted;
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

  const groups = groupByDate(records);

  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: theme.accent, textTransform: 'uppercase', marginBottom: 2 }}>Meus registros</p>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: theme.textPrimary, marginBottom: 20 }}>Histórico</h1>

      {loading && records.length === 0 ? (
        <p style={{ textAlign: 'center', color: theme.textMuted, padding: 32 }}>Carregando...</p>
      ) : groups.length === 0 ? (
        <p style={{ textAlign: 'center', color: theme.textMuted, padding: 32 }}>Nenhum registro encontrado.</p>
      ) : (
        <>
          {groups.map((g, gi) => (
            <div key={gi} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, letterSpacing: 1, textTransform: 'uppercase', paddingBottom: 6, marginBottom: 4, borderBottom: `1px solid ${theme.border}` }}>
                {g.label}
              </div>
              {g.records.map((r, ri) => {
                const tz   = r.timezone || 'America/Sao_Paulo';
                const time = formatInTimeZone(new Date(r.clocked_at_utc), tz, 'HH:mm');
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: ri < g.records.length - 1 ? `1px solid ${theme.border}` : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: getTypeColor(r.clock_type, theme), flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: theme.textPrimary, fontWeight: 500 }}>{LABELS[r.clock_type] || r.clock_type}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {!r.is_inside_zone && (
                        <span style={{ background: theme.danger + '22', border: `1px solid ${theme.danger}55`, color: theme.danger, fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>Fora</span>
                      )}
                      <span style={{ fontSize: 13, color: theme.textSecondary, fontVariantNumeric: 'tabular-nums' }}>{time}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {hasMore && (
            <button
              onClick={() => fetchPage(page + 1)}
              disabled={loading}
              style={{ width: '100%', padding: '12px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, color: theme.accent, fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', marginBottom: 8 }}
            >
              {loading ? 'Carregando...' : 'Carregar mais'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
