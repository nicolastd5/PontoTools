# Dark Theme — Mobile Android Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar o redesign de tema escuro em todas as telas do funcionário no app React Native Android.

**Architecture:** Tokens centralizados em `theme.ts`, contexto `ThemeContext` com toggle persistido em `AsyncStorage`. A navegação é feita via `useState` em `App.tsx` — o `ProfileScreen` é adicionado como novo case. Os ícones da TabBar migram de emojis para `react-native-vector-icons/Ionicons`.

**Tech Stack:** React Native 0.74, TypeScript, react-native-vector-icons (novo), AsyncStorage (já instalado), date-fns-tz.

---

## Mapa de arquivos

| Ação | Arquivo |
|---|---|
| Criar | `mobile/src/theme.ts` |
| Criar | `mobile/src/contexts/ThemeContext.tsx` |
| Criar | `mobile/src/screens/ProfileScreen.tsx` |
| Modificar | `mobile/android/app/build.gradle` |
| Modificar | `mobile/App.tsx` |
| Modificar | `mobile/src/components/TabBar.tsx` |
| Modificar | `mobile/src/screens/LoginScreen.tsx` |
| Modificar | `mobile/src/screens/DashboardScreen.tsx` |
| Modificar | `mobile/src/screens/HistoryScreen.tsx` |
| Modificar | `mobile/src/screens/NotificationsScreen.tsx` |

---

## Task 1: Instalar react-native-vector-icons e configurar Android

**Files:**
- Modify: `mobile/package.json` (via npm)
- Modify: `mobile/android/app/build.gradle`

- [ ] **Step 1: Instalar dependências**

```bash
cd mobile && npm install react-native-vector-icons && npm install --save-dev @types/react-native-vector-icons
```

- [ ] **Step 2: Adicionar fonts.gradle no build.gradle do app**

Abra `mobile/android/app/build.gradle`. Localize o final do arquivo (após o bloco `dependencies {}`) e adicione:

```gradle
apply from: "../../node_modules/react-native-vector-icons/fonts.gradle"
```

- [ ] **Step 3: Verificar que o app ainda builda**

```bash
cd mobile && npm run android
```

Expected: app abre no emulador/dispositivo sem erros de build. Um `import Icon from 'react-native-vector-icons/Ionicons'` em qualquer tela deve funcionar sem crash.

- [ ] **Step 4: Commit**

```bash
cd mobile && git add package.json package-lock.json android/app/build.gradle
git commit -m "chore(mobile): instalar react-native-vector-icons + config Android"
```

---

## Task 2: Criar tokens de design

**Files:**
- Create: `mobile/src/theme.ts`

- [ ] **Step 1: Criar o arquivo**

```ts
export const darkTheme = {
  bg:            '#0d0f1a',
  surface:       '#151825',
  elevated:      '#1e2235',
  border:        'rgba(255,255,255,0.08)' as string,
  textPrimary:   '#ffffff',
  textSecondary: '#8b92a9',
  textMuted:     '#4a5068',
  accent:        '#6c5ce7',
  success:       '#22c55e',
  warning:       '#f59e0b',
  danger:        '#ef4444',
  info:          '#3b82f6',
} as const;

export const lightTheme = {
  bg:            '#f8fafc',
  surface:       '#ffffff',
  elevated:      '#f1f5f9',
  border:        '#e2e8f0',
  textPrimary:   '#0f172a',
  textSecondary: '#64748b',
  textMuted:     '#94a3b8',
  accent:        '#6c5ce7',
  success:       '#16a34a',
  warning:       '#d97706',
  danger:        '#dc2626',
  info:          '#0369a1',
} as const;

export type Theme = typeof darkTheme;
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/theme.ts
git commit -m "feat(mobile): tokens de design dark/light"
```

---

## Task 3: Criar ThemeContext

**Files:**
- Create: `mobile/src/contexts/ThemeContext.tsx`

- [ ] **Step 1: Criar o arquivo**

```tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkTheme, lightTheme, Theme } from '../theme';

interface ThemeContextValue {
  isDark: boolean;
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('theme').then((val) => {
      if (val === 'light') setIsDark(false);
    });
  }, []);

  const theme = isDark ? darkTheme : lightTheme;

  function toggleTheme() {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ isDark, theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/contexts/ThemeContext.tsx
git commit -m "feat(mobile): ThemeContext com toggle dark/light"
```

