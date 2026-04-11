// mobile/src/screens/NotificationsScreen.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import api from '../services/api';
import TabBar from '../components/TabBar';

type Screen = 'dashboard' | 'history' | 'services' | 'notifications';

interface Notification {
  id: number;
  title: string;
  body: string;
  type: string;
  read: boolean;
  created_at: string;
}

function fmtRelative(isoDate: string): string {
  const diff = (Date.now() - new Date(isoDate).getTime()) / 1000;
  if (diff < 60)    return 'agora';
  if (diff < 3600)  return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  if (diff < 172800) return 'ontem';
  const d = new Date(isoDate);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

export default function NotificationsScreen({
  onNavigate,
  unreadCount = 0,
  onUnreadChange,
}: {
  onNavigate: (s: Screen) => void;
  unreadCount?: number;
  onUnreadChange?: (count: number) => void;
}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]             = useState(false);
  const [refreshing, setRefreshing]       = useState(false);

  const loadNotifications = useCallback(async (reset = false) => {
    if (!reset) setLoading(true);
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications);
      onUnreadChange?.(data.unread);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [onUnreadChange]);

  // Registrar FCM ao entrar na tela
  useEffect(() => {
    loadNotifications(false);
    registerFcm();

    // Ouve notificações com app em foreground
    const unsub = messaging().onMessage(async (remoteMessage) => {
      const title = remoteMessage.notification?.title || 'Aviso';
      const body  = remoteMessage.notification?.body  || '';
      Alert.alert(title, body);
      loadNotifications(false);
    });
    return unsub;
  }, []);

  async function registerFcm() {
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      if (!enabled) return;

      const token = await messaging().getToken();
      const stored = await AsyncStorage.getItem('fcmToken');
      if (token !== stored) {
        await api.post('/notifications/subscribe-fcm', { fcm_token: token });
        await AsyncStorage.setItem('fcmToken', token);
      }
    } catch {
      // Silencia erros de permissão negada
    }
  }

  const markRead = useCallback(async (id: number) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
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

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <TabBar active="notifications" onNavigate={onNavigate} unreadCount={unreadCount} />

      {unreadCount > 0 && (
        <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
          <Text style={styles.markAllText}>Marcar todas como lidas ({unreadCount})</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadNotifications(true); }}
            colors={['#1d4ed8']}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, !item.read && styles.itemUnread]}
            onPress={() => !item.read && markRead(item.id)}
          >
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemBody} numberOfLines={2}>{item.body}</Text>
            </View>
            <View style={styles.itemMeta}>
              <Text style={styles.itemTime}>{fmtRelative(item.created_at)}</Text>
              {!item.read && <View style={styles.dot} />}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? null : (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ color: '#94a3b8', fontSize: 15 }}>Nenhum aviso recebido.</Text>
            </View>
          )
        }
        ListFooterComponent={loading ? <ActivityIndicator style={{ margin: 16 }} color="#1d4ed8" /> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  markAllBtn:   { backgroundColor: '#eff6ff', padding: 12, margin: 12, marginBottom: 0, borderRadius: 10, alignItems: 'center' },
  markAllText:  { color: '#1d4ed8', fontWeight: '700', fontSize: 13 },
  item:         { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  itemUnread:   { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  itemContent:  { flex: 1, marginRight: 8 },
  itemTitle:    { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 3 },
  itemBody:     { fontSize: 13, color: '#64748b', lineHeight: 18 },
  itemMeta:     { alignItems: 'flex-end', gap: 6 },
  itemTime:     { fontSize: 11, color: '#94a3b8' },
  dot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1d4ed8' },
});
