import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import PushBanner from '../../components/employee/PushBanner';

function useMyNotifications() {
  return useQuery({
    queryKey: ['my-notifications'],
    queryFn:  () => api.get('/notifications').then((r) => r.data),
    refetchInterval: 30000,
  });
}

export default function EmployeeNotificationsPage() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  const { data, isLoading } = useMyNotifications();
  const notifications = data?.notifications || [];
  const unread        = data?.unread ?? 0;


  const markReadMutation = useMutation({
    mutationFn: (id) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries(['my-notifications']),
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      success('Todas marcadas como lidas.');
      queryClient.invalidateQueries(['my-notifications']);
    },
  });

  function fmtDate(dt) {
    const d = new Date(dt);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1)  return 'agora mesmo';
    if (diffMin < 60) return `há ${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24)   return `há ${diffH}h`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  return (
    <div>
      <div style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={s.title}>Notificações</h1>
          {unread > 0 && (
            <span style={unreadBadge}>{unread}</span>
          )}
        </div>
        {unread > 0 && (
          <button onClick={() => markAllMutation.mutate()} disabled={markAllMutation.isLoading} style={s.outlineBtn}>
            Marcar todas como lidas
          </button>
        )}
      </div>

      <PushBanner />

      {/* List */}
      <div style={s.list}>
        {isLoading ? (
          <p style={s.empty}>Carregando...</p>
        ) : notifications.length === 0 ? (
          <div style={s.emptyCard}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🔔</div>
            <p style={{ color: '#64748b' }}>Nenhuma notificação ainda.</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div key={n.id} style={{ ...s.item, background: n.read ? '#fff' : '#eff6ff', borderLeft: n.read ? '3px solid transparent' : '3px solid #1d4ed8' }}
              onClick={() => !n.read && markReadMutation.mutate(n.id)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: n.read ? 500 : 700, fontSize: 14, color: '#0f172a', marginBottom: 2 }}>{n.title}</div>
                <div style={{ fontSize: 13, color: '#374151' }}>{n.body}</div>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', marginLeft: 12 }}>{fmtDate(n.created_at)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const unreadBadge = { background: '#ef4444', color: '#fff', borderRadius: 20, padding: '2px 8px', fontSize: 12, fontWeight: 700 };

const s = {
  header:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title:      { fontSize: 22, fontWeight: 800, color: '#0f172a' },
  pushBanner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, padding: '12px 16px', marginBottom: 20, gap: 12 },
  pushBtn:    { padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  list:       { display: 'flex', flexDirection: 'column', gap: 0, borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', background: '#fff' },
  item:       { display: 'flex', alignItems: 'flex-start', padding: '14px 16px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' },
  empty:      { padding: 24, color: '#64748b', textAlign: 'center' },
  emptyCard:  { padding: '48px 24px', textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' },
  outlineBtn: { padding: '7px 14px', border: '1.5px solid #1d4ed8', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#1d4ed8', background: '#fff', fontWeight: 600 },
};