---

## Task 4: Atualizar App.tsx — ThemeProvider e aba Perfil

**Files:**
- Modify: `mobile/App.tsx`

- [ ] **Step 1: Substituir o arquivo inteiro**

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth }  from './src/contexts/AuthContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import LoginScreen             from './src/screens/LoginScreen';
import ForgotPasswordScreen    from './src/screens/ForgotPasswordScreen';
import DashboardScreen         from './src/screens/DashboardScreen';
import HistoryScreen           from './src/screens/HistoryScreen';
import ServicesScreen          from './src/screens/ServicesScreen';
import NotificationsScreen     from './src/screens/NotificationsScreen';
import ProfileScreen           from './src/screens/ProfileScreen';
import api                     from './src/services/api';

type Screen     = 'dashboard' | 'history' | 'services' | 'notifications' | 'profile';
type AuthScreen = 'login' | 'forgot-password';

function AppContent() {
  const { user, loading }               = useAuth();
  const { theme }                       = useTheme();
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
```

- [ ] **Step 2: Confirmar que o app ainda abre**

```bash
cd mobile && npm run android
```

- [ ] **Step 3: Commit**

```bash
git add mobile/App.tsx
git commit -m "feat(mobile): ThemeProvider + tela de perfil no AppContent"
```

---

## Task 5: Redesign LoginScreen

**Files:**
- Modify: `mobile/src/screens/LoginScreen.tsx`

- [ ] **Step 1: Substituir o arquivo inteiro**

```tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth }  from '../contexts/AuthContext';

interface Props { onForgotPassword: () => void; }

