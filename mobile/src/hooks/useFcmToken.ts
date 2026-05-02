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
    if (!isLoggedIn) return undefined;

    let cancelled = false;
    let unsubRefresh: (() => void) | null = null;
    let unsubOnMessage: (() => void) | null = null;

    async function setup() {
      try {
        const authStatus = await messaging().requestPermission();
        if (cancelled) return;

        const allowed =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        if (!allowed) {
          console.warn('[FCM] Permissao negada, authStatus:', authStatus);
          return;
        }

        const token = await messaging().getToken();
        if (cancelled) return;
        if (token) {
          await registerToken(token);
        } else {
          console.warn('[FCM] getToken retornou vazio');
        }
      } catch (err: any) {
        console.warn('[FCM] Erro em setup:', err?.message);
        return;
      }

      const nextUnsubRefresh = messaging().onTokenRefresh(registerToken);
      const nextUnsubOnMessage = messaging().onMessage(async (remoteMessage) => {
        const title = remoteMessage.notification?.title
          ?? (remoteMessage.data?.title as string | undefined)
          ?? 'Notificacao';
        const body = remoteMessage.notification?.body
          ?? (remoteMessage.data?.body as string | undefined)
          ?? '';
        Alert.alert(String(title), String(body));
      });

      if (cancelled) {
        nextUnsubRefresh();
        nextUnsubOnMessage();
        return;
      }

      unsubRefresh = nextUnsubRefresh;
      unsubOnMessage = nextUnsubOnMessage;
    }

    setup();

    return () => {
      cancelled = true;
      unsubRefresh?.();
      unsubOnMessage?.();
    };
  }, [isLoggedIn]);
}
