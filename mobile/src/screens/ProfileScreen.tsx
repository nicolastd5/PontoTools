import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useAuth }  from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import TabBar from '../components/TabBar';

type Screen = 'dashboard' | 'history' | 'services' | 'notifications' | 'profile';

export default function ProfileScreen({
  onNavigate, unreadCount = 0, servicesOnly = false,
}: {
  onNavigate: (s: Screen) => void;
  unreadCount?: number;
  servicesOnly?: boolean;
}) {
  const { user, logout }               = useAuth();
  const { isDark, theme, toggleTheme } = useTheme();

  function handleLogout() {
    Alert.alert('Sair', 'Deseja encerrar a sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logout },
    ]);
  }

  const initials = user?.name
    ? user.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
    : '?';

  const rows = [
    { key: 'Email',   val: user?.email },
    { key: 'Unidade', val: user?.unit?.name },
    { key: 'Cargo',   val: (user as any)?.jobRole?.name || '—' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: theme.accent, textTransform: 'uppercase', marginBottom: 2 }}>Conta</Text>
        <Text style={{ fontSize: 24, fontWeight: '800', color: theme.textPrimary, marginBottom: 24 }}>Meu Perfil</Text>

        {/* Avatar */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: theme.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>{initials}</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: theme.textPrimary, marginBottom: 2 }}>{user?.name}</Text>
          <Text style={{ fontSize: 12, color: theme.accent }}>{(user as any)?.jobRole?.name || 'Funcionário'}</Text>
        </View>

        {/* Info */}
        <View style={{ backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, overflow: 'hidden', marginBottom: 16 }}>
          {rows.map(({ key, val }, i) => (
            <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: theme.border }}>
              <Text style={{ fontSize: 12, color: theme.textSecondary }}>{key}</Text>
              <Text style={{ fontSize: 13, color: theme.textPrimary, fontWeight: '600' }}>{val || '—'}</Text>
            </View>
          ))}
        </View>

        {/* Toggle tema */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, marginBottom: 16 }}>
          <View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textPrimary }}>Tema escuro</Text>
            <Text style={{ fontSize: 11, color: theme.textSecondary }}>Aparência do aplicativo</Text>
          </View>
          <TouchableOpacity
            onPress={toggleTheme}
            style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: isDark ? theme.accent : theme.elevated, justifyContent: 'center', paddingHorizontal: 3 }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', alignSelf: isDark ? 'flex-end' : 'flex-start' }} />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          style={{ padding: 14, backgroundColor: theme.danger + '18', borderWidth: 1, borderColor: theme.danger + '44', borderRadius: 12, alignItems: 'center' }}>
          <Text style={{ color: theme.danger, fontSize: 14, fontWeight: '700' }}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>

      <TabBar active="profile" onNavigate={onNavigate} unreadCount={unreadCount} servicesOnly={servicesOnly} />
    </SafeAreaView>
  );
}
