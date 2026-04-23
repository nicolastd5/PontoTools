import React, { useState, useEffect, useRef } from 'react';
import {
  View, ActivityIndicator, StatusBar,
  Platform, PermissionsAndroid, Text, TouchableOpacity, Linking,
} from 'react-native';
import { AuthProvider, useAuth }   from './src/contexts/AuthContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import LoginScreen             from './src/screens/LoginScreen';
import ForgotPasswordScreen    from './src/screens/ForgotPasswordScreen';
import DashboardScreen         from './src/screens/DashboardScreen';
import HistoryScreen           from './src/screens/HistoryScreen';
import ServicesScreen          from './src/screens/ServicesScreen';
import NotificationsScreen     from './src/screens/NotificationsScreen';
import ProfileScreen           from './src/screens/ProfileScreen';
import api                     from './src/services/api';
import { useFcmToken }         from './src/hooks/useFcmToken';

type Screen     = 'dashboard' | 'history' | 'services' | 'notifications' | 'profile';
type AuthScreen = 'login' | 'forgot-password';
type GpsGate    = 'pending' | 'granted' | 'denied';

function AppContent() {
  const { user, loading }               = useAuth();
  const { theme, isDark }               = useTheme();
  useFcmToken(!!user);
  const [screen, setScreen]             = useState<Screen>('dashboard');
  const [authScreen, setAuthScreen]     = useState<AuthScreen>('login');
  const [unreadCount, setUnreadCount]   = useState(0);
  const [servicesOnly, setServicesOnly] = useState(false);
  const [screenReady, setScreenReady]   = useState(false);
  const [gpsGate, setGpsGate]           = useState<GpsGate>('pending');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) {
      setServicesOnly(false);
      setScreen('dashboard');
      setScreenReady(false);
      setGpsGate('pending');
      return;
    }

    let cancelled = false;

    async function init() {
      // 1. Pede permissão de GPS (obrigatório)
      let gpsOk = false;
      if (Platform.OS === 'android') {
        try {
          const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'GPS Obrigatório',
              message: 'O aplicativo requer acesso à localização para registrar ponto e serviços.',
              buttonPositive: 'Permitir',
              buttonNegative: 'Negar',
            },
          );
          gpsOk = result === PermissionsAndroid.RESULTS.GRANTED;
        } catch {
          gpsOk = false;
        }
      } else {
        gpsOk = true;
      }
      if (!cancelled) setGpsGate(gpsOk ? 'granted' : 'denied');

      // 2. Determina qual tela mostrar (evita flash de dashboard → services)
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      try {
        const { data } = await api.get('/clock/today', { params: { timezone: tz } });
        if (!cancelled) {
          if (data.servicesOnly) { setServicesOnly(true); setScreen('services'); }
          else { setServicesOnly(false); setScreen('dashboard'); }
        }
      } catch {
        if (!cancelled) { setServicesOnly(false); setScreen('dashboard'); }
      }

      if (!cancelled) setScreenReady(true);
    }

    init();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    function fetchUnread() {
      api.get('/notifications')
        .then(({ data }) => setUnreadCount(data.unread ?? 0))
        .catch(() => {});
    }
    fetchUnread();
    intervalRef.current = setInterval(fetchUnread, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [user]);

  // Spinner enquanto auth carrega ou enquanto resolve tela inicial pós-login
  if (loading || (user && !screenReady)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg }}>
        <StatusBar backgroundColor={theme.bg} barStyle={isDark ? 'light-content' : 'dark-content'} />
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  if (!user) {
    if (authScreen === 'forgot-password')
      return <ForgotPasswordScreen onBack={() => setAuthScreen('login')} />;
    return <LoginScreen onForgotPassword={() => setAuthScreen('forgot-password')} />;
  }

  // GPS negado → tela bloqueante com botão para configurações
  if (gpsGate === 'denied') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg, padding: 32 }}>
        <StatusBar backgroundColor={theme.bg} barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Text style={{ fontSize: 48, marginBottom: 16 }}>📍</Text>
        <Text style={{ fontSize: 20, fontWeight: '800', color: theme.textPrimary, textAlign: 'center', marginBottom: 10 }}>
          GPS Obrigatório
        </Text>
        <Text style={{ fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
          O aplicativo requer acesso à localização para registrar ponto e serviços.{'\n'}
          Habilite o GPS nas configurações do dispositivo e reabra o app.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: theme.accent, borderRadius: 12, padding: 14, paddingHorizontal: 32 }}
          onPress={() => Linking.openSettings()}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Abrir Configurações</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sharedProps = { onNavigate: setScreen, unreadCount, servicesOnly };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar backgroundColor={theme.bg} barStyle={isDark ? 'light-content' : 'dark-content'} />
      {screen === 'dashboard'     && <DashboardScreen     {...sharedProps} />}
      {screen === 'history'       && <HistoryScreen       {...sharedProps} />}
      {screen === 'services'      && <ServicesScreen      {...sharedProps} />}
      {screen === 'notifications' && <NotificationsScreen {...sharedProps} onUnreadChange={setUnreadCount} />}
      {screen === 'profile'       && <ProfileScreen       {...sharedProps} />}
    </View>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
}
