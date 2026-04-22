// mobile/src/components/TabBar.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type Screen = 'dashboard' | 'history' | 'services' | 'notifications';

interface TabBarProps {
  active: Screen;
  onNavigate: (screen: Screen) => void;
  unreadCount?: number;
  servicesOnly?: boolean;
}

const ALL_TABS: { screen: Screen; label: string; icon: string; clockOnly?: boolean }[] = [
  { screen: 'dashboard',     label: 'Registros', icon: '🕐', clockOnly: true },
  { screen: 'history',       label: 'Histórico', icon: '📋', clockOnly: true },
  { screen: 'services',      label: 'Serviços',  icon: '🔧' },
  { screen: 'notifications', label: 'Avisos',    icon: '🔔' },
];

export default function TabBar({ active, onNavigate, unreadCount = 0, servicesOnly = false }: TabBarProps) {
  const TABS = servicesOnly ? ALL_TABS.filter((t) => !t.clockOnly) : ALL_TABS;
  return (
    <View style={styles.tabBar}>
      {TABS.map(({ screen, label, icon }) => {
        const isActive = active === screen;
        const showBadge = screen === 'notifications' && unreadCount > 0;
        return (
          <TouchableOpacity
            key={screen}
            style={styles.tab}
            onPress={() => !isActive && onNavigate(screen)}
          >
            <View style={styles.iconWrap}>
              <Text style={[styles.icon, isActive && styles.iconActive]}>{icon}</Text>
              {showBadge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 9 ? '9+' : String(unreadCount)}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, isActive && styles.labelActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar:     { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingBottom: 8 },
  tab:        { flex: 1, alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  iconWrap:   { position: 'relative' },
  icon:       { fontSize: 20, color: '#94a3b8' },
  iconActive: { color: '#1d4ed8' },
  label:      { fontSize: 10, color: '#94a3b8', marginTop: 2, fontWeight: '500' },
  labelActive:{ color: '#1d4ed8', fontWeight: '700' },
  badge: {
    position: 'absolute', top: -4, right: -8,
    backgroundColor: '#dc2626', borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
});
