import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, RefreshControl, SafeAreaView,
} from 'react-native';
import { formatInTimeZone } from 'date-fns-tz';
import api from '../services/api';
import TabBar from '../components/TabBar';

type Screen = 'dashboard' | 'history' | 'services' | 'notifications';

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

export default function HistoryScreen({
  onNavigate,
  unreadCount = 0,
  servicesOnly = false,
}: {
  onNavigate: (s: Screen) => void;
  unreadCount?: number;
  servicesOnly?: boolean;
}) {
  const [records, setRecords]       = useState<ClockRecord[]>([]);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <TabBar active="history" onNavigate={onNavigate} unreadCount={unreadCount} servicesOnly={servicesOnly} />

      <FlatList
        data={records}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRecords(1, true); }} colors={['#1d4ed8']} />}
        onEndReached={() => { if (page < totalPages && !loading) fetchRecords(page + 1); }}
        onEndReachedThreshold={0.3}
        renderItem={({ item }) => {
          const tz   = item.timezone || 'America/Sao_Paulo';
          const date = formatInTimeZone(new Date(item.clocked_at_utc), tz, 'dd/MM/yyyy');
          const time = formatInTimeZone(new Date(item.clocked_at_utc), tz, 'HH:mm');
          return (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowType}>{LABELS[item.clock_type] ?? item.clock_type}</Text>
                <Text style={styles.rowUnit}>{item.unit_name}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.rowDate}>{date}</Text>
                <Text style={styles.rowTime}>{time}</Text>
                <View style={[styles.dot, { backgroundColor: item.is_inside_zone ? '#16a34a' : '#dc2626' }]} />
              </View>
            </View>
          );
        }}
        ListEmptyComponent={loading ? null : <View style={{ alignItems: 'center', marginTop: 60 }}><Text style={{ color: '#94a3b8', fontSize: 15 }}>Nenhum registro encontrado.</Text></View>}
        ListFooterComponent={loading ? <ActivityIndicator style={{ margin: 16 }} color="#1d4ed8" /> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row:           { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowType:       { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  rowUnit:       { fontSize: 12, color: '#64748b', marginTop: 2 },
  rowDate:       { fontSize: 12, color: '#64748b' },
  rowTime:       { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginVertical: 2 },
  dot:           { width: 8, height: 8, borderRadius: 4 },
});
