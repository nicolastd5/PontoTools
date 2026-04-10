# Mobile Android (React Native) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar app Android em React Native para funcionários baterem ponto com GPS e foto, distribuído via APK direto.

**Architecture:** App standalone na pasta `mobile/` do monorepo, conectado ao mesmo backend Express via HTTP. Auth por JWT em AsyncStorage + interceptor axios para renovação automática. GPS e câmera via libs nativas do React Native.

**Tech Stack:** React Native 0.74, TypeScript, react-navigation 6, axios, react-native-geolocation-service, react-native-vision-camera v4, @react-native-async-storage/async-storage, date-fns + date-fns-tz.

---

## Pré-requisitos (fazer manualmente antes de começar)

Instalar no Windows:
1. **Node.js 20** — já instalado (usado no backend)
2. **Android Studio** — baixar em https://developer.android.com/studio
   - Durante instalação: marcar "Android SDK", "Android SDK Platform", "Android Virtual Device"
   - Após instalar: Android Studio → SDK Manager → SDK Platforms → instalar **Android 14 (API 34)**
   - SDK Tools → instalar **Android SDK Build-Tools 34**
3. **Java 17** — vem com Android Studio (usar o bundled JDK)
4. **Variáveis de ambiente** — adicionar ao PATH do Windows:
   ```
   ANDROID_HOME = C:\Users\nicol\AppData\Local\Android\Sdk
   PATH += %ANDROID_HOME%\platform-tools
   PATH += %ANDROID_HOME%\emulator
   ```
5. Reiniciar o terminal após configurar variáveis

Verificar instalação:
```bash
adb --version          # deve aparecer versão
java --version         # deve mostrar Java 17
node --version         # deve mostrar v20.x
```

---

## Task 1: Patch no backend — refresh token via body

**Files:**
- Modify: `backend/controllers/auth.controller.js` (função `refresh`, linha ~99)

- [ ] **Step 1: Abrir o arquivo e localizar a linha do rawToken**

```bash
grep -n "rawToken" backend/controllers/auth.controller.js
```
Saída esperada: `99:    const rawToken = req.cookies?.refreshToken;`

- [ ] **Step 2: Alterar a linha para aceitar cookie OU body**

No arquivo `backend/controllers/auth.controller.js`, linha ~99, trocar:
```js
const rawToken = req.cookies?.refreshToken;
```
por:
```js
const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;
```

- [ ] **Step 3: Testar manualmente que o web ainda funciona**

Abrir o site no browser → fazer login → navegar pelas páginas por alguns minutos (o refresh token é usado automaticamente quando o access token expira em 15min). Sem erro 401 = OK.

- [ ] **Step 4: Commit**

```bash
git add backend/controllers/auth.controller.js
git commit -m "feat: aceitar refresh token via body para clientes mobile"
```

---

## Task 2: Scaffolding do projeto React Native

**Files:**
- Create: `mobile/` (projeto inteiro via CLI)

- [ ] **Step 1: Criar o projeto React Native com TypeScript**

```bash
cd c:/Users/nicol/Downloads/PontoTools
npx @react-native-community/cli@latest init PontoMobile --template react-native-template-typescript --directory mobile --skip-install
```

> Se perguntar "ok to proceed?", digitar `y`.

- [ ] **Step 2: Instalar dependências base**

```bash
cd mobile
npm install
npm install axios @react-native-async-storage/async-storage react-native-geolocation-service react-native-vision-camera@4 date-fns date-fns-tz
npm install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context react-native-gesture-handler react-native-reanimated
```

- [ ] **Step 3: Verificar que o projeto compila (sem emulador ainda)**

```bash
cd mobile
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output /tmp/test.bundle
```
Esperado: sem erros de compilação TypeScript. Avisos são OK.

- [ ] **Step 4: Commit do scaffold**

```bash
cd ..
git add mobile/
git commit -m "feat: scaffold do projeto React Native (mobile)"
```

