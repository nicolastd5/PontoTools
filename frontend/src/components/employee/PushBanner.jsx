import { useEffect, useState } from 'react';

const FIREBASE_VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export default function PushBanner() {
  const [pushSupported, setPushSupported] = useState(false);
  const [pushGranted, setPushGranted] = useState(false);
  const [pushDenied, setPushDenied] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [showIosTip, setShowIosTip] = useState(false);

  useEffect(() => {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isIos && !isStandalone) {
      setShowIosTip(true);
      return;
    }

    const supported = 'Notification' in window && 'serviceWorker' in navigator && !!FIREBASE_VAPID_KEY;
    setPushSupported(supported);

    if (supported) {
      setPushGranted(Notification.permission === 'granted');
      setPushDenied(Notification.permission === 'denied');
    }
  }, []);

  async function enablePush() {
    if (!pushSupported) return;

    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      setPushGranted(permission === 'granted');
      setPushDenied(permission === 'denied');
    } catch {
      // no-op
    } finally {
      setSubscribing(false);
    }
  }

  const bannerStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 16px', borderRadius: 10, marginBottom: 16,
  };
  const btnStyle = {
    flexShrink: 0, padding: '6px 14px', borderRadius: 8,
    fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
  };

  if (showIosTip) {
    return (
      <div style={{ ...bannerStyle, background: '#fff7ed', border: '1px solid #fed7aa' }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#9a3412' }}>
            Instale o app para receber notificacoes
          </span>
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            No Safari, toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar a Tela de Inicio</strong>. Abra o app pela tela inicial e ative as notificacoes aqui.
          </p>
        </div>
      </div>
    );
  }

  if (!pushSupported) return null;

  return (
    <div style={{ ...bannerStyle, background: pushGranted ? '#f0fdf4' : '#eff6ff', border: `1px solid ${pushGranted ? '#86efac' : '#bfdbfe'}` }}>
      <div>
        <span style={{ fontSize: 14, fontWeight: 600, color: pushGranted ? '#166534' : '#1e40af' }}>
          {pushGranted ? 'Notificacoes ativas' : 'Notificacoes inativas'}
        </span>
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
          {pushGranted
            ? 'Voce recebera alertas mesmo com o app fechado.'
            : pushDenied
              ? 'Permissao bloqueada no navegador. Reative nas configuracoes do site.'
              : 'Ative para receber alertas de servicos e avisos.'}
        </p>
      </div>

      <button
        onClick={enablePush}
        disabled={subscribing || pushGranted || pushDenied}
        style={{
          ...btnStyle,
          background: pushGranted ? '#dcfce7' : pushDenied ? '#e5e7eb' : '#1d4ed8',
          color: pushGranted ? '#166534' : pushDenied ? '#6b7280' : '#fff',
          border: pushGranted ? '1px solid #86efac' : pushDenied ? '1px solid #d1d5db' : 'none',
        }}
      >
        {subscribing ? '...' : pushGranted ? 'Ativo' : pushDenied ? 'Bloqueado' : 'Ativar'}
      </button>
    </div>
  );
}
