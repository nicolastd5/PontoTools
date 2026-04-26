import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const FIREBASE_VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

function Icon({ d, size = 16, color = 'currentColor', strokeWidth = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  );
}

const ICON_TOOL   = 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z';
const ICON_WARN   = 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01';
const ICON_ALERT  = 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z';
const ICON_MEGAPHONE = 'M3 11l19-9-9 19-2-8-8-2z';
const ICON_BELL   = 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0';
const ICON_CHECK_ALL = 'M1.5 12.5l5 5L14 6 M18 6l-7 7';

const TYPE_ICON = {
  service_assigned: { d: ICON_TOOL,      color: '#4f46e5', bg: 'rgba(79,70,229,0.1)'  },
  service_delay:    { d: ICON_WARN,      color: '#b45309', bg: 'rgba(245,158,11,0.1)' },
  service_problem:  { d: ICON_ALERT,     color: '#dc2626', bg: 'rgba(239,68,68,0.1)'  },
  default:          { d: ICON_MEGAPHONE, color: '#71717a', bg: 'rgba(161,161,170,0.1)' },
};

function fmtDate(dt) {
  const diff = (Date.now() - new Date(dt).getTime()) / 1000;
  if (diff < 60) return 'agora mesmo';
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  const d = new Date(dt);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function EmployeeNotificationsPage() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['my-notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data),
    refetchInterval: 30000,
  });

  const notifications = data?.notifications || [];
  const unread        = data?.unread ?? 0;

  const [pushSupported, setPushSupported] = useState(false);
  const [pushGranted, setPushGranted]     = useState(false);
  const [pushDenied, setPushDenied]       = useState(false);
  const [subscribing, setSubscribing]     = useState(false);

  useEffect(() => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator && !!FIREBASE_VAPID_KEY;
    setPushSupported(supported);
    if (supported) { setPushGranted(Notification.permission === 'granted'); setPushDenied(Notification.permission === 'denied'); }
  }, []);

  const markReadMutation = useMutation({
    mutationFn: (id) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries(['my-notifications']),
  });
  const markAllMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => { success('Todas marcadas como lidas.'); queryClient.invalidateQueries(['my-notifications']); },
  });
  const deleteReadMutation = useMutation({
    mutationFn: () => api.delete('/notifications/read'),
    onSuccess: () => { success('Notificações lidas excluídas.'); queryClient.invalidateQueries(['my-notifications']); },
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
      if (permission === 'granted') success('Notificações push ativadas!');
      else if (permission === 'denied') error('Permissão bloqueada. Reative nas configurações do navegador.');
    } catch { error('Erro ao ativar notificações push.'); }
    finally { setSubscribing(false); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 2 }}>Avisos</p>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-ink)', margin: 0, letterSpacing: '-0.03em' }}>Notificações</h1>
        </div>
        {unread > 0 && (
          <span style={{ background: 'var(--color-ok)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, marginTop: 4 }}>
            {unread} nova{unread > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {(unread > 0 || hasRead) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {unread > 0 && (
            <button onClick={() => markAllMutation.mutate()} disabled={markAllMutation.isLoading}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', background: 'var(--color-primary-soft)', border: '1px solid rgba(79,70,229,0.2)', borderRadius: 10, color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Icon d={ICON_CHECK_ALL} size={15} color="var(--color-primary)" />
              Marcar todas como lidas
            </button>
          )}
          {hasRead && (
            <button onClick={() => deleteReadMutation.mutate()} disabled={deleteReadMutation.isLoading}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: 'var(--color-danger)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Excluir lidas
            </button>
          )}
        </div>
      )}

      {pushSupported && !pushGranted && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', border: '1px solid var(--color-line)', borderRadius: 12, padding: '12px 14px', marginBottom: 20, gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <Icon d={ICON_BELL} size={14} color="var(--color-muted)" />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>Notificações push inativas</div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', paddingLeft: 22 }}>
              {pushDenied ? 'Permissão bloqueada no navegador. Reative nas configurações do site.' : 'Ative para receber alertas de serviços.'}
            </div>
          </div>
          <button onClick={enablePush} disabled={subscribing || pushDenied}
            style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: pushDenied ? 'var(--color-hairline)' : 'var(--color-primary)', color: pushDenied ? 'var(--color-muted)' : '#fff', whiteSpace: 'nowrap' }}>
            {subscribing ? '...' : pushDenied ? 'Bloqueado' : 'Ativar'}
          </button>
        </div>
      )}

      {isLoading ? (
        <p style={{ textAlign: 'center', color: 'var(--color-muted)', padding: 32 }}>Carregando...</p>
      ) : notifications.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-muted)', padding: 32 }}>Nenhuma notificação ainda.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {notifications.map((n) => {
            const info = TYPE_ICON[n.type] || TYPE_ICON.default;
            return (
              <div key={n.id} onClick={() => !n.read && markReadMutation.mutate(n.id)}
                style={{ display: 'flex', gap: 12, padding: '13px 0', borderBottom: '1px solid var(--color-hairline)', cursor: n.read ? 'default' : 'pointer', background: !n.read ? 'rgba(79,70,229,0.02)' : undefined }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: info.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon d={info.d} size={17} color={info.color} strokeWidth={1.8} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: 'var(--color-ink)', marginBottom: 2 }}>
                    {n.title}
                    {!n.read && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: 'var(--color-primary)', marginLeft: 6, verticalAlign: 'middle' }} />}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.4, marginBottom: 3 }}>{n.body}</div>
                  <div style={{ fontSize: 10, color: 'var(--color-subtle)' }}>{fmtDate(n.created_at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
