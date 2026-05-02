import React, { useState, useEffect, useRef } from 'react';
import {
  View, ActivityIndicator, StatusBar,
  Platform, PermissionsAndroid, Text, TouchableOpacity, Linking,
} from 'react-native';
import { AuthProvider, useAuth }   from './src/contexts/AuthContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { GpsProvider }             from './src/contexts/GpsContext';
import { ServiceLocationTrackingProvider } from './src/contexts/ServiceLocationTrackingContext';
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

async function requestForegroundLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const fineResult = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'GPS Obrigatorio',
      message: 'O aplicativo requer acesso a localizacao para registrar ponto e servicos.',
      buttonPositive: 'Permitir',
      buttonNegative: 'Negar',
    },
  );

  return fineResult === PermissionsAndroid.RESULTS.GRANTED;
}

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
      let gpsOk = false;
      try {
        gpsOk = await requestForegroundLocationPermission();
      } catch {
        gpsOk = false;
      }
      if (!cancelled) setGpsGate(gpsOk ? 'granted' : 'denied');

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
    let cancelled = false;
    function fetchUnread() {
      api.get('/notifications')
        .then(({ data }) => {
          if (!cancelled) setUnreadCount(data.unread ?? 0);
        })
        .catch(() => {});
    }
    fetchUnread();
    intervalRef.current = setInterval(fetchUnread, 30_000);
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user]);

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

  if (gpsGate === 'denied') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg, padding: 32 }}>
        <StatusBar backgroundColor={theme.bg} barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Text style={{ fontSize: 48, marginBottom: 16 }}>GPS</Text>
        <Text style={{ fontSize: 20, fontWeight: '800', color: theme.textPrimary, textAlign: 'center', marginBottom: 10 }}>
          GPS Obrigatorio
        </Text>
        <Text style={{ fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
          O aplicativo requer acesso a localizacao para registrar ponto e servicos.{'\n'}
          Habilite a localizacao nas configuracoes e reabra o app.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: theme.accent, borderRadius: 12, padding: 14, paddingHorizontal: 32 }}
          onPress={() => Linking.openSettings()}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Abrir Configuracoes</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sharedProps = { onNavigate: setScreen, unreadCount, servicesOnly };

  return (
    <GpsProvider>
      <ServiceLocationTrackingProvider enabled={user.role === 'employee'} userId={user.id}>
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
          <StatusBar backgroundColor={theme.bg} barStyle={isDark ? 'light-content' : 'dark-content'} />
          {screen === 'dashboard'     && <DashboardScreen     {...sharedProps} />}
          {screen === 'history'       && <HistoryScreen       {...sharedProps} />}
          {screen === 'services'      && <ServicesScreen      {...sharedProps} />}
          {screen === 'notifications' && <NotificationsScreen {...sharedProps} onUnreadChange={setUnreadCount} />}
          {screen === 'profile'       && <ProfileScreen       {...sharedProps} />}
        </View>
      </ServiceLocationTrackingProvider>
    </GpsProvider>
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
