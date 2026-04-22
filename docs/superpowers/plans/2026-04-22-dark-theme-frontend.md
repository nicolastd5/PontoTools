# Dark Theme — Frontend (Web PWA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar o redesign de tema escuro em todas as telas do funcionário no webapp React.

**Architecture:** Tokens centralizados em `theme.js`, contexto `ThemeContext` com toggle persistido em `localStorage`. Cada componente do funcionário usa `useTheme()` para obter as cores — sem hardcode. O painel admin não é alterado.

**Tech Stack:** React 18, React Router v6, React Query, Lucide React (novo), CSS-in-JS via inline styles.

---

## Mapa de arquivos

| Ação | Arquivo |
|---|---|
| Criar | `frontend/src/theme.js` |
| Criar | `frontend/src/contexts/ThemeContext.jsx` |
| Criar | `frontend/src/pages/employee/ProfilePage.jsx` |
| Modificar | `frontend/src/App.jsx` |
| Modificar | `frontend/src/pages/LoginPage.jsx` |
| Modificar | `frontend/src/components/shared/EmployeeLayout.jsx` |
| Modificar | `frontend/src/pages/employee/EmployeeDashboardPage.jsx` |
| Modificar | `frontend/src/pages/employee/EmployeeHistoryPage.jsx` |
| Modificar | `frontend/src/pages/employee/EmployeeNotificationsPage.jsx` |

---

## Task 1: Instalar lucide-react

**Files:**
- Modify: `frontend/package.json` (via npm)

- [ ] **Step 1: Instalar a dependência**

```bash
cd frontend && npm install lucide-react
```

Expected: linha `"lucide-react": "^0.x.x"` aparece no `package.json`.

- [ ] **Step 2: Verificar importação**

