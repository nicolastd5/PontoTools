import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList,
  ActivityIndicator, RefreshControl, SafeAreaView,
} from 'react-native';
import { formatInTimeZone } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import api from '../services/api';
import TabBar from '../components/TabBar';
import { useTheme } from '../contexts/ThemeContext';

type Screen = 'dashboard' | 'history' | 'services' | 'notifications' | 'profile';

const LABELS: Record<string, string> = {
  entry: 'Entrada', exit: 'Saída',
  break_start: 'Início intervalo', break_end: 'Fim intervalo',
};

interface ClockRecord {
  id: number;
  clock_type: string;
  clocked_at_utc: string;
  timezone: string;
  is_inside_zone: boolean;
  unit_name: string;
}

interface DateGroup { label: string; records: ClockRecord[]; }

function groupByDate(records: ClockRecord[]): DateGroup[] {
  const groups: Record<string, DateGroup> = {};
  records.forEach((r) => {
    const tz      = r.timezone || 'America/Sao_Paulo';
    const dateKey = formatInTimeZone(new Date(r.clocked_at_utc), tz, 'yyyy-MM-dd');
    if (!groups[dateKey]) {
      const todayKey = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
      const label    = dateKey === todayKey
        ? 'HOJE'
        : formatInTimeZone(new Date(r.clocked_at_utc), tz, 'dd MMM', { locale: ptBR }).toUpperCase();
      groups[dateKey] = { label, records: [] };
    }
    groups[dateKey].records.push(r);
  });
  return Object.values(groups);
}

export default function HistoryScreen({
  onNavigate, unreadCount = 0, servicesOnly = false,
}: {
  onNavigate: (s: Screen) => void;
  unreadCount?: number;
  servicesOnly?: boolean;
}) {
  const { theme }             = useTheme();
  const [records, setRecords] = useState<ClockRecord[]>([]);
  const [page, setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const DOT: Record<string, string> = {
    entry: theme.success, break_start: theme.warning, break_end: theme.info, exit: theme.danger,
  };

  const fetchRecords = useCallback(async (pageNum: number, reset = false) => {
    if (loading && !reset) return;
    setLoading(true);
    try {
      const { data } = await api.get('/clock/history', { params: { page: pageNum, limit: 20 } });
      setRecords((prev) => reset ? data.records : [...prev, ...data.records]);
      setTotalPages(data.pagination.totalPages);
      setPage(pageNum);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [loading]);

  useEffect(() => { fetchRecords(1, true); }, []);

  const groups = groupByDate(records);

  type ListItem = { type: 'header'; label: string } | { type: 'record'; record: ClockRecord };
  const flatItems: ListItem[] = groups.flatMap((g) => [
    { type: 'header' as const, label: g.label },
    ...g.records.map((r) => ({ type: 'record' as const, record: r })),
  ]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <FlatList
        data={flatItems}
        keyExtractor={(item, i) => item.type === 'header' ? `h-${i}` : String(item.record.id)}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRecords(1, true); }} colors={[theme.accent]} />
        }
        onEndReached={() => { if (page < totalPages && !loading) fetchRecords(page + 1); }}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: theme.accent, textTransform: 'uppercase', marginBottom: 2 }}>Meus registros</Text>
            <Text style={{ fontSize: 24, fontWeight: '800', color: theme.textPrimary, marginBottom: 20 }}>Histórico</Text>
          </>
        }
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return (
              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textMuted, letterSpacing: 1, textTransform: 'uppercase', paddingBottom: 6, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: theme.border, marginTop: 16 }}>
                {item.label}
              </Text>
            );
          }
          const r    = item.record;
          const tz   = r.timezone || 'America/Sao_Paulo';
          const time = formatInTimeZone(new Date(r.clocked_at_utc), tz, 'HH:mm');
          return (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: DOT[r.clock_type] || theme.textMuted }} />
                <Text style={{ fontSize: 13, color: theme.textPrimary, fontWeight: '500' }}>{LABELS[r.clock_type] ?? r.clock_type}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {!r.is_inside_zone && (
                  <View style={{ backgroundColor: theme.danger + '22', borderWidth: 1, borderColor: theme.danger + '55', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                    <Text style={{ color: theme.danger, fontSize: 9, fontWeight: '700' }}>Fora</Text>
                  </View>
                )}
                <Text style={{ fontSize: 13, color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>{time}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={loading ? null : (
          <Text style={{ textAlign: 'center', color: theme.textMuted, fontSize: 15, marginTop: 60 }}>Nenhum registro encontrado.</Text>
        )}
        ListFooterComponent={loading ? <ActivityIndicator style={{ margin: 16 }} color={theme.accent} /> : null}
      />
      <TabBar active="history" onNavigate={onNavigate} unreadCount={unreadCount} servicesOnly={servicesOnly} />
    </SafeAreaView>
  );
}