export default function LoginScreen({ onForgotPassword }: Props) {
  const { login }               = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Atenção', 'Preencha email e senha.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      Alert.alert('Erro', err?.response?.data?.error || 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.inner}>
        <View style={s.logo}><Text style={s.logoText}>P</Text></View>
        <Text style={s.title}>PontoTools</Text>
        <Text style={s.subtitle}>Entre com sua conta</Text>

        <TextInput
          style={s.input} placeholder="funcionario@empresa.com"
          placeholderTextColor="#4a5068" keyboardType="email-address"
          autoCapitalize="none" autoCorrect={false}
          value={email} onChangeText={setEmail}
        />
        <TextInput
          style={s.input} placeholder="••••••••"
          placeholderTextColor="#4a5068" secureTextEntry
          value={password} onChangeText={setPassword}
          onSubmitEditing={handleLogin} returnKeyType="done"
        />

        <TouchableOpacity
          style={[s.btn, loading && { opacity: 0.7 }]}
          onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#0d0f1a" />
            : <Text style={s.btnText}>Entrar →</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={s.forgot} onPress={onForgotPassword}>
          <Text style={s.forgotText}>Esqueceu a senha?</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#0d0f1a', justifyContent: 'center', padding: 24 },
  inner:      { alignItems: 'center' },
  logo:       { width: 56, height: 56, borderRadius: 14, backgroundColor: '#6c5ce7', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  logoText:   { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  title:      { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 4 },
  subtitle:   { fontSize: 13, color: '#8b92a9', marginBottom: 32 },
  input:      { width: '100%', padding: 13, backgroundColor: '#1e2235', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 14, color: '#fff', marginBottom: 12 },
  btn:        { width: '100%', backgroundColor: '#fff', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 4 },
  btnText:    { color: '#0d0f1a', fontWeight: '700', fontSize: 16 },
  forgot:     { marginTop: 20 },
  forgotText: { color: '#6c5ce7', fontSize: 13, fontWeight: '500' },
});
```

- [ ] **Step 2: Testar visualmente**

Abra o app e confirme: fundo escuro, logo roxa "P", título "PontoTools", inputs escuros, botão branco "Entrar →", link roxo.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/screens/LoginScreen.tsx
git commit -m "feat(mobile): redesign login tema escuro"
```

---

## Task 6: Redesign TabBar — Ionicons + 5 abas

**Files:**
- Modify: `mobile/src/components/TabBar.tsx`

- [ ] **Step 1: Substituir o arquivo inteiro**

```tsx
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
        const isActive   = active === screen;
        const showBadge  = screen === 'notifications' && unreadCount > 0;
        const color      = isActive ? theme.accent : theme.textMuted;
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
  bar:      { flexDirection: 'row', borderTopWidth: 1, paddingBottom: 6 },
  tab:      { flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 2 },
  iconWrap: { position: 'relative' },
  label:    { fontSize: 10, marginTop: 3, fontWeight: '600' },
  badge:    { position: 'absolute', top: -4, right: -8, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText:{ color: '#fff', fontSize: 9, fontWeight: 'bold' },
});
```

- [ ] **Step 2: Testar visualmente**

Confirme: 5 abas com ícones Ionicons, cor ativa em roxo, badge vermelho em Avisos quando há não lidas.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/components/TabBar.tsx
git commit -m "feat(mobile): TabBar Ionicons + 5 abas + tema escuro"
```

---

## Task 7: Redesign DashboardScreen

**Files:**
- Modify: `mobile/src/screens/DashboardScreen.tsx`

- [ ] **Step 1: Substituir o bloco de estilos e adicionar useTheme**

No topo do arquivo, adicione o import:
```tsx
import { useTheme } from '../contexts/ThemeContext';
```

Dentro de `DashboardScreen`, logo após a desestruturação de `useAuth()`, adicione:
```tsx
const { theme } = useTheme();
```

- [ ] **Step 2: Substituir o JSX de retorno completo**

Substitua tudo entre `return (` e o `);` final (antes dos StyleSheet.create) pelo seguinte:

```tsx
  const initials = user?.name
    ? user.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
    : '?';

  const DOT_COLOR: Record<string, string> = {
    entry: theme.success, break_start: theme.warning, break_end: theme.info, exit: theme.danger,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <TabBar active="dashboard" onNavigate={onNavigate} unreadCount={unreadCount} servicesOnly={servicesOnly} />

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Saudação */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View>
            <Text style={{ fontSize: 13, color: theme.textSecondary }}>Olá,</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: theme.textPrimary }}>{user?.name}</Text>
          </View>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.accent, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{initials}</Text>
          </View>
        </View>

        {/* Relógio */}
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 2, color: theme.accent, textTransform: 'uppercase', marginBottom: 4 }}>
            {now.toLocaleDateString('pt-BR', { weekday: 'long' }).toUpperCase()}
          </Text>
          <Text style={{ fontSize: 48, fontWeight: '800', color: theme.textPrimary, fontVariant: ['tabular-nums'], letterSpacing: 2, lineHeight: 56 }}>
            {formatInTimeZone(now, tz, 'HH:mm')}
            <Text style={{ fontSize: 26, color: theme.textPrimary, opacity: 0.5 }}>
              :{formatInTimeZone(now, tz, 'ss')}
            </Text>
          </Text>
          <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>
            {now.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
          </Text>
        </View>

        {/* Status GPS */}
        <View style={[{ borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: theme.border }, {
          backgroundColor: !requireLocation
            ? theme.surface
            : gpsOk ? (isInsideZone ? theme.success + '18' : theme.danger + '18') : theme.warning + '18',
        }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: !requireLocation ? theme.textMuted : gpsOk ? (isInsideZone ? theme.success : theme.danger) : theme.warning }} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textPrimary, flex: 1 }}>
              {!requireLocation && gpsStatus === 'granted' && `${Math.round(distanceMeters ?? 0)}m da unidade (localização livre)`}
              {!requireLocation && gpsStatus !== 'granted' && 'Localização livre — GPS não exigido'}
              {requireLocation && gpsStatus === 'loading'     && 'Obtendo localização...'}
              {requireLocation && gpsStatus === 'denied'      && 'GPS negado — habilite nas configurações'}
              {requireLocation && gpsStatus === 'unavailable' && 'GPS indisponível'}
              {requireLocation && gpsStatus === 'granted' && isInsideZone  && `Localização validada · ${Math.round(distanceMeters ?? 0)}m`}
              {requireLocation && gpsStatus === 'granted' && !isInsideZone && `Fora da zona — ${Math.round(distanceMeters ?? 0)}m (máx: ${user?.unit?.radiusMeters}m)`}
            </Text>
          </View>
        </View>

        {loading && <ActivityIndicator color={theme.accent} style={{ marginBottom: 16 }} />}

        {/* Botões de ponto */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          {CLOCK_TYPES.map((ct) => {
            const color       = theme[ct.colorKey as keyof typeof theme] as string;
            const seqDisabled = !available[ct.key as keyof Available];
            const disabled    = gpsBlocksButtons || seqDisabled || loading;
            return (
              <TouchableOpacity
                key={ct.key}
                onPress={() => handleClockPress(ct.key)}
                disabled={disabled}
                style={{
                  width: '47%', borderRadius: 14, borderWidth: 1.5,
                  borderColor: disabled ? theme.border : color + '55',
                  backgroundColor: disabled ? theme.elevated : color + '18',
                  paddingVertical: 24, alignItems: 'center', position: 'relative',
                  opacity: seqDisabled && !gpsBlocksButtons ? 0.45 : 1,
                }}>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: disabled ? theme.textMuted : color }}>
                  {ct.label}
                </Text>
                {requireLocation && !gpsOk && <Text style={{ position: 'absolute', top: 6, right: 6, fontSize: 12 }}>🔒</Text>}
                {(!requireLocation || gpsOk) && seqDisabled && <Text style={{ position: 'absolute', top: 6, right: 6, fontSize: 12 }}>⏸</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Registros de hoje */}
        {todayRecords.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Hoje</Text>
              <Text style={{ fontSize: 11, color: theme.accent }}>{todayRecords.length} registro{todayRecords.length > 1 ? 's' : ''}</Text>
            </View>
            <View style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
              {todayRecords.map((r, i) => (
                <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: i < todayRecords.length - 1 ? 1 : 0, borderBottomColor: theme.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: DOT_COLOR[r.clock_type] || theme.textMuted }} />
                    <Text style={{ color: theme.textPrimary, fontWeight: '500', fontSize: 13 }}>{LABELS[r.clock_type as ClockType] ?? r.clock_type}</Text>
                  </View>
                  <Text style={{ color: theme.textSecondary, fontWeight: 'bold', fontVariant: ['tabular-nums'], fontSize: 13 }}>
                    {formatInTimeZone(new Date(r.clocked_at_utc), r.timezone || 'America/Sao_Paulo', 'HH:mm')}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Modal de confirmação — mantém o mesmo código existente, só atualizar cores */}
      <Modal visible={confirmModal !== null} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: theme.textPrimary, marginBottom: 4 }}>
              Confirmar {confirmModal ? LABELS[confirmModal] : ''}
            </Text>
            <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 16, fontVariant: ['tabular-nums'] }}>
              {formatInTimeZone(now, tz, 'HH:mm:ss')} · {formatInTimeZone(now, tz, 'dd/MM/yyyy')}
            </Text>

            {photoUris.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {photoUris.map((uri, i) => (
                  <View key={i} style={{ marginRight: 8, position: 'relative' }}>
                    <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                    <TouchableOpacity
                      style={{ position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}
                      onPress={() => setPhotoUris((prev) => prev.filter((_, idx) => idx !== i))}>
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: cameraFacing === 'front' ? theme.accent : theme.border, backgroundColor: cameraFacing === 'front' ? theme.accent + '18' : theme.elevated, alignItems: 'center' }}
                onPress={() => handleSwitchAndShoot('front')} disabled={takingPhoto || photoUris.length >= maxPhotos}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textPrimary }}>🤳 Frontal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: cameraFacing === 'back' ? theme.accent : theme.border, backgroundColor: cameraFacing === 'back' ? theme.accent + '18' : theme.elevated, alignItems: 'center' }}
                onPress={() => handleSwitchAndShoot('back')} disabled={takingPhoto || photoUris.length >= maxPhotos}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textPrimary }}>📸 Traseira</Text>
              </TouchableOpacity>
            </View>

            {maxPhotos > 1 && (
              <Text style={{ textAlign: 'center', color: theme.textMuted, fontSize: 11, marginBottom: 12 }}>
                {photoUris.length}/{maxPhotos} foto{maxPhotos > 1 ? 's' : ''}
              </Text>
            )}

            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 6 }}>Observação (opcional)</Text>
            <TextInput
              style={{ borderWidth: 1.5, borderColor: theme.border, borderRadius: 10, padding: 12, fontSize: 14, color: theme.textPrimary, backgroundColor: theme.elevated, minHeight: 64, textAlignVertical: 'top' }}
              placeholder="Digite uma observação..." placeholderTextColor={theme.textMuted}
              value={observation} onChangeText={setObservation} multiline numberOfLines={2} maxLength={300}
            />
            <Text style={{ fontSize: 11, color: theme.textMuted, textAlign: 'right', marginTop: 4, marginBottom: 16 }}>{observation.length}/300</Text>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: theme.border, alignItems: 'center' }}
                onPress={() => { setConfirmModal(null); setGpsSnapshot(null); }}>
                <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 10, backgroundColor: theme.accent, alignItems: 'center' }}
                onPress={submitClock}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