Em qualquer arquivo temporário ou no console do vite, confirme que `import { Clock } from 'lucide-react'` não gera erro após `npm run dev`.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add package.json package-lock.json
git commit -m "chore(frontend): instalar lucide-react"
```

---

## Task 2: Criar tokens de design

**Files:**
- Create: `frontend/src/theme.js`

- [ ] **Step 1: Criar o arquivo**

Crie `frontend/src/theme.js` com o conteúdo:

```js
export const darkTheme = {
  bg:            '#0d0f1a',
  surface:       '#151825',
  elevated:      '#1e2235',
  border:        'rgba(255,255,255,0.08)',
  textPrimary:   '#ffffff',
  textSecondary: '#8b92a9',
  textMuted:     '#4a5068',
  accent:        '#6c5ce7',
  success:       '#22c55e',
  warning:       '#f59e0b',
  danger:        '#ef4444',
  info:          '#3b82f6',
};

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
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/theme.js
git commit -m "feat(frontend): tokens de design dark/light"
```

---

## Task 3: Criar ThemeContext

**Files:**
- Create: `frontend/src/contexts/ThemeContext.jsx`

- [ ] **Step 1: Criar o arquivo**

```jsx
import { createContext, useContext, useState } from 'react';
import { darkTheme, lightTheme } from '../theme';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(
    () => localStorage.getItem('theme') !== 'light'
  );
  const theme = isDark ? darkTheme : lightTheme;

  function toggleTheme() {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ isDark, theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/contexts/ThemeContext.jsx
git commit -m "feat(frontend): ThemeContext com toggle dark/light"
```

---

## Task 4: Adicionar ThemeProvider e rota /profile no App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Substituir o arquivo inteiro**

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth }   from './contexts/AuthContext';
import { ToastProvider }            from './contexts/ToastContext';
import { ThemeProvider }            from './contexts/ThemeContext';

import LoginPage                   from './pages/LoginPage';
import ForgotPasswordPage          from './pages/ForgotPasswordPage';
import ResetPasswordPage           from './pages/ResetPasswordPage';
import AdminDashboardPage          from './pages/admin/AdminDashboardPage';
import AdminEmployeesPage          from './pages/admin/AdminEmployeesPage';
import AdminClocksPage             from './pages/admin/AdminClocksPage';
import AdminBlockedPage            from './pages/admin/AdminBlockedPage';
import AdminUnitsPage              from './pages/admin/AdminUnitsPage';
import AdminContractsPage          from './pages/admin/AdminContractsPage';
import AdminJobRolesPage           from './pages/admin/AdminJobRolesPage';
import AdminProfilePage            from './pages/admin/AdminProfilePage';
import AdminExportPage             from './pages/admin/AdminExportPage';
import AdminServicesPage           from './pages/admin/AdminServicesPage';
import AdminNotificationsPage      from './pages/admin/AdminNotificationsPage';
import AdminPhotosPage             from './pages/admin/AdminPhotosPage';
import EmployeeDashboardPage       from './pages/employee/EmployeeDashboardPage';
import EmployeeHistoryPage         from './pages/employee/EmployeeHistoryPage';
import EmployeeServicesPage        from './pages/employee/EmployeeServicesPage';
import EmployeeNotificationsPage   from './pages/employee/EmployeeNotificationsPage';
import ProfilePage                 from './pages/employee/ProfilePage';

import AdminLayout    from './components/shared/AdminLayout';
import EmployeeLayout from './components/shared/EmployeeLayout';

function PrivateRoute({ children, role, roles }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" />
          <p style={{ marginTop: 16, color: '#64748b' }}>Carregando...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  const allowed = roles ? roles.includes(user.role) : (role ? user.role === role : true);
  if (!allowed) {
    if (user.role === 'admin')  return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'gestor') return <Navigate to="/admin/employees" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <Routes>
      <Route path="/login" element={
        user
          ? <Navigate to={user.role === 'employee' ? '/dashboard' : user.role === 'admin' ? '/admin/dashboard' : '/admin/employees'} replace />
          : <LoginPage />
      } />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password"  element={<ResetPasswordPage />} />

      <Route path="/admin" element={
        <PrivateRoute roles={['admin', 'gestor']}><AdminLayout /></PrivateRoute>
      }>
        <Route index element={<Navigate to={user?.role === 'gestor' ? '/admin/employees' : '/admin/dashboard'} replace />} />
        <Route path="dashboard"    element={user?.role === 'admin' ? <AdminDashboardPage /> : <Navigate to="/admin/employees" replace />} />
        <Route path="employees"    element={<AdminEmployeesPage />} />
        <Route path="clocks"       element={<AdminClocksPage />} />
        <Route path="blocked"      element={<AdminBlockedPage />} />
        <Route path="units"        element={<AdminUnitsPage />} />
        <Route path="contracts"    element={<AdminContractsPage />} />
        <Route path="job-roles"    element={<AdminJobRolesPage />} />
        <Route path="profile"      element={<AdminProfilePage />} />
        <Route path="export"       element={<AdminExportPage />} />
        <Route path="services"     element={<AdminServicesPage />} />
        <Route path="notifications" element={<AdminNotificationsPage />} />
        <Route path="photos"       element={<AdminPhotosPage />} />
      </Route>

      <Route path="/" element={
        <PrivateRoute role="employee"><EmployeeLayout /></PrivateRoute>
      }>
        <Route index              element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"   element={<EmployeeDashboardPage />} />
        <Route path="history"     element={<EmployeeHistoryPage />} />
        <Route path="services"    element={<EmployeeServicesPage />} />
        <Route path="notifications" element={<EmployeeNotificationsPage />} />
        <Route path="profile"     element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Subir o servidor e confirmar que o app ainda carrega**

```bash
cd frontend && npm run dev
```

Abra `http://localhost:5173/login` e confirme que a tela de login aparece (ainda com o visual antigo — OK por enquanto).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat(frontend): ThemeProvider + rota /profile"
```

---

## Task 5: Redesign LoginPage

**Files:**
- Modify: `frontend/src/pages/LoginPage.jsx`

- [ ] **Step 1: Substituir o arquivo inteiro**

```jsx
import { useState } from 'react';
import { useAuth }     from '../contexts/AuthContext';
import { useToast }    from '../contexts/ToastContext';
import { useNavigate, Link } from 'react-router-dom';

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const { login }  = useAuth();
  const { error }  = useToast();
  const navigate   = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/dashboard');
    } catch (err) {
      error(err.response?.data?.error || 'Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.root}>
      <div style={s.inner}>
        <div style={s.logo}>P</div>
        <h1 style={s.title}>PontoTools</h1>
        <p style={s.subtitle}>Entre com sua conta</p>
        <form onSubmit={handleSubmit} style={s.form}>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="funcionario@empresa.com" required autoComplete="email"
            style={s.input}
          />
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••" required autoComplete="current-password"
            style={s.input}
          />
          <button type="submit" disabled={loading}
            style={{ ...s.btn, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Entrando...' : 'Entrar →'}
          </button>
        </form>
        <Link to="/forgot-password" style={s.forgot}>Esqueceu a senha?</Link>
      </div>
    </div>
  );
}

const s = {
  root:     { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0f1a', padding: 16 },
  inner:    { width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center' },
  logo:     { width: 56, height: 56, background: '#6c5ce7', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: '#fff', marginBottom: 16 },
  title:    { fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#8b92a9', marginBottom: 32 },
  form:     { width: '100%', display: 'flex', flexDirection: 'column', gap: 12 },
  input:    { padding: '13px 14px', background: '#1e2235', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 14, color: '#fff', outline: 'none' },
  btn:      { padding: 14, background: '#fff', color: '#0d0f1a', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, marginTop: 4 },
  forgot:   { marginTop: 20, color: '#6c5ce7', fontSize: 13, textDecoration: 'none', fontWeight: 500 },
};
```

- [ ] **Step 2: Testar visualmente**

Abra `http://localhost:5173/login`. Confirme: fundo preto/escuro, logo roxa "P", título "PontoTools", inputs escuros, botão branco "Entrar →", link roxo "Esqueceu a senha?".

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/LoginPage.jsx
git commit -m "feat(frontend): redesign login page tema escuro"
```

---

## Task 6: Redesign EmployeeLayout

**Files:**
- Modify: `frontend/src/components/shared/EmployeeLayout.jsx`

- [ ] **Step 1: Substituir o arquivo inteiro**

```jsx
import { Outlet, NavLink }  from 'react-router-dom';
import { useQuery }         from '@tanstack/react-query';
import { useTheme }         from '../../contexts/ThemeContext';
import { Clock, List, Wrench, Bell, User } from 'lucide-react';
import api from '../../services/api';

export default function EmployeeLayout() {
  const { theme } = useTheme();

  const { data: notifData } = useQuery({
    queryKey: ['my-notifications'],
    queryFn:  () => api.get('/notifications').then((r) => r.data),
    refetchInterval: 30000,
  });
  const unreadCount = notifData?.unread ?? 0;

  const { data: todayData } = useQuery({
    queryKey:  ['clock-today'],
    queryFn:   () => api.get('/clock/today', {
      params: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    }).then((r) => r.data),
    staleTime: 60000,
  });
  const servicesOnly = todayData?.servicesOnly ?? false;

  const allTabs = [
    { to: '/dashboard',     label: 'Ponto',     Icon: Clock },
    { to: '/history',       label: 'Histórico', Icon: List },
    { to: '/services',      label: 'Serviços',  Icon: Wrench },
    { to: '/notifications', label: 'Avisos',    Icon: Bell, badge: unreadCount },
    { to: '/profile',       label: 'Perfil',    Icon: User },
  ];
  const tabs = servicesOnly
    ? allTabs.filter((t) => ['/services', '/notifications', '/profile'].includes(t.to))
    : allTabs;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: theme.bg, maxWidth: 480, margin: '0 auto' }}>
      <main style={{ flex: 1, padding: '20px 16px', paddingBottom: 80 }}>
        <Outlet />
      </main>

      <nav style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, display: 'flex', background: theme.surface, borderTop: `1px solid ${theme.border}`, boxShadow: '0 -4px 16px rgba(0,0,0,0.2)' }}>
        {tabs.map(({ to, label, Icon, badge }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            padding: '10px 0', textDecoration: 'none',
            color: isActive ? theme.accent : theme.textMuted,
          })}>
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <Icon size={20} strokeWidth={1.75} />
              {badge > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -6, background: theme.danger, color: '#fff', borderRadius: 10, fontSize: 9, fontWeight: 700, padding: '1px 4px', lineHeight: 1.4 }}>
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </span>
            <span style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: Testar visualmente**

Logue como funcionário. Confirme: fundo escuro, nav inferior com ícones Lucide, 5 abas (Ponto, Histórico, Serviços, Avisos, Perfil), aba ativa em roxo.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/shared/EmployeeLayout.jsx
git commit -m "feat(frontend): redesign EmployeeLayout dark + Lucide + aba Perfil"
```

---

## Task 7: Redesign EmployeeDashboardPage

**Files:**
- Modify: `frontend/src/pages/employee/EmployeeDashboardPage.jsx`

- [ ] **Step 1: Substituir o arquivo inteiro**

```jsx
import { useState, useEffect }  from 'react';
import { Navigate }             from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone }  from 'date-fns-tz';
import api                   from '../../services/api';
import { useAuth }           from '../../contexts/AuthContext';
import { useTheme }          from '../../contexts/ThemeContext';
import { useToast }          from '../../contexts/ToastContext';
import { useGeolocation }    from '../../hooks/useGeolocation';
import GpsStatus             from '../../components/employee/GpsStatus';
import CameraCapture         from '../../components/employee/CameraCapture';
import ServiceCard           from '../../components/employee/ServiceCard';

