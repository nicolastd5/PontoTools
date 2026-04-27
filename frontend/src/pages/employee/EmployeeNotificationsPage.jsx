import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../contexts/ThemeContext';

const FIREBASE_VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

const TYPE_ICON = {
  service_assigned: { icon: '🔧', bg: null },
  service_delay:    { icon: '⚠️', bg: null },
  service_problem:  { icon: '❗', bg: null },
  default:          { icon: '📢', bg: null },
};

function getIcon(type) {
  return TYPE_ICON[type] || TYPE_ICON.default;
}

function fmtDate(dt) {
  const diff = (Date.now() - new Date(dt).getTime()) / 1000;
  if (diff < 60) return 'agora mesmo';
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  const d = new Date(dt);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function EmployeeNotificationsPage() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['my-notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data),
    refetchInterval: 30000,
  });

  const notifications = data?.notifications || [];
  const unread = data?.unread ?? 0;

  const [pushSupported, setPushSupported] = useState(false);
  const [pushGranted, setPushGranted] = useState(false);
  const [pushDenied, setPushDenied] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator && !!FIREBASE_VAPID_KEY;
    setPushSupported(supported);
    if (supported) {
      setPushGranted(Notification.permission === 'granted');
      setPushDenied(Notification.permission === 'denied');
    }
  }, []);

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

  const deleteReadMutation = useMutation({
    mutationFn: () => api.delete('/notifications/read'),
    onSuccess: () => {
      success('Notificações lidas excluídas.');
      queryClient.invalidateQueries(['my-notifications']);
    },
    onError: () => error('Erro ao excluir notificações.'),
  });

  const hasRead = notifications.some((n) => n.read);

  async function enablePush() {
    if (!pushSupported) return;
    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      setPushGranted(permission === 'granted');
      setPushDenied(permission === 'denied');
      if (permission === 'granted') {
        success('Notificações push ativadas!');
      } else if (permission === 'denied') {
        error('Permissão bloqueada. Reative nas configurações do navegador.');
      }
    } catch {
      error('Erro ao ativar notificações push.');
    } finally {
      setSubscribing(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.textPrimary }}>Notificações</h1>
        {unread > 0 && (
          <span style={{ background: theme.primary, color: '#fff', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999 }}>
            {unread} nova{unread > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {(unread > 0 || hasRead) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {unread > 0 && (
            <button
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isLoading}
              style={{ flex: 1, padding: '10px', background: theme.primarySoft, border: `1px solid ${theme.primary}44`, borderRadius: 10, color: theme.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Marcar todas como lidas
            </button>
          )}
          {hasRead && (
            <button
              onClick={() => deleteReadMutation.mutate()}
              disabled={deleteReadMutation.isLoading}
              style={{ flex: 1, padding: '10px', background: theme.dangerSoft, border: `1px solid ${theme.danger}44`, borderRadius: 10, color: theme.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Excluir lidas
            </button>
          )}
        </div>
      )}

      {pushSupported && !pushGranted && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '10px 14px', marginBottom: 16, gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary }}>Notificações push inativas</div>
            <div style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
              {pushDenied ? 'Permissão bloqueada. Reative nas configurações.' : 'Ative para receber alertas de serviços.'}
            </div>
          </div>
          <button
            onClick={enablePush}
            disabled={subscribing || pushDenied}
            style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: pushDenied ? theme.elevated : theme.accent, color: pushDenied ? theme.textMuted : '#fff', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {subscribing ? '...' : pushDenied ? 'Bloqueado' : 'Ativar'}
          </button>
        </div>
      )}

      {isLoading ? (
        <p style={{ color: theme.textMuted, padding: 24 }}>Carregando...</p>
      ) : notifications.length === 0 ? (
        <div style={{ background: theme.surface, borderRadius: 12, border: `1px solid ${theme.border}`, padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: theme.textMuted }}>Nenhuma notificação ainda.</div>
        </div>
      ) : (
        <div style={{ background: theme.surface, borderRadius: 12, border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
          {notifications.map((n, i) => {
            const { icon } = getIcon(n.type);
            return (
              <div
                key={n.id}
                onClick={() => !n.read && markReadMutation.mutate(n.id)}
                style={{
                  display: 'flex', gap: 12, padding: '14px 18px',
                  borderBottom: i < notifications.length - 1 ? `1px solid ${theme.border}` : 'none',
                  cursor: n.read ? 'default' : 'pointer',
                  background: n.read ? 'transparent' : theme.primarySoft + '40',
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 8, background: theme.elevated, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                  {icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: theme.textPrimary, marginBottom: 2 }}>
                    {n.title}
                    {!n.read && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: theme.accent, marginLeft: 6, verticalAlign: 'middle' }} />}
                  </div>
                  <div style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.4, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.body}</div>
                  <div style={{ fontSize: 11, color: theme.textMuted }}>{fmtDate(n.created_at)} atrás</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