```

- [ ] **Step 3: Atualizar CLOCK_TYPES para incluir colorKey**

Localize a constante `CLOCK_TYPES` e substitua por:

```tsx
const CLOCK_TYPES = [
  { key: 'entry',       label: 'Entrada',          colorKey: 'success' },
  { key: 'break_start', label: 'Início Intervalo',  colorKey: 'warning' },
  { key: 'break_end',   label: 'Fim Intervalo',     colorKey: 'info'    },
  { key: 'exit',        label: 'Saída',             colorKey: 'danger'  },
] as const;
```

- [ ] **Step 4: Remover StyleSheet.create(styles) e StyleSheet.create(modal) antigos**

Após as mudanças acima, os objetos `styles` e `modal` do `StyleSheet.create` ao final do arquivo não são mais referenciados. Remova-os completamente para evitar código morto.

- [ ] **Step 5: Testar visualmente**

Confirme: saudação + avatar, relógio grande com dia da semana em roxo, botões com cores corretas, registros de hoje com dots coloridos.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/screens/DashboardScreen.tsx
git commit -m "feat(mobile): redesign dashboard tema escuro"
```

---

## Task 8: Redesign HistoryScreen

**Files:**
- Modify: `mobile/src/screens/HistoryScreen.tsx`

- [ ] **Step 1: Substituir o arquivo inteiro**

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, RefreshControl, SafeAreaView, TouchableOpacity,
} from 'react-native';
import { formatInTimeZone } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import api from '../services/api';
import TabBar from '../components/TabBar';
import { useTheme } from '../contexts/ThemeContext';

