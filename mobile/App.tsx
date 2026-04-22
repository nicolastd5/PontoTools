import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
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

function AppContent() {
  const { user, loading }               = useAuth();
  const { theme, isDark }               = useTheme();
  useFcmToken(!!user);
  const [screen, setScreen]             = useState<Screen>('dashboard');
  const [authScreen, setAuthScreen]     = useState<AuthScreen>('login');
  const [unreadCount, setUnreadCount]   = useState(0);
  const [servicesOnly, setServicesOnly] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) { setServicesOnly(false); setScreen('dashboard'); return; }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    api.get('/clock/today', { params: { timezone: tz } })
      .then(({ data }) => {
        if (data.servicesOnly) { setServicesOnly(true); setScreen('services'); }
      })
      .catch(() => {});
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

  if (loading) {
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
