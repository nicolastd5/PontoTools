import React, { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import HistoryScreen from './src/screens/HistoryScreen';

type Screen = 'dashboard' | 'history';
type AuthScreen = 'login' | 'forgot-password';

function AppContent() {
  const { user, loading }           = useAuth();
  const [screen, setScreen]         = useState<Screen>('dashboard');
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');

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

  return (
    <View style={{ flex: 1 }}>
      {screen === 'dashboard'
        ? <DashboardScreen onNavigate={setScreen} />
        : <HistoryScreen onNavigate={setScreen} />
      }
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
