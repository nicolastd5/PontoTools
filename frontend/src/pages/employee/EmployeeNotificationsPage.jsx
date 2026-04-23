import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../contexts/ThemeContext';

const FIREBASE_VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

const TYPE_ICON = {
  service_assigned: { icon: '🔧', bg: 'rgba(108,92,231,0.2)' },
  service_delay: { icon: '⚠️', bg: 'rgba(245,158,11,0.2)' },
  service_problem: { icon: '❗', bg: 'rgba(239,68,68,0.15)' },
  default: { icon: '📢', bg: 'rgba(139,146,169,0.15)' },
};

function getIcon(type) {
  return TYPE_ICON[type] || TYPE_ICON.default;
}

function fmtDate(dt) {
  const diff = (Date.now() - new Date(dt).getTime()) / 1000;
  if (diff < 60) return 'agora mesmo';
  if (diff < 3600) return `ha ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `ha ${Math.floor(diff / 3600)}h`;
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

  async function enablePush() {
    if (!pushSupported) return;

    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      setPushGranted(permission === 'granted');
      setPushDenied(permission === 'denied');

      if (permission === 'granted') {
        success('Notificacoes push ativadas!');
      } else if (permission === 'denied') {
        error('Permissao bloqueada. Reative nas configuracoes do navegador.');
      }
    } catch {
      error('Erro ao ativar notificacoes push.');
    } finally {
      setSubscribing(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: theme.accent, textTransform: 'uppercase', marginBottom: 2 }}>Avisos</p>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: theme.textPrimary }}>Notificacoes</h1>
        </div>
        {unread > 0 && (
          <span style={{ background: theme.success, color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, marginTop: 4 }}>
            {unread} nova{unread > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {unread > 0 && (
        <button
          onClick={() => markAllMutation.mutate()}
          disabled={markAllMutation.isLoading}
          style={{
            width: '100%',
            padding: '10px',
            background: theme.accent + '18',
            border: `1px solid ${theme.accent}44`,
            borderRadius: 10,
            color: theme.accent,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 16,
          }}
        >
          Marcar todas como lidas
        </button>
      )}

      {pushSupported && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 20, gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary }}>
              {pushGranted ? 'Notificacoes push ativas' : 'Notificacoes push inativas'}
            </div>
            <div style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
              {pushGranted
                ? 'Voce recebera alertas mesmo com o app fechado.'
                : pushDenied
                  ? 'Permissao bloqueada no navegador. Reative nas configuracoes do site.'
                  : 'Ative para receber alertas de servicos.'}
            </div>
          </div>
          <button
            onClick={enablePush}
            disabled={subscribing || pushGranted || pushDenied}
            style={{
              padding: '7px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: pushGranted ? theme.elevated : pushDenied ? '#e5e7eb' : theme.accent,
              color: pushGranted ? theme.textSecondary : pushDenied ? '#6b7280' : '#fff',
              whiteSpace: 'nowrap',
            }}
          >
            {subscribing ? '...' : pushGranted ? 'Ativo' : pushDenied ? 'Bloqueado' : 'Ativar'}
          </button>
        </div>
      )}

      {isLoading ? (
        <p style={{ textAlign: 'center', color: theme.textMuted, padding: 32 }}>Carregando...</p>
      ) : notifications.length === 0 ? (
        <p style={{ textAlign: 'center', color: theme.textMuted, padding: 32 }}>Nenhuma notificacao ainda.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {notifications.map((n) => {
            const { icon, bg } = getIcon(n.type);
            return (
              <div
                key={n.id}
                onClick={() => !n.read && markReadMutation.mutate(n.id)}
                style={{ display: 'flex', gap: 12, padding: '13px 0', borderBottom: `1px solid ${theme.border}`, cursor: n.read ? 'default' : 'pointer' }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 19, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                  {icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: theme.textPrimary, marginBottom: 2 }}>
                    {n.title}
                    {!n.read && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: theme.accent, marginLeft: 6, verticalAlign: 'middle' }} />}
                  </div>
                  <div style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.4, marginBottom: 3 }}>{n.body}</div>
                  <div style={{ fontSize: 10, color: theme.textMuted }}>{fmtDate(n.created_at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
