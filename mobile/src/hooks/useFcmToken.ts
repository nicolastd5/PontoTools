// mobile/src/hooks/useFcmToken.ts
import { useEffect } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import api from '../services/api';

async function registerToken(token: string) {
  try {
    await api.post('/notifications/fcm-token', { token });
  } catch (err: any) {
    console.warn('[FCM] Falha ao registrar token no backend:', err?.message);
  }
}

async function ensureAndroidPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version < 33) return true;
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    {
      title: 'Permitir notificações',
      message: 'Receba alertas de novos serviços e atualizações.',
      buttonPositive: 'Permitir',
      buttonNegative: 'Agora não',
    },
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export function useFcmToken(isLoggedIn: boolean) {
  useEffect(() => {
    if (!isLoggedIn) return;

    let unsubRefresh:  (() => void) | null = null;
    let unsubOnMessage: (() => void) | null = null;

    async function setup() {
      // 1. Android 13+ exige permissão runtime
      const androidOk = await ensureAndroidPermission();
      if (!androidOk) {
        console.warn('[FCM] Usuário negou POST_NOTIFICATIONS');
        return;
      }

      // 2. Permissão iOS (no-op no Android além do passo 1)
      const authStatus = await messaging().requestPermission();
      const allowed =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      if (!allowed) {
        console.warn('[FCM] Permissão negada, authStatus:', authStatus);
        return;
      }

      // 3. Token do device e registro no backend
      try {
        const token = await messaging().getToken();
        if (token) await registerToken(token);
        else console.warn('[FCM] getToken retornou vazio');
      } catch (err: any) {
        console.warn('[FCM] Erro em getToken:', err?.message);
      }

      unsubRefresh = messaging().onTokenRefresh(registerToken);

      // 4. Foreground: FCM não exibe nada com app aberto — mostramos um Alert
      unsubOnMessage = messaging().onMessage(async (remoteMessage) => {
        const title = remoteMessage.notification?.title
          ?? remoteMessage.data?.title as string
          ?? 'Notificação';
        const body  = remoteMessage.notification?.body
          ?? remoteMessage.data?.body as string
          ?? '';
        Alert.alert(String(title), String(body));
      });
    }

    setup();

    return () => {
      unsubRefresh?.();
      unsubOnMessage?.();
    };
  }, [isLoggedIn]);
}