---

## Task 3: Serviço de API (axios + interceptor de auth)

**Files:**
- Create: `mobile/src/services/api.ts`

- [ ] **Step 1: Criar o diretório e o arquivo**

```bash
mkdir -p mobile/src/services
```

Criar `mobile/src/services/api.ts`:

```typescript
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Troque pelo IP da sua instância AWS enquanto não tiver domínio
export const BASE_URL = 'http://SEU_IP_AWS:3001';

const api = axios.create({
  baseURL: BASE_URL + '/api',
  timeout: 15000,
});

// Injeta o access token em toda requisição
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Renova o access token automaticamente quando recebe 401
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('Sem refresh token');

        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, {
          refreshToken,
        });

        await AsyncStorage.setItem('accessToken', data.accessToken);
        processQueue(null, data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (err) {
        processQueue(err, null);
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
        // AuthContext vai detectar ausência do token e redirecionar para Login
        throw err;
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
```

- [ ] **Step 2: Substituir `SEU_IP_AWS` pelo IP real**

```bash
# Descobrir o IP público da instância (rodar no terminal local, não no servidor)
# Ou olhar no painel da AWS EC2 → "Public IPv4 address"
# Editar mobile/src/services/api.ts e trocar SEU_IP_AWS pelo IP
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/services/api.ts
git commit -m "feat: serviço axios com interceptor de refresh token para mobile"
```

---

## Task 4: AuthContext — estado de autenticação

**Files:**
- Create: `mobile/src/contexts/AuthContext.tsx`

- [ ] **Step 1: Criar o diretório e o arquivo**

```bash
mkdir -p mobile/src/contexts
```

Criar `mobile/src/contexts/AuthContext.tsx`:

```typescript
import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  unitId: number;
  unitName: string;
  unitCode: string;
  unit: {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
  } | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restaura sessão ao abrir o app
  useEffect(() => {
    AsyncStorage.getItem('user').then((stored) => {
      if (stored) setUser(JSON.parse(stored));
      setLoading(false);
    });
  }, []);

  async function login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password });

    await AsyncStorage.multiSet([
      ['accessToken',  data.accessToken],
      ['refreshToken', data.refreshToken ?? ''],
      ['user',         JSON.stringify(data.user)],
    ]);

    // Busca detalhes da unidade para usar no GPS
    const unitRes = await api.get(`/units/${data.user.unitId}`);
    const unit = unitRes.data;

    const fullUser: User = {
      ...data.user,
      unit: {
        id:           unit.id,
        name:         unit.name,
        latitude:     parseFloat(unit.latitude),
        longitude:    parseFloat(unit.longitude),
        radiusMeters: unit.radius_meters,
      },
    };

    await AsyncStorage.setItem('user', JSON.stringify(fullUser));
    setUser(fullUser);
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignora erros de rede no logout
    }
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

> **Nota:** O backend retorna o refresh token no body? Não — ele só seta o cookie. Precisaremos extrair o refresh token do header `Set-Cookie` ou, mais simples: o backend retorna o `accessToken` no body, e para mobile a sessão dura enquanto o access token for válido (15min), renovando via refresh endpoint. Mas o refresh token precisa ser salvo. Veja Task 4-A abaixo.

- [ ] **Step 2: Commit**

```bash
git add mobile/src/contexts/AuthContext.tsx
git commit -m "feat: AuthContext com persistência de sessão em AsyncStorage"
```

---

## Task 4-A: Patch adicional no backend — expor refresh token no body do login

**Files:**
- Modify: `backend/controllers/auth.controller.js` (função `login`, linha ~75)

O login atual retorna apenas o `accessToken` no body; o `refreshToken` vai só no cookie. Mobile precisa receber o refresh token no body para salvá-lo.

- [ ] **Step 1: Localizar o return do login**

```bash
grep -n "accessToken" backend/controllers/auth.controller.js
```

- [ ] **Step 2: Adicionar `refreshToken` ao body de resposta**

No arquivo `backend/controllers/auth.controller.js`, dentro da função `login`, localizar o `res.json({...})` e adicionar `refreshToken`:

```js
res.json({
  accessToken,
  refreshToken: refreshTokenRaw,   // <-- adicionar esta linha
  user: {
    id:          employee.id,
    name:        employee.full_name,
    email:       employee.email,
    role:        employee.role,
    badgeNumber: employee.badge_number,
    unitId:      employee.unit_id,
    unitName:    employee.unit_name,
    unitCode:    employee.unit_code,
    contractId:  employee.contract_id || null,
  },
});
```

O web ignora o campo extra. Mobile vai usar.

- [ ] **Step 3: Commit**

```bash
git add backend/controllers/auth.controller.js
git commit -m "feat: expor refreshToken no body do login para clientes mobile"
```

---

## Task 5: Hook de geolocalização nativa

**Files:**
- Create: `mobile/src/hooks/useGeolocation.ts`

- [ ] **Step 1: Criar o diretório e arquivo**

```bash
mkdir -p mobile/src/hooks
```

Criar `mobile/src/hooks/useGeolocation.ts`:

```typescript
import { useState, useEffect, useRef } from 'react';
import Geolocation from 'react-native-geolocation-service';
import { PermissionsAndroid, Platform } from 'react-native';

