import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import api from '../services/api';
import TabBar from '../components/TabBar';
import { useTheme } from '../contexts/ThemeContext';

type Screen = 'dashboard' | 'history' | 'services' | 'notifications' | 'profile';

interface Notification {
  id: number; title: string; body: string;
  type: string; read: boolean; created_at: string;
}

function fmtRelative(isoDate: string): string {
  const diff = (Date.now() - new Date(isoDate).getTime()) / 1000;
  if (diff < 60)     return 'agora';
  if (diff < 3600)   return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400)  return `há ${Math.floor(diff / 3600)}h`;
  if (diff < 172800) return 'ontem';
  const d = new Date(isoDate);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

const POLL_INTERVAL = 30_000;

export default function NotificationsScreen({
  onNavigate, unreadCount = 0, onUnreadChange, servicesOnly = false,
}: {
  onNavigate: (s: Screen) => void;
  unreadCount?: number;
  onUnreadChange?: (count: number) => void;
  servicesOnly?: boolean;
}) {
  const { theme }                              = useTheme();
  const [notifications, setNotifications]     = useState<Notification[]>([]);
  const [loading, setLoading]                 = useState(false);
  const [refreshing, setRefreshing]           = useState(false);
  const prevUnreadRef                         = useRef<number>(unreadCount);

  const loadNotifications = useCallback(async (reset = false) => {
    if (!reset) setLoading(true);
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications);
      const newUnread: number = data.unread;
      if (newUnread > prevUnreadRef.current) {
        const newest = data.notifications.find((n: Notification) => !n.read);
        if (newest) Alert.alert(newest.title, newest.body);
      }
      prevUnreadRef.current = newUnread;
      onUnreadChange?.(newUnread);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [onUnreadChange]);

  useEffect(() => {
    loadNotifications(false);
    const timer = setInterval(() => loadNotifications(false), POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [loadNotifications]);

  const markRead = useCallback(async (id: number) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      onUnreadChange?.(Math.max(0, unreadCount - 1));
    } catch {}
  }, [unreadCount, onUnreadChange]);

  const markAllRead = useCallback(async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      onUnreadChange?.(0);
    } catch {}
  }, [onUnreadChange]);

  const deleteRead = useCallback(async () => {
    Alert.alert(
      'Excluir notificações lidas',
      'Deseja remover todas as notificações já lidas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('/notifications/read');
              setNotifications((prev) => prev.filter((n) => !n.read));
            } catch {
              Alert.alert('Erro', 'Não foi possível excluir as notificações.');
            }
          },
        },
      ],
    );
  }, []);

  const TYPE_ICON: Record<string, { icon: string; bg: string }> = {
    service_assigned: { icon: '🔧', bg: theme.accent + '33' },
    service_delay:    { icon: '⚠️', bg: theme.warning + '33' },
    service_problem:  { icon: '❗', bg: theme.danger + '26' },
    default:          { icon: '📢', bg: theme.textMuted + '26' },
  };

  const hasRead = notifications.some((n) => n.read);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {(unreadCount > 0 || hasRead) && (
        <View style={{ flexDirection: 'row', margin: 12, marginBottom: 0, gap: 8 }}>
          {unreadCount > 0 && (
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: theme.accent + '18', borderWidth: 1, borderColor: theme.accent + '44', borderRadius: 10, padding: 12, alignItems: 'center' }}
              onPress={markAllRead}>
              <Text style={{ color: theme.accent, fontWeight: '700', fontSize: 13 }}>Marcar todas como lidas</Text>
            </TouchableOpacity>
          )}
          {hasRead && (
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: theme.danger + '18', borderWidth: 1, borderColor: theme.danger + '44', borderRadius: 10, padding: 12, alignItems: 'center' }}
              onPress={deleteRead}>
              <Text style={{ color: theme.danger, fontWeight: '700', fontSize: 13 }}>Excluir lidas</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, backgroundColor: theme.bg }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadNotifications(true); }} colors={[theme.accent]} />
        }
        ListHeaderComponent={
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <View>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: theme.accent, textTransform: 'uppercase', marginBottom: 2 }}>Avisos</Text>
              <Text style={{ fontSize: 24, fontWeight: '800', color: theme.textPrimary }}>Notificações</Text>
            </View>
            {unreadCount > 0 && (
              <View style={{ backgroundColor: theme.success, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{unreadCount} nova{unreadCount > 1 ? 's' : ''}</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const { icon, bg } = TYPE_ICON[item.type] || TYPE_ICON.default;
          return (
            <TouchableOpacity
              style={{ flexDirection: 'row', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: theme.border }}
              onPress={() => !item.read && markRead(item.id)}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: bg, justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                <Text style={{ fontSize: 16 }}>{icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: item.read ? '500' : '700', color: theme.textPrimary, marginBottom: 2 }}>
                  {item.title}{!item.read && <Text style={{ color: theme.accent }}> •</Text>}
                </Text>
                <Text style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 17, marginBottom: 3 }} numberOfLines={2}>{item.body}</Text>
                <Text style={{ fontSize: 10, color: theme.textMuted }}>{fmtRelative(item.created_at)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={loading ? null : (
          <Text style={{ textAlign: 'center', color: theme.textMuted, fontSize: 15, marginTop: 60 }}>Nenhum aviso recebido.</Text>
        )}
        ListFooterComponent={loading ? <ActivityIndicator style={{ margin: 16 }} color={theme.accent} /> : null}
      />
      <TabBar active="notifications" onNavigate={onNavigate} unreadCount={unreadCount} servicesOnly={servicesOnly} />
    </View>
  );
}
