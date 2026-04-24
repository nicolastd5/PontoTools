// mobile/src/hooks/useFcmToken.ts
import { useEffect } from 'react';
import { Alert } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import api from '../services/api';

async function registerToken(token: string) {
  try {
    await api.post('/notifications/fcm-token', { token });
  } catch (err: any) {
    console.warn('[FCM] Falha ao registrar token no backend:', err?.message);
  }
}

export function useFcmToken(isLoggedIn: boolean) {
  useEffect(() => {
    if (!isLoggedIn) return;

    let unsubRefresh:   (() => void) | null = null;
    let unsubOnMessage: (() => void) | null = null;

    async function setup() {
      // messaging().requestPermission() já lida com POST_NOTIFICATIONS no
      // Android 13+ (Firebase v24+), sem precisar de PermissionsAndroid separado.
      // Chamar PermissionsAndroid.request em paralelo com o GPS de App.tsx
      // causava deadlock e loading infinito.
      const authStatus = await messaging().requestPermission();
      const allowed =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      if (!allowed) {
        console.warn('[FCM] Permissão negada, authStatus:', authStatus);
        return;
      }

      try {
        const token = await messaging().getToken();
        if (token) await registerToken(token);
        else console.warn('[FCM] getToken retornou vazio');
      } catch (err: any) {
        console.warn('[FCM] Erro em getToken:', err?.message);
      }

      unsubRefresh = messaging().onTokenRefresh(registerToken);

      // Foreground: FCM não exibe notificação com app aberto — mostra Alert
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