interface Unit {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

interface Coords {
  latitude: number;
  longitude: number;
  accuracy: number;
}

type GpsStatus = 'loading' | 'granted' | 'denied' | 'unavailable';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useGeolocation(unit: Unit | null | undefined) {
  const [status, setStatus]               = useState<GpsStatus>('loading');
  const [coords, setCoords]               = useState<Coords | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Permissão de Localização',
            message: 'O app precisa da sua localização para registrar o ponto.',
            buttonPositive: 'Permitir',
            buttonNegative: 'Negar',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          if (!cancelled) setStatus('denied');
          return;
        }
      }

      watchIdRef.current = Geolocation.watchPosition(
        (position) => {
          if (cancelled) return;
          const { latitude, longitude, accuracy } = position.coords;
          setCoords({ latitude, longitude, accuracy });
          setStatus('granted');

          if (unit?.latitude && unit?.longitude) {
            const dist = haversineDistance(latitude, longitude, unit.latitude, unit.longitude);
            setDistanceMeters(Math.round(dist * 10) / 10);
          }
        },
        (err) => {
          if (cancelled) return;
          setStatus(err.code === 1 ? 'denied' : 'unavailable');
          setCoords(null);
        },
        { enableHighAccuracy: true, distanceFilter: 5, interval: 5000, fastestInterval: 2000 },
      );
    }

    start();

    return () => {
      cancelled = true;
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [unit]);

  const isInsideZone = Boolean(
    unit?.radiusMeters &&
    distanceMeters !== null &&
    distanceMeters <= unit.radiusMeters,
  );

  return { status, coords, distanceMeters, isInsideZone };
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/hooks/useGeolocation.ts
git commit -m "feat: hook de geolocalização nativa Android com validação de zona"
```

---

## Task 6: Navegação (AppNavigator)

**Files:**
- Create: `mobile/src/navigation/AppNavigator.tsx`
- Modify: `mobile/index.js`
- Modify: `mobile/App.tsx` (ou criar se não existir)

- [ ] **Step 1: Criar o navegador**

```bash
mkdir -p mobile/src/navigation
```

Criar `mobile/src/navigation/AppNavigator.tsx`:

```typescript
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import HistoryScreen from '../screens/HistoryScreen';

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle:     { backgroundColor: '#1d4ed8' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        tabBarActiveTintColor:   '#1d4ed8',
        tabBarInactiveTintColor: '#94a3b8',
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Ponto', tabBarLabel: 'Ponto' }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: 'Histórico', tabBarLabel: 'Histórico' }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="App" component={AppTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 2: Atualizar App.tsx para usar AuthProvider + AppNavigator**

Substituir o conteúdo de `mobile/App.tsx` por:

```typescript
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/navigation/AppNavigator.tsx mobile/App.tsx
git commit -m "feat: navegação stack+tabs com proteção de rota por auth"
```

---

## Task 7: LoginScreen

**Files:**
- Create: `mobile/src/screens/LoginScreen.tsx`

- [ ] **Step 1: Criar o diretório e arquivo**

```bash
mkdir -p mobile/src/screens
```

Criar `mobile/src/screens/LoginScreen.tsx`:

```typescript
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function LoginScreen() {
  const { login }          = useAuth();
  const [email, setEmail]  = useState('');
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
      // AuthContext atualiza `user` → AppNavigator redireciona automaticamente
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Erro ao fazer login. Tente novamente.';
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <View style={styles.logoBox}>
          <Text style={styles.logoLetter}>P</Text>
        </View>
        <Text style={styles.title}>Ponto Eletrônico</Text>
        <Text style={styles.subtitle}>Acesse com suas credenciais</Text>

        <TextInput
          style={styles.input}
          placeholder="seu.email@empresa.com"
          placeholderTextColor="#94a3b8"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Senha"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={handleLogin}
        />

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Entrar</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#f1f5f9', justifyContent: 'center', padding: 24 },
  card:     { backgroundColor: '#fff', borderRadius: 16, padding: 28, elevation: 4 },
  logoBox:  {
    width: 56, height: 56, borderRadius: 14, backgroundColor: '#1d4ed8',
    justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16,
  },
  logoLetter:  { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  title:       { fontSize: 22, fontWeight: 'bold', color: '#0f172a', textAlign: 'center' },
  subtitle:    { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24, marginTop: 4 },
  input:       {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10,
    padding: 14, fontSize: 15, color: '#0f172a', marginBottom: 12,
  },
  btn:         {
    backgroundColor: '#1d4ed8', borderRadius: 10,
    padding: 15, alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/screens/LoginScreen.tsx
git commit -m "feat: tela de login do app mobile"
```

---

## Task 8: DashboardScreen — bater ponto com GPS + câmera

**Files:**
- Create: `mobile/src/screens/DashboardScreen.tsx`

- [ ] **Step 1: Criar o arquivo**

Criar `mobile/src/screens/DashboardScreen.tsx`:

```typescript
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { formatInTimeZone } from 'date-fns-tz';
import { useAuth } from '../contexts/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import api from '../services/api';

const CLOCK_TYPES = [
  { key: 'entry',       label: 'Entrada',          color: '#16a34a', bg: '#f0fdf4' },
  { key: 'break_start', label: 'Início Intervalo', color: '#d97706', bg: '#fffbeb' },
  { key: 'break_end',   label: 'Fim Intervalo',    color: '#0369a1', bg: '#f0f9ff' },
  { key: 'exit',        label: 'Saída',            color: '#dc2626', bg: '#fef2f2' },
] as const;

type ClockType = typeof CLOCK_TYPES[number]['key'];

const LABELS: Record<ClockType, string> = {
  entry: 'Entrada', exit: 'Saída',
  break_start: 'Início intervalo', break_end: 'Fim intervalo',
};

export default function DashboardScreen() {
  const { user, logout }    = useAuth();
  const { status: gpsStatus, coords, distanceMeters, isInsideZone } = useGeolocation(user?.unit);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const cameraRef = useRef<Camera>(null);

  const [showCamera, setShowCamera]   = useState(false);
  const [clockingFor, setClockingFor] = useState<ClockType | null>(null);
  const [loading, setLoading]         = useState(false);
  const [todayRecords, setTodayRecords] = useState<any[]>([]);

  // Busca registros de hoje ao montar
  React.useEffect(() => {
    api.get('/clock/today').then((r) => setTodayRecords(r.data.records || [])).catch(() => {});
  }, []);

  async function handleClockPress(clockType: ClockType) {
    if (gpsStatus !== 'granted') {
      Alert.alert('GPS necessário', 'Habilite a localização para registrar o ponto.');
      return;
    }
    if (!isInsideZone) {
      Alert.alert(
        'Fora da zona',
        `Você está a ${Math.round(distanceMeters ?? 0)}m da unidade. Máximo: ${user?.unit?.radiusMeters}m.`,
      );
      return;
    }

    if (!hasPermission) {
      const ok = await requestPermission();
      if (!ok) {
        Alert.alert('Câmera necessária', 'Permita o acesso à câmera para registrar o ponto.');
        return;
      }
    }

    setClockingFor(clockType);
    setShowCamera(true);
  }

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || !clockingFor || !coords) return;

    setLoading(true);
    setShowCamera(false);

    try {
      const photo = await cameraRef.current.takePhoto({ qualityPrioritization: 'speed' });
      const tz    = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const formData = new FormData();
      formData.append('clock_type', clockingFor);
      formData.append('latitude',   String(coords.latitude));
      formData.append('longitude',  String(coords.longitude));
      formData.append('accuracy',   String(coords.accuracy ?? ''));
      formData.append('timezone',   tz);
      formData.append('photo', {
        uri:  `file://${photo.path}`,
        type: 'image/jpeg',
        name: 'photo.jpg',
      } as any);

      const res = await api.post('/clock', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const newRecord = res.data;
      setTodayRecords((prev) => [
        ...prev,
        {
          id:            newRecord.id,
          clock_type:    newRecord.clockType,
          clocked_at_utc: newRecord.clockedAtUtc,
          timezone:      tz,
          is_inside_zone: newRecord.isInsideZone,
          distance_meters: newRecord.distanceMeters,
        },
      ]);

      Alert.alert('Ponto registrado!', `${LABELS[clockingFor]} às ${
        formatInTimeZone(new Date(newRecord.clockedAtUtc), tz, 'HH:mm')
      }`);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.blocked && data?.reason === 'outside_zone') {
        Alert.alert('Bloqueado', `Você está a ${Math.round(data.distanceMeters)}m da unidade.`);
      } else {
        Alert.alert('Erro', data?.error || 'Erro ao registrar ponto.');
      }
    } finally {
      setLoading(false);
      setClockingFor(null);
    }
  }, [cameraRef, clockingFor, coords]);

  const gpsOk = gpsStatus === 'granted';

  // Tela de câmera
  if (showCamera && device) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <Camera
          ref={cameraRef}
          style={{ flex: 1 }}
          device={device}
          isActive={true}
          photo={true}
        />
        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowCamera(false); setClockingFor(null); }}>
            <Text style={{ color: '#fff', fontSize: 16 }}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.captureBtn} onPress={handleCapture} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <View style={styles.captureInner} />}
          </TouchableOpacity>
          <View style={{ width: 80 }} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16 }}>
      {/* Status do GPS */}
      <View style={[styles.gpsBox, { backgroundColor: gpsOk ? (isInsideZone ? '#f0fdf4' : '#fef2f2') : '#fef9c3' }]}>
        <Text style={[styles.gpsText, { color: gpsOk ? (isInsideZone ? '#16a34a' : '#dc2626') : '#92400e' }]}>
          {gpsStatus === 'loading'     && '⏳ Obtendo localização...'}
          {gpsStatus === 'denied'      && '🔒 GPS negado — habilite nas configurações'}
          {gpsStatus === 'unavailable' && '📡 GPS indisponível'}
          {gpsStatus === 'granted' && isInsideZone  && `✅ Dentro da zona (${Math.round(distanceMeters ?? 0)}m)`}
          {gpsStatus === 'granted' && !isInsideZone && `⛔ Fora da zona — ${Math.round(distanceMeters ?? 0)}m (máx: ${user?.unit?.radiusMeters}m)`}
        </Text>
      </View>

      {/* Botões de ponto */}
      <View style={styles.grid}>
        {CLOCK_TYPES.map((ct) => {
          const disabled = !gpsOk || !isInsideZone || loading;
          return (
            <TouchableOpacity
              key={ct.key}
              onPress={() => handleClockPress(ct.key)}
              disabled={disabled}
              style={[
                styles.clockBtn,
                { backgroundColor: disabled ? '#f1f5f9' : ct.bg, borderColor: disabled ? '#e2e8f0' : ct.color + '40' },
              ]}
            >
              <Text style={[styles.clockLabel, { color: disabled ? '#94a3b8' : ct.color }]}>{ct.label}</Text>
              {!gpsOk && <Text style={styles.lock}>🔒</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Registros de hoje */}
      {todayRecords.length > 0 && (
        <View style={styles.todayBox}>
          <Text style={styles.todayTitle}>Registros de Hoje</Text>
          {todayRecords.map((r) => (
            <View key={r.id} style={styles.todayRow}>
              <Text style={styles.todayType}>{LABELS[r.clock_type as ClockType]}</Text>
              <Text style={styles.todayTime}>
                {formatInTimeZone(new Date(r.clocked_at_utc), r.timezone || 'America/Sao_Paulo', 'HH:mm')}
              </Text>
              <View style={[styles.dot, { backgroundColor: r.is_inside_zone ? '#16a34a' : '#dc2626' }]} />
            </View>
          ))}
        </View>
      )}

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sair</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:            { flex: 1, backgroundColor: '#f8fafc' },
  gpsBox:          { borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  gpsText:         { fontSize: 14, fontWeight: '600' },
  grid:            { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  clockBtn:        {
    width: '47%', borderRadius: 14, borderWidth: 2,
    paddingVertical: 24, alignItems: 'center', position: 'relative',
  },
  clockLabel:      { fontSize: 14, fontWeight: 'bold' },
  lock:            { position: 'absolute', top: 6, right: 6, fontSize: 12 },
  todayBox:        { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', marginBottom: 16 },
  todayTitle:      { fontSize: 14, fontWeight: 'bold', color: '#0f172a', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  todayRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  todayType:       { color: '#374151', fontWeight: '500', flex: 1 },
  todayTime:       { color: '#0f172a', fontWeight: 'bold', marginRight: 10 },
  dot:             { width: 8, height: 8, borderRadius: 4 },
  logoutBtn:       { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 32 },
  logoutText:      { color: '#64748b', fontWeight: '600' },
  cameraControls:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.7)' },
  cancelBtn:       { width: 80, alignItems: 'flex-start' },
  captureBtn:      { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff' },
  captureInner:    { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff' },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/screens/DashboardScreen.tsx
git commit -m "feat: tela de batida de ponto com GPS e câmera nativa"
```

---

## Task 9: HistoryScreen — histórico de registros

**Files:**
- Create: `mobile/src/screens/HistoryScreen.tsx`

- [ ] **Step 1: Criar o arquivo**

Criar `mobile/src/screens/HistoryScreen.tsx`:

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, TouchableOpacity, RefreshControl,
} from 'react-native';
import { formatInTimeZone } from 'date-fns-tz';
import api from '../services/api';

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
  distance_meters: number;
  unit_name: string;
}

export default function HistoryScreen() {
  const [records, setRecords]     = useState<ClockRecord[]>([]);
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRecords = useCallback(async (pageNum: number, reset = false) => {
    if (loading && !reset) return;
    setLoading(true);
    try {
      const { data } = await api.get('/clock/history', { params: { page: pageNum, limit: 20 } });
      setRecords((prev) => reset ? data.records : [...prev, ...data.records]);
      setTotalPages(data.pagination.totalPages);
      setPage(pageNum);
    } catch {
      // erro silencioso — usuário pode puxar para atualizar
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loading]);

  useEffect(() => { fetchRecords(1, true); }, []);

  function handleRefresh() {
    setRefreshing(true);
    fetchRecords(1, true);
  }

  function handleLoadMore() {
    if (page < totalPages && !loading) {
      fetchRecords(page + 1);
    }
  }

  function renderItem({ item }: { item: ClockRecord }) {
    const tz = item.timezone || 'America/Sao_Paulo';
    const date = formatInTimeZone(new Date(item.clocked_at_utc), tz, 'dd/MM/yyyy');
    const time = formatInTimeZone(new Date(item.clocked_at_utc), tz, 'HH:mm');

    return (
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <Text style={styles.rowType}>{LABELS[item.clock_type] ?? item.clock_type}</Text>
          <Text style={styles.rowUnit}>{item.unit_name}</Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={styles.rowDate}>{date}</Text>
          <Text style={styles.rowTime}>{time}</Text>
          <View style={[styles.dot, { backgroundColor: item.is_inside_zone ? '#16a34a' : '#dc2626' }]} />
        </View>
      </View>
    );
  }

  return (
    <FlatList
      data={records}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#1d4ed8']} />}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.3}
      ListEmptyComponent={
        loading ? null : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nenhum registro encontrado.</Text>
          </View>
        )
      }
      ListFooterComponent={
        loading ? <ActivityIndicator style={{ margin: 16 }} color="#1d4ed8" /> : null
      }
    />
  );
}

const styles = StyleSheet.create({
  list:      { padding: 16, backgroundColor: '#f8fafc' },
  row:       {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0',
    padding: 14, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  rowLeft:   { flex: 1 },
  rowRight:  { alignItems: 'flex-end', gap: 4 },
  rowType:   { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  rowUnit:   { fontSize: 12, color: '#64748b', marginTop: 2 },
  rowDate:   { fontSize: 12, color: '#64748b' },
  rowTime:   { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  dot:       { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  empty:     { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#94a3b8', fontSize: 15 },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/screens/HistoryScreen.tsx
git commit -m "feat: tela de histórico de registros com paginação"
```

---

## Task 10: Permissões e configuração nativa do Android

**Files:**
- Modify: `mobile/android/app/src/main/AndroidManifest.xml`
- Modify: `mobile/android/app/build.gradle`

- [ ] **Step 1: Adicionar permissões ao AndroidManifest**

Abrir `mobile/android/app/src/main/AndroidManifest.xml` e adicionar dentro de `<manifest>`, antes de `<application>`:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

- [ ] **Step 2: Configurar react-native-geolocation-service**

Abrir `mobile/android/app/build.gradle` e adicionar dentro de `android { defaultConfig { ... } }`:

```gradle
missingDimensionStrategy 'react-native-camera', 'general'
```

- [ ] **Step 3: Linkar react-native-vision-camera**

```bash
cd mobile
npx react-native setup-ios-permissions  # pode ignorar erros iOS
```

Abrir `mobile/android/app/build.gradle` e verificar que `minSdkVersion` é pelo menos **23**. Se for menor, trocar para 23.

- [ ] **Step 4: Commit**

```bash
git add mobile/android/
git commit -m "chore: permissões Android para GPS, câmera e internet"
```

---

## Task 11: Verificar endpoint de unidade no backend

**Files:**
- Check: `backend/routes/` — verificar se existe rota `GET /api/units/:id`

- [ ] **Step 1: Verificar se a rota existe**

```bash
grep -rn "router.get.*/:id" backend/routes/unit.routes.js
```

- [ ] **Step 2: Se não existir, adicionar ao controller e rota**

No arquivo `backend/controllers/unit.controller.js`, adicionar:

```js
async function getOne(req, res, next) {
  try {
    const result = await db.query(
      `SELECT id, name, code, latitude, longitude, radius_meters, address, active
       FROM units WHERE id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Unidade não encontrada.' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
}
module.exports = { ..., getOne };  // adicionar getOne ao exports existentes
```

No arquivo `backend/routes/unit.routes.js`, adicionar:

```js
router.get('/:id', auth, controller.getOne);
```

- [ ] **Step 3: Commit (se adicionou)**

```bash
git add backend/controllers/unit.controller.js backend/routes/unit.routes.js
git commit -m "feat: endpoint GET /api/units/:id para app mobile"
```

---

## Task 12: Build e teste no emulador Android

- [ ] **Step 1: Iniciar o emulador Android**

No Android Studio → Device Manager → criar emulador Pixel 7 (API 34) se não existir → Start.

Ou via terminal:
```bash
emulator -avd Pixel_7_API_34
```

- [ ] **Step 2: Confirmar que o emulador está visível ao ADB**

```bash
adb devices
# Deve aparecer: emulator-5554   device
```

- [ ] **Step 3: Rodar o app no emulador**

```bash
cd mobile
npx react-native run-android
```

Esperado: app instala e abre no emulador. Tela de login aparece.

- [ ] **Step 4: Testar fluxo completo**

1. Login com email e senha de um funcionário cadastrado
2. Verificar que GPS aparece (no emulador: Extended Controls → Location → enviar coordenadas próximas da unidade)
3. Clicar em Entrada → câmera abre → tirar foto → ponto registrado
4. Verificar registro em Histórico
5. Fazer logout

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: ajustes pós-teste no emulador Android"
```

---

## Task 13: Build do APK de release

- [ ] **Step 1: Gerar keystore para assinatura (fazer apenas uma vez)**

```bash
cd mobile/android
keytool -genkeypair -v -storetype PKCS12 -keystore ponto-release.keystore -alias ponto -keyalg RSA -keysize 2048 -validity 10000
```

Guardar a senha digitada — necessária para todos os builds futuros.

- [ ] **Step 2: Configurar assinatura no gradle**

Criar `mobile/android/key.properties`:
```properties
storePassword=SUA_SENHA
keyPassword=SUA_SENHA
keyAlias=ponto
storeFile=ponto-release.keystore
```

No arquivo `mobile/android/app/build.gradle`, adicionar antes de `android {`:
```gradle
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

E dentro de `android { ... }`:
```gradle
signingConfigs {
    release {
        keyAlias keystoreProperties['keyAlias']
        keyPassword keystoreProperties['keyPassword']
        storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
        storePassword keystoreProperties['storePassword']
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled true
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
}
```

- [ ] **Step 3: Adicionar key.properties ao .gitignore**

```bash
echo "mobile/android/key.properties" >> .gitignore
echo "mobile/android/ponto-release.keystore" >> .gitignore
git add .gitignore
git commit -m "chore: ignorar keystore e key.properties do git"
```

- [ ] **Step 4: Gerar o APK**

```bash
cd mobile/android
./gradlew assembleRelease
```

APK gerado em: `mobile/android/app/build/outputs/apk/release/app-release.apk`

- [ ] **Step 5: Testar o APK num celular Android real**

Copiar o APK para o celular (Google Drive, WhatsApp, e-mail ou cabo USB).
No celular: Configurações → Segurança → Instalar apps de fontes desconhecidas → ativar para o app usado para abrir o APK.
Instalar e testar fluxo completo: login → GPS real → câmera → bater ponto → ver histórico.

---

## Notas finais

**IP do backend:** enquanto não houver domínio/HTTPS, o app usa o IP público da AWS. Quando migrar para domínio com SSL, trocar `BASE_URL` em `mobile/src/services/api.ts`.

**iOS (futuro):** o código das telas e lógica é 100% reaproveitado. Adicionar pasta `ios/` via `npx react-native setup-ios-permissions`, configurar `Info.plist` com permissões de GPS e câmera, compilar no Mac com Xcode.

**Kotlin (futuro):** se precisar de widgets, notificações avançadas ou performance crítica, o backend permanece igual — só o cliente muda.