type Screen = 'dashboard' | 'history' | 'services' | 'notifications' | 'profile';

const LABELS: Record<string, string> = {
  entry: 'Entrada', exit: 'Saída',
  break_start: 'Início intervalo', break_end: 'Fim intervalo',
};

interface ClockRecord {
  id: number;
  clock_type: string;
  clocked_at_utc: string;
  timezone: string;
  is_inside_zone: boolean;
  unit_name: string;
}

interface DateGroup { label: string; records: ClockRecord[]; }

function groupByDate(records: ClockRecord[]): DateGroup[] {
  const groups: Record<string, DateGroup> = {};
  records.forEach((r) => {
    const tz      = r.timezone || 'America/Sao_Paulo';
    const dateKey = formatInTimeZone(new Date(r.clocked_at_utc), tz, 'yyyy-MM-dd');
    if (!groups[dateKey]) {
      const todayKey = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
      const label    = dateKey === todayKey
        ? 'HOJE'
        : formatInTimeZone(new Date(r.clocked_at_utc), tz, 'dd MMM', { locale: ptBR }).toUpperCase();
      groups[dateKey] = { label, records: [] };
    }
    groups[dateKey].records.push(r);
  });
  return Object.values(groups);
}

export default function HistoryScreen({
  onNavigate, unreadCount = 0, servicesOnly = false,
}: {
  onNavigate: (s: Screen) => void;
  unreadCount?: number;
  servicesOnly?: boolean;
}) {
  const { theme }             = useTheme();
  const [records, setRecords] = useState<ClockRecord[]>([]);
  const [page, setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const DOT: Record<string, string> = {
    entry: theme.success, break_start: theme.warning, break_end: theme.info, exit: theme.danger,
  };

  const fetchRecords = useCallback(async (pageNum: number, reset = false) => {
    if (loading && !reset) return;
    setLoading(true);
    try {
      const { data } = await api.get('/clock/history', { params: { page: pageNum, limit: 20 } });
      setRecords((prev) => reset ? data.records : [...prev, ...data.records]);
      setTotalPages(data.pagination.totalPages);
      setPage(pageNum);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [loading]);

  useEffect(() => { fetchRecords(1, true); }, []);

  const groups = groupByDate(records);

  type ListItem = { type: 'header'; label: string } | { type: 'record'; record: ClockRecord };
  const flatItems: ListItem[] = groups.flatMap((g) => [
    { type: 'header' as const, label: g.label },
    ...g.records.map((r) => ({ type: 'record' as const, record: r })),
  ]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <TabBar active="history" onNavigate={onNavigate} unreadCount={unreadCount} servicesOnly={servicesOnly} />

      <FlatList
        data={flatItems}
        keyExtractor={(item, i) => item.type === 'header' ? `h-${i}` : String(item.record.id)}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRecords(1, true); }} colors={[theme.accent]} />
        }
        onEndReached={() => { if (page < totalPages && !loading) fetchRecords(page + 1); }}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: theme.accent, textTransform: 'uppercase', marginBottom: 2 }}>Meus registros</Text>
            <Text style={{ fontSize: 24, fontWeight: '800', color: theme.textPrimary, marginBottom: 20 }}>Histórico</Text>
          </>
        }
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return (
              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textMuted, letterSpacing: 1, textTransform: 'uppercase', paddingBottom: 6, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: theme.border, marginTop: 16 }}>
                {item.label}
              </Text>
            );
          }
          const r    = item.record;
          const tz   = r.timezone || 'America/Sao_Paulo';
          const time = formatInTimeZone(new Date(r.clocked_at_utc), tz, 'HH:mm');
          return (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: DOT[r.clock_type] || theme.textMuted }} />
                <Text style={{ fontSize: 13, color: theme.textPrimary, fontWeight: '500' }}>{LABELS[r.clock_type] ?? r.clock_type}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {!r.is_inside_zone && (
                  <View style={{ backgroundColor: theme.danger + '22', borderWidth: 1, borderColor: theme.danger + '55', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                    <Text style={{ color: theme.danger, fontSize: 9, fontWeight: '700' }}>Fora</Text>
                  </View>
                )}
                <Text style={{ fontSize: 13, color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>{time}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={loading ? null : (
          <Text style={{ textAlign: 'center', color: theme.textMuted, fontSize: 15, marginTop: 60 }}>Nenhum registro encontrado.</Text>
        )}
        ListFooterComponent={loading ? <ActivityIndicator style={{ margin: 16 }} color={theme.accent} /> : null}
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Testar visualmente**

Confirme: registros agrupados por data com cabeçalhos, dots coloridos por tipo, badge "Fora" em vermelho.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/screens/HistoryScreen.tsx
git commit -m "feat(mobile): redesign histórico com agrupamento por data"
```

---

## Task 9: Redesign NotificationsScreen

**Files:**
- Modify: `mobile/src/screens/NotificationsScreen.tsx`

- [ ] **Step 1: Adicionar import e hook de tema**

No topo do arquivo, adicione:
```tsx
import { useTheme } from '../contexts/ThemeContext';
```

Dentro de `NotificationsScreen`, adicione:
```tsx
const { theme } = useTheme();
```

- [ ] **Step 2: Substituir o JSX de retorno completo**

Substitua tudo entre `return (` e o `);` final por:

```tsx
  const TYPE_ICON: Record<string, { icon: string; bg: string }> = {
    service_assigned: { icon: '🔧', bg: theme.accent + '33' },
    service_delay:    { icon: '⚠️', bg: theme.warning + '33' },
    service_problem:  { icon: '❗', bg: theme.danger + '26' },
    default:          { icon: '📢', bg: theme.textMuted + '26' },
  };

  function getIcon(type: string) {
    return TYPE_ICON[type] || TYPE_ICON.default;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <TabBar active="notifications" onNavigate={onNavigate} unreadCount={unreadCount} servicesOnly={servicesOnly} />

      {unreadCount > 0 && (
        <TouchableOpacity
          style={{ backgroundColor: theme.accent + '18', borderWidth: 1, borderColor: theme.accent + '44', margin: 12, marginBottom: 0, borderRadius: 10, padding: 12, alignItems: 'center' }}
          onPress={markAllRead}>
          <Text style={{ color: theme.accent, fontWeight: '700', fontSize: 13 }}>Marcar todas como lidas ({unreadCount})</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadNotifications(true); }} colors={[theme.accent]} />
        }
        ListHeaderComponent={
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <View>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: theme.accent, textTransform: 'uppercase', marginBottom: 2 }}>Avisos</Text>
              <Text style={{ fontSize: 24, fontWeight: '800', color: theme.textPrimary }}>Notificações</Text>
            </View>
            {unreadCount > 0 && (
              <View style={{ backgroundColor: theme.success, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{unreadCount} nova{unreadCount > 1 ? 's' : ''}</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const { icon, bg } = getIcon(item.type);
          return (
            <TouchableOpacity
              style={{ flexDirection: 'row', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: theme.border }}
              onPress={() => !item.read && markRead(item.id)}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: bg, justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                <Text style={{ fontSize: 16 }}>{icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: item.read ? '500' : '700', color: theme.textPrimary, marginBottom: 2 }}>
                  {item.title}
                  {!item.read && <Text style={{ color: theme.accent }}> •</Text>}
                </Text>
                <Text style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 17, marginBottom: 3 }} numberOfLines={2}>{item.body}</Text>
                <Text style={{ fontSize: 10, color: theme.textMuted }}>{fmtRelative(item.created_at)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          loading ? null : (
            <Text style={{ textAlign: 'center', color: theme.textMuted, fontSize: 15, marginTop: 60 }}>Nenhum aviso recebido.</Text>
          )
        }
        ListFooterComponent={loading ? <ActivityIndicator style={{ margin: 16 }} color={theme.accent} /> : null}
      />
    </View>
  );
```

- [ ] **Step 3: Remover o StyleSheet.create antigo**

O `StyleSheet.create` ao final do arquivo não é mais usado. Remova-o.

- [ ] **Step 4: Testar visualmente**

Confirme: header "AVISOS / Notificações" com badge verde, ícones coloridos em círculo, dots para não lidas.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/NotificationsScreen.tsx
git commit -m "feat(mobile): redesign notificações tema escuro"
```

---

## Task 10: Criar ProfileScreen

**Files:**
- Create: `mobile/src/screens/ProfileScreen.tsx`

- [ ] **Step 1: Criar o arquivo**

```tsx
import React from 'react';
import {
  View, Text, TouchableOpacity, SafeAreaView, ScrollView, Alert,
} from 'react-native';
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
  const { user, logout }             = useAuth();
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
      <TabBar active="profile" onNavigate={onNavigate} unreadCount={unreadCount} servicesOnly={servicesOnly} />

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
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Testar visualmente**

Abra a aba Perfil. Confirme: avatar com iniciais, dados do usuário, toggle funcional (alterna tema imediatamente), botão de logout com confirmação.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/screens/ProfileScreen.tsx
git commit -m "feat(mobile): tela de perfil com toggle de tema"
```

---

## Task 11: Build final e verificação

- [ ] **Step 1: Compilar o app em modo debug**

```bash
cd mobile && npm run android
```

Expected: build sem erros. Se houver erro de tipo TypeScript, corrija antes de continuar.

- [ ] **Step 2: Testar fluxo completo**

Percorra todas as abas: Login → Dashboard → Histórico → Serviços → Avisos → Perfil. Confirme:
- Tema escuro ativo por padrão
- Toggle em Perfil alterna dark/light imediatamente
- Preferência persiste após fechar e reabrir o app
- Ícones Ionicons em todas as abas

- [ ] **Step 3: Commit final**

```bash
git add -A
git commit -m "feat(mobile): redesign tema escuro completo telas do funcionário"
```
