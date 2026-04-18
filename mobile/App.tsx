// mobile/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import LoginScreen             from './src/screens/LoginScreen';
import ForgotPasswordScreen    from './src/screens/ForgotPasswordScreen';
import DashboardScreen         from './src/screens/DashboardScreen';
import HistoryScreen           from './src/screens/HistoryScreen';
import ServicesScreen          from './src/screens/ServicesScreen';
import NotificationsScreen     from './src/screens/NotificationsScreen';
import api                     from './src/services/api';
import { useFcmToken }         from './src/hooks/useFcmToken';

type Screen     = 'dashboard' | 'history' | 'services' | 'notifications';
type AuthScreen = 'login' | 'forgot-password';

function AppContent() {
  const { user, loading }             = useAuth();
  useFcmToken(!!user);
  const [screen, setScreen]           = useState<Screen>('dashboard');
  const [authScreen, setAuthScreen]   = useState<AuthScreen>('login');
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Polling de notificações não lidas a cada 30s
  useEffect(() => {
    if (!user) return;
    function fetchUnread() {
      api.get('/notifications')
        .then(({ data }) => setUnreadCount(data.unread ?? 0))
        .catch(() => {});
    }
    fetchUnread();
    intervalRef.current = setInterval(fetchUnread, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  if (!user) {
    if (authScreen === 'forgot-password') {
      return <ForgotPasswordScreen onBack={() => setAuthScreen('login')} />;
    }
    return <LoginScreen onForgotPassword={() => setAuthScreen('forgot-password')} />;
  }

  const sharedProps = { onNavigate: setScreen, unreadCount };

  return (
    <View style={{ flex: 1 }}>
      {screen === 'dashboard'     && <DashboardScreen     {...sharedProps} />}
      {screen === 'history'       && <HistoryScreen       {...sharedProps} />}
      {screen === 'services'      && <ServicesScreen      {...sharedProps} />}
      {screen === 'notifications' && (
        <NotificationsScreen
          {...sharedProps}
          onUnreadChange={setUnreadCount}
        />
      )}
    </View>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