const CLOCK_TYPES = [
  { key: 'entry',       label: 'Entrada',          colorKey: 'success' },
  { key: 'break_start', label: 'Início Intervalo',  colorKey: 'warning' },
  { key: 'break_end',   label: 'Fim Intervalo',     colorKey: 'info'    },
  { key: 'exit',        label: 'Saída',             colorKey: 'danger'  },
];

const CLOCK_TYPE_LABELS = {
  entry: 'Entrada', exit: 'Saída',
  break_start: 'Início intervalo', break_end: 'Fim intervalo',
};

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

const WEEKDAYS = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function EmployeeDashboardPage() {
  const { user }        = useAuth();
  const { theme }       = useTheme();
  const { success, error, warning } = useToast();
  const queryClient     = useQueryClient();
  const now             = useLiveClock();

  const [cameraFor, setCameraFor]       = useState(null);
  const [gpsSnapshot, setGpsSnapshot]   = useState(null);

  const { status: gpsStatus, coords, distanceMeters, isInsideZone } = useGeolocation(user?.unit);

  const { data: todayData } = useQuery({
    queryKey: ['clock-today'],
    queryFn:  () => api.get('/clock/today', { params: { timezone: TZ } }).then((r) => r.data),
    refetchInterval: 15 * 1000,
  });

  const clockMutation = useMutation({
    mutationFn: (formData) => api.post('/clock', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['clock-today']);
      success(`Ponto registrado! ${CLOCK_TYPE_LABELS[res.data.clockType]} às ${
        formatInTimeZone(new Date(res.data.clockedAtUtc), TZ, 'HH:mm')
      }`);
    },
    onError: (err) => {
      const data = err.response?.data;
      if (data?.blocked && data?.reason === 'outside_zone') {
        warning(`Bloqueado: você está a ${Math.round(data.distanceMeters)}m da unidade (máximo: ${data.radiusMeters}m).`);
      } else {
        error(data?.error || 'Erro ao registrar ponto. Tente novamente.');
      }
    },
  });

  const todayRecords    = todayData?.records || [];
  const requireLocation = todayData?.requireLocation ?? true;
  const available       = todayData?.available ?? { entry: true, break_start: false, break_end: false, exit: false };
  const maxPhotos       = todayData?.maxPhotos ?? 1;
  const gpsOk           = gpsStatus === 'granted';

  function handleClockClick(clockType) {
    if (requireLocation) {
      if (gpsStatus !== 'granted') {
        warning('Habilite o GPS para registrar o ponto.');
        return;
      }
      if (!isInsideZone) {
        warning(`Você está a ${Math.round(distanceMeters || 0)}m da unidade. Máximo permitido: ${user?.unit?.radiusMeters}m.`);
        return;
      }
    }
    setGpsSnapshot(coords || null);
    setCameraFor(clockType);
  }

  async function handlePhotoCapture(blobs) {
    const clockType    = cameraFor;
    const coordsToSend = gpsSnapshot || coords;
    setCameraFor(null);

    const formData = new FormData();
    formData.append('clock_type', clockType);
    formData.append('timezone',   TZ);

    if (coordsToSend) {
      formData.append('latitude',  String(coordsToSend.latitude));
      formData.append('longitude', String(coordsToSend.longitude));
      formData.append('accuracy',  String(coordsToSend.accuracy || ''));
    } else {
      formData.append('latitude',  '0');
      formData.append('longitude', '0');
      formData.append('accuracy',  '');
    }

    if (blobs.length > 0) {
      blobs.forEach((blob, i) => formData.append('photo', blob, `photo_${i}.jpg`));
    } else {
      const dataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=';
      const blob = await (await fetch(dataUri)).blob();
      formData.append('photo', blob, 'photo.jpg');
    }

    try {
      await clockMutation.mutateAsync(formData);
    } finally {
      setGpsSnapshot(null);
    }
  }

  if (todayData?.servicesOnly) return <Navigate to="/services" replace />;

  const initials = user?.name
    ? user.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : '?';

  const weekday   = WEEKDAYS[now.getDay()].toUpperCase();
  const timeHHmm  = formatInTimeZone(now, TZ, 'HH:mm');
  const timeSS    = formatInTimeZone(now, TZ, 'ss');
  const dateLabel = now.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });

  const DOT_COLOR = { entry: theme.success, break_start: theme.warning, break_end: theme.info, exit: theme.danger };

  return (
    <div>
      {/* Saudação */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, color: theme.textSecondary }}>Olá,</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: theme.textPrimary }}>{user?.name}</div>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 20, background: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 13 }}>
          {initials}
        </div>
      </div>

      {/* Relógio */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: theme.accent, textTransform: 'uppercase', marginBottom: 4 }}>{weekday}</div>
        <div style={{ fontSize: 48, fontWeight: 800, color: theme.textPrimary, fontVariantNumeric: 'tabular-nums', letterSpacing: 2, lineHeight: 1 }}>
          {timeHHmm}
          <span style={{ fontSize: 26, opacity: 0.5 }}>:{timeSS}</span>
        </div>
        <div style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>{dateLabel}</div>
      </div>

      {/* Status GPS */}
      {(requireLocation || gpsOk) && (
        <div style={{ marginBottom: 10 }}>
          <GpsStatus
            status={gpsStatus}
            distanceMeters={distanceMeters}
            isInsideZone={isInsideZone}
            radiusMeters={user?.unit?.radiusMeters}
            requireLocation={requireLocation}
          />
        </div>
      )}

      {!requireLocation && !gpsOk && (
        <div style={{ padding: '12px 14px', background: theme.surface, borderRadius: 12, border: `1px solid ${theme.border}`, color: theme.textSecondary, fontSize: 13, fontWeight: 500, marginBottom: 10 }}>
          Localização livre — você pode registrar de qualquer lugar.
        </div>
      )}

      {!requireLocation && gpsOk && distanceMeters !== null && (
        <div style={{ padding: '12px 14px', background: theme.surface, borderRadius: 12, border: `1px solid ${theme.border}`, color: theme.textSecondary, fontSize: 13, fontWeight: 500, marginBottom: 10 }}>
          {Math.round(distanceMeters)}m da unidade — localização livre para este cargo.
        </div>
      )}

      {/* Card de serviço */}
      {todayRecords.length > 0 && <ServiceCard records={todayRecords} />}

      {/* Botões de ponto */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16, marginTop: 4 }}>
        {CLOCK_TYPES.map((ct) => {
          const color     = theme[ct.colorKey];
          const gpsBlocks = requireLocation && (!gpsOk || !isInsideZone);
          const seqBlocks = !available[ct.key];
          const disabled  = gpsBlocks || seqBlocks || clockMutation.isPending;
          return (
            <button
              key={ct.key}
              onClick={() => handleClockClick(ct.key)}
              disabled={disabled}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '20px 12px', border: `1.5px solid`,
                borderColor: disabled ? theme.border : color + '55',
                borderRadius: 14,
                background:  disabled ? theme.elevated : color + '18',
                color:       disabled ? theme.textMuted : color,
                cursor:      disabled ? 'not-allowed' : 'pointer',
                opacity:     seqBlocks && !gpsBlocks ? 0.45 : clockMutation.isPending ? 0.7 : 1,
                position:    'relative',
                transition:  'all 0.15s',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700 }}>{ct.label}</span>
              {requireLocation && !gpsOk && <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 12, opacity: 0.6 }}>🔒</span>}
              {(!requireLocation || gpsOk) && seqBlocks && <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 12, opacity: 0.6 }}>⏸</span>}
            </button>
          );
        })}
      </div>

      {/* Banner bloqueado por zona */}
      {requireLocation && gpsOk && !isInsideZone && distanceMeters !== null && (
        <div style={{ padding: '12px 14px', background: theme.danger + '18', borderRadius: 10, border: `1px solid ${theme.danger}55`, color: theme.danger, fontSize: 13, fontWeight: 500, marginBottom: 16, lineHeight: 1.5 }}>
          Fora da zona — {Math.round(distanceMeters)}m de distância (limite: {user?.unit?.radiusMeters}m).
        </div>
      )}

      {/* Registros de hoje */}
      {todayRecords.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Hoje</span>
            <span style={{ fontSize: 11, color: theme.accent }}>{todayRecords.length} registro{todayRecords.length > 1 ? 's' : ''}</span>
          </div>
          <div style={{ background: theme.surface, borderRadius: 12, border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
            {todayRecords.map((r, i) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < todayRecords.length - 1 ? `1px solid ${theme.border}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: DOT_COLOR[r.clock_type] || theme.textMuted }} />
                  <span style={{ fontSize: 13, color: theme.textPrimary }}>{CLOCK_TYPE_LABELS[r.clock_type]}</span>
                </div>
                <span style={{ fontSize: 13, color: theme.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
                  {formatInTimeZone(new Date(r.clocked_at_utc), r.timezone || TZ, 'HH:mm')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {cameraFor && (
        <CameraCapture
          clockType={cameraFor}
          maxPhotos={maxPhotos}
          onCapture={handlePhotoCapture}
          onCancel={() => { setCameraFor(null); setGpsSnapshot(null); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Testar visualmente**

Logue como funcionário. Confirme: saudação com avatar de iniciais, relógio grande com dia da semana em roxo, botões com cores corretas, registros de hoje com dots coloridos.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/employee/EmployeeDashboardPage.jsx
git commit -m "feat(frontend): redesign dashboard tema escuro"
```

---

## Task 8: Redesign EmployeeHistoryPage

**Files:**
- Modify: `frontend/src/pages/employee/EmployeeHistoryPage.jsx`

- [ ] **Step 1: Substituir o arquivo inteiro**

```jsx
import { useState, useEffect, useCallback } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import api         from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';

const LABELS = {
  entry: 'Entrada', exit: 'Saída',
  break_start: 'Início intervalo', break_end: 'Fim intervalo',
};

function getTypeColor(type, theme) {
  return { entry: theme.success, break_start: theme.warning, break_end: theme.info, exit: theme.danger }[type] || theme.textMuted;
}

function groupByDate(records, theme) {
  const groups = {};
  records.forEach((r) => {
    const tz      = r.timezone || 'America/Sao_Paulo';
    const dateKey = formatInTimeZone(new Date(r.clocked_at_utc), tz, 'yyyy-MM-dd');
    if (!groups[dateKey]) {
      const todayKey = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
      const label    = dateKey === todayKey
        ? 'HOJE'
        : formatInTimeZone(new Date(r.clocked_at_utc), tz, "dd MMM", { locale: ptBR }).toUpperCase();
      groups[dateKey] = { label, records: [] };
    }
    groups[dateKey].records.push(r);
  });
  return Object.values(groups);
}

export default function EmployeeHistoryPage() {
  const { theme }             = useTheme();
  const [records, setRecords] = useState([]);
  const [page, setPage]       = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchPage = useCallback(async (pageNum, reset = false) => {
    if (loading && !reset) return;
    setLoading(true);
    try {
      const { data } = await api.get('/clock/history', { params: { page: pageNum, limit: 20 } });
      setRecords((prev) => reset ? data.records : [...prev, ...data.records]);
      setPage(pageNum);
      setHasMore(pageNum < data.pagination.totalPages);
    } catch {}
    finally { setLoading(false); }
  }, [loading]);

  useEffect(() => { fetchPage(1, true); }, []);

  const groups = groupByDate(records, theme);

  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: theme.accent, textTransform: 'uppercase', marginBottom: 2 }}>Meus registros</p>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: theme.textPrimary, marginBottom: 20 }}>Histórico</h1>

      {loading && records.length === 0 ? (
        <p style={{ textAlign: 'center', color: theme.textMuted, padding: 32 }}>Carregando...</p>
      ) : groups.length === 0 ? (
        <p style={{ textAlign: 'center', color: theme.textMuted, padding: 32 }}>Nenhum registro encontrado.</p>
      ) : (
        <>
          {groups.map((g, gi) => (
            <div key={gi} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, letterSpacing: 1, textTransform: 'uppercase', paddingBottom: 6, marginBottom: 4, borderBottom: `1px solid ${theme.border}` }}>
                {g.label}
              </div>
              {g.records.map((r, ri) => {
                const tz   = r.timezone || 'America/Sao_Paulo';
                const time = formatInTimeZone(new Date(r.clocked_at_utc), tz, 'HH:mm');
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: ri < g.records.length - 1 ? `1px solid ${theme.border}` : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: getTypeColor(r.clock_type, theme), flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: theme.textPrimary, fontWeight: 500 }}>{LABELS[r.clock_type] || r.clock_type}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {!r.is_inside_zone && (
                        <span style={{ background: theme.danger + '22', border: `1px solid ${theme.danger}55`, color: theme.danger, fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>Fora</span>
                      )}
                      <span style={{ fontSize: 13, color: theme.textSecondary, fontVariantNumeric: 'tabular-nums' }}>{time}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {hasMore && (
            <button
              onClick={() => fetchPage(page + 1)}
              disabled={loading}
              style={{ width: '100%', padding: '12px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, color: theme.accent, fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', marginBottom: 8 }}
            >
              {loading ? 'Carregando...' : 'Carregar mais'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Testar visualmente**

Abra a aba Histórico. Confirme: registros agrupados por data, dots coloridos por tipo, badge "Fora" em vermelho, botão "Carregar mais" ao chegar no fim.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/employee/EmployeeHistoryPage.jsx
git commit -m "feat(frontend): redesign histórico com agrupamento por data"
```

---

## Task 9: Redesign EmployeeNotificationsPage

**Files:**
- Modify: `frontend/src/pages/employee/EmployeeNotificationsPage.jsx`

- [ ] **Step 1: Substituir o arquivo inteiro**

```jsx
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api          from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../contexts/ThemeContext';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

const TYPE_ICON = {
  service_assigned: { icon: '🔧', bg: 'rgba(108,92,231,0.2)' },
  service_delay:    { icon: '⚠️', bg: 'rgba(245,158,11,0.2)' },
  service_problem:  { icon: '❗', bg: 'rgba(239,68,68,0.15)' },
  default:          { icon: '📢', bg: 'rgba(139,146,169,0.15)' },
};

function getIcon(type) {
  return TYPE_ICON[type] || TYPE_ICON.default;
}

function fmtDate(dt) {
  const diff    = (Date.now() - new Date(dt).getTime()) / 1000;
  if (diff < 60)    return 'agora mesmo';
  if (diff < 3600)  return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  const d = new Date(dt);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

export default function EmployeeNotificationsPage() {
  const { theme }    = useTheme();
  const queryClient  = useQueryClient();
  const { success, error } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['my-notifications'],
    queryFn:  () => api.get('/notifications').then((r) => r.data),
    refetchInterval: 30000,
  });
  const notifications = data?.notifications || [];
  const unread        = data?.unread ?? 0;

  const [pushSupported, setPushSupported] = useState(false);
  const [pushGranted,   setPushGranted]   = useState(false);
  const [subscribing,   setSubscribing]   = useState(false);

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY;
    setPushSupported(supported);
    if (supported) setPushGranted(Notification.permission === 'granted');
  }, []);

  const markReadMutation = useMutation({
    mutationFn: (id) => api.patch(`/notifications/${id}/read`),
    onSuccess:  () => queryClient.invalidateQueries(['my-notifications']),
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess:  () => { success('Todas marcadas como lidas.'); queryClient.invalidateQueries(['my-notifications']); },
  });

  async function enablePush() {
    if (!pushSupported) return;
    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { error('Permissão negada.'); return; }
      setPushGranted(true);
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
      await api.post('/notifications/subscribe', sub.toJSON());
      success('Notificações push ativadas!');
    } catch { error('Erro ao ativar notificações push.'); }
    finally { setSubscribing(false); }
  }

  async function disablePush() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await api.delete('/notifications/subscribe', { data: { endpoint: sub.endpoint } }); await sub.unsubscribe(); }
      setPushGranted(false);
      success('Notificações push desativadas.');
    } catch { error('Erro ao desativar.'); }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: theme.accent, textTransform: 'uppercase', marginBottom: 2 }}>Avisos</p>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: theme.textPrimary }}>Notificações</h1>
        </div>
        {unread > 0 && (
          <span style={{ background: theme.success, color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, marginTop: 4 }}>
            {unread} nova{unread > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Marcar todas */}
      {unread > 0 && (
        <button onClick={() => markAllMutation.mutate()} disabled={markAllMutation.isLoading}
          style={{ width: '100%', padding: '10px', background: theme.accent + '18', border: `1px solid ${theme.accent}44`, borderRadius: 10, color: theme.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}>
          Marcar todas como lidas
        </button>
      )}

      {/* Push banner */}
      {pushSupported && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 20, gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary }}>
              {pushGranted ? 'Notificações push ativas' : 'Notificações push inativas'}
            </div>
            <div style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
              {pushGranted ? 'Você receberá alertas mesmo com o app fechado.' : 'Ative para receber alertas de serviços.'}
            </div>
          </div>
          <button onClick={pushGranted ? disablePush : enablePush} disabled={subscribing}
            style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: pushGranted ? theme.elevated : theme.accent, color: pushGranted ? theme.textSecondary : '#fff', whiteSpace: 'nowrap' }}>
            {subscribing ? '...' : pushGranted ? 'Desativar' : 'Ativar'}
          </button>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <p style={{ textAlign: 'center', color: theme.textMuted, padding: 32 }}>Carregando...</p>
      ) : notifications.length === 0 ? (
        <p style={{ textAlign: 'center', color: theme.textMuted, padding: 32 }}>Nenhuma notificação ainda.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {notifications.map((n) => {
            const { icon, bg } = getIcon(n.type);
            return (
              <div key={n.id}
                onClick={() => !n.read && markReadMutation.mutate(n.id)}
                style={{ display: 'flex', gap: 12, padding: '13px 0', borderBottom: `1px solid ${theme.border}`, cursor: n.read ? 'default' : 'pointer' }}>
                <div style={{ width: 38, height: 38, borderRadius: 19, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                  {icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: theme.textPrimary, marginBottom: 2 }}>
                    {n.title}
                    {!n.read && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: theme.accent, marginLeft: 6, verticalAlign: 'middle' }} />}
                  </div>
                  <div style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.4, marginBottom: 3 }}>{n.body}</div>
                  <div style={{ fontSize: 10, color: theme.textMuted }}>{fmtDate(n.created_at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Testar visualmente**

Abra a aba Avisos. Confirme: header "AVISOS / Notificações" com badge verde de novas, itens com ícones coloridos em círculo, dots roxos para não lidas.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/employee/EmployeeNotificationsPage.jsx
git commit -m "feat(frontend): redesign notificações tema escuro"
```

---

## Task 10: Criar ProfilePage

**Files:**
- Create: `frontend/src/pages/employee/ProfilePage.jsx`

- [ ] **Step 1: Criar o arquivo**

```jsx
import { useAuth }     from '../../contexts/AuthContext';
import { useTheme }    from '../../contexts/ThemeContext';
import { useToast }    from '../../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';

export default function ProfilePage() {
  const { user, logout }             = useAuth();
  const { isDark, theme, toggleTheme } = useTheme();
  const { success }                  = useToast();
  const navigate                     = useNavigate();

  async function handleLogout() {
    await logout();
    success('Até logo!');
    navigate('/login');
  }

  const initials = user?.name
    ? user.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : '?';

  const rows = [
    { key: 'Email',   val: user?.email },
    { key: 'Unidade', val: user?.unit?.name },
    { key: 'Cargo',   val: user?.jobRole?.name || '—' },
  ];

  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: theme.accent, textTransform: 'uppercase', marginBottom: 2 }}>Conta</p>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: theme.textPrimary, marginBottom: 24 }}>Meu Perfil</h1>

      {/* Avatar */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ width: 72, height: 72, borderRadius: 36, background: theme.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 10 }}>
          {initials}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: theme.textPrimary, marginBottom: 2 }}>{user?.name}</div>
        <div style={{ fontSize: 12, color: theme.accent }}>{user?.jobRole?.name || 'Funcionário'}</div>
      </div>

      {/* Info */}
      <div style={{ background: theme.surface, borderRadius: 14, border: `1px solid ${theme.border}`, overflow: 'hidden', marginBottom: 16 }}>
        {rows.map(({ key, val }, i) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: i < rows.length - 1 ? `1px solid ${theme.border}` : 'none' }}>
            <span style={{ fontSize: 12, color: theme.textSecondary }}>{key}</span>
            <span style={{ fontSize: 13, color: theme.textPrimary, fontWeight: 600 }}>{val || '—'}</span>
          </div>
        ))}
      </div>

      {/* Toggle tema */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: theme.surface, borderRadius: 14, border: `1px solid ${theme.border}`, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary }}>Tema escuro</div>
          <div style={{ fontSize: 11, color: theme.textSecondary }}>Aparência do aplicativo</div>
        </div>
        <button onClick={toggleTheme}
          style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: isDark ? theme.accent : theme.elevated, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', padding: 0 }}>
          <span style={{ position: 'absolute', top: 3, width: 18, height: 18, borderRadius: 9, background: '#fff', transition: 'left 0.2s', left: isDark ? 23 : 3 }} />
        </button>
      </div>

      {/* Logout */}
      <button onClick={handleLogout}
        style={{ width: '100%', padding: 13, background: theme.danger + '18', border: `1px solid ${theme.danger}44`, borderRadius: 12, color: theme.danger, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        Sair da conta
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Testar visualmente**

Abra a aba Perfil. Confirme: avatar com iniciais em roxo, cards de info, toggle de tema funcional (alterna dark/light e persiste no reload), botão "Sair da conta" vermelho.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/employee/ProfilePage.jsx
git commit -m "feat(frontend): tela de perfil com toggle de tema"
```

---

## Task 11: Build final e verificação

**Files:** nenhum novo

- [ ] **Step 1: Rodar o build de produção**

```bash
cd frontend && npm run build
```

Expected: sem erros. Avisos de lint são aceitáveis; erros de TypeScript/JSX não.

- [ ] **Step 2: Testar o preview**

```bash
npm run preview
```

Percorra todas as telas como funcionário: Login → Dashboard → Histórico → Serviços → Avisos → Perfil. Confirme que o toggle de tema funciona e persiste após F5.

- [ ] **Step 3: Commit final**

```bash
git add -A
git commit -m "feat(frontend): redesign tema escuro completo telas do funcionário"
```
