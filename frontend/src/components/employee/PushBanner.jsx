import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFcmWeb } from '../../hooks/useFcmWeb';
import api from '../../services/api';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function PushBanner() {
  const { user } = useAuth();
  const [pushSupported, setPushSupported] = useState(false);
  const [pushGranted,   setPushGranted]   = useState(false);
  const [subscribing,   setSubscribing]   = useState(false);
  const [showIosTip,    setShowIosTip]    = useState(false);

  useFcmWeb(pushGranted && !!user);

  useEffect(() => {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isIos && !isStandalone) {
      setShowIosTip(true);
      return;
    }
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY;
    setPushSupported(supported);
    if (supported) setPushGranted(Notification.permission === 'granted');
  }, []);

  async function enablePush() {
    if (!pushSupported) return;
    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setSubscribing(false); return; }
      setPushGranted(true);
      const reg          = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await api.post('/notifications/subscribe', subscription.toJSON());
    } catch (err) {
      console.error(err);
    } finally {
      setSubscribing(false);
    }
  }

  async function disablePush() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.delete('/notifications/subscribe', { data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setPushGranted(false);
    } catch {}
  }

  const bannerStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 16px', borderRadius: 10, marginBottom: 16,
  };
  const btnStyle = {
    flexShrink: 0, padding: '6px 14px', borderRadius: 8,
    fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
  };

  if (showIosTip) return (
    <div style={{ ...bannerStyle, background: '#fff7ed', border: '1px solid #fed7aa' }}>
      <div>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#9a3412' }}>
          📲 Instale o app para receber notificações
        </span>
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
          No Safari, toque em <strong>Compartilhar</strong> (ícone ···) e depois em <strong>"Adicionar à Tela de Início"</strong>. Abra o app pela tela inicial e ative as notificações aqui.
        </p>
      </div>
    </div>
  );

  if (!pushSupported) return null;

  return (
    <div style={{ ...bannerStyle, background: pushGranted ? '#f0fdf4' : '#eff6ff', border: `1px solid ${pushGranted ? '#86efac' : '#bfdbfe'}` }}>
      <div>
        <span style={{ fontSize: 14, fontWeight: 600, color: pushGranted ? '#166534' : '#1e40af' }}>
          {pushGranted ? '🔔 Notificações ativas' : '🔕 Notificações inativas'}
        </span>
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
          {pushGranted ? 'Você receberá alertas mesmo com o app fechado.' : 'Ative para receber alertas de serviços e avisos.'}
        </p>
      </div>
      <button
        onClick={pushGranted ? disablePush : enablePush}
        disabled={subscribing}
        style={{ ...btnStyle, background: pushGranted ? '#dcfce7' : '#1d4ed8', color: pushGranted ? '#166534' : '#fff', border: pushGranted ? '1px solid #86efac' : 'none' }}
      >
        {subscribing ? '...' : pushGranted ? 'Desativar' : 'Ativar'}
      </button>
    </div>
  );
}
