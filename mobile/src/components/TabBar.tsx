import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';

type Screen = 'dashboard' | 'history' | 'services' | 'notifications' | 'profile';

interface TabBarProps {
  active: Screen;
  onNavigate: (screen: Screen) => void;
  unreadCount?: number;
  servicesOnly?: boolean;
}

interface TabDef {
  screen: Screen;
  label: string;
  icon: string;
  iconActive: string;
}

const ALL_TABS: TabDef[] = [
  { screen: 'dashboard',     label: 'Ponto',     icon: 'time-outline',          iconActive: 'time' },
  { screen: 'history',       label: 'Histórico', icon: 'list-outline',          iconActive: 'list' },
  { screen: 'services',      label: 'Serviços',  icon: 'construct-outline',     iconActive: 'construct' },
  { screen: 'notifications', label: 'Avisos',    icon: 'notifications-outline', iconActive: 'notifications' },
  { screen: 'profile',       label: 'Perfil',    icon: 'person-outline',        iconActive: 'person' },
];

export default function TabBar({ active, onNavigate, unreadCount = 0, servicesOnly = false }: TabBarProps) {
  const { theme } = useTheme();
  const TABS = servicesOnly
    ? ALL_TABS.filter((t) => ['services', 'notifications', 'profile'].includes(t.screen))
    : ALL_TABS;

  return (
    <View style={[s.bar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
      {TABS.map(({ screen, label, icon, iconActive }) => {
        const isActive  = active === screen;
        const showBadge = screen === 'notifications' && unreadCount > 0;
        const color     = isActive ? theme.accent : theme.textMuted;
        return (
          <TouchableOpacity
            key={screen}
            style={s.tab}
            onPress={() => !isActive && onNavigate(screen)}
          >
            <View style={s.iconWrap}>
              <Icon name={isActive ? iconActive : icon} size={22} color={color} />
              {showBadge && (
                <View style={[s.badge, { backgroundColor: theme.danger }]}>
                  <Text style={s.badgeText}>{unreadCount > 9 ? '9+' : String(unreadCount)}</Text>
                </View>
              )}
            </View>
            <Text style={[s.label, { color }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar:       { flexDirection: 'row', borderTopWidth: 1, paddingBottom: 6 },
  tab:       { flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 2 },
  iconWrap:  { position: 'relative' },
  label:     { fontSize: 10, marginTop: 3, fontWeight: '600' },
  badge:     { position: 'absolute', top: -4, right: -8, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
});
