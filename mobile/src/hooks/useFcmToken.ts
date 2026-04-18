// mobile/src/hooks/useFcmToken.ts
import { useEffect } from 'react';
import messaging from '@react-native-firebase/messaging';
import api from '../services/api';

async function registerToken(token: string) {
  try {
    await api.post('/notifications/fcm-token', { token });
  } catch {}
}

export function useFcmToken(isLoggedIn: boolean) {
  useEffect(() => {
    if (!isLoggedIn) return;

    let unsubRefresh: (() => void) | null = null;

    async function setup() {
      const authStatus = await messaging().requestPermission();
      const allowed =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!allowed) return;

      const token = await messaging().getToken();
      if (token) await registerToken(token);

      unsubRefresh = messaging().onTokenRefresh(registerToken);
    }

    setup();

    return () => {
      unsubRefresh?.();
    };
  }, [isLoggedIn]);
}
