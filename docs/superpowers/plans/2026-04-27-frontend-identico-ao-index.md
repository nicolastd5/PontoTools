# Frontend Idêntico ao index.html — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o frontend React idêntico ao design do arquivo `index.html` na raiz do projeto — mesmos tokens de cor, fonte Geist, Login com fundo escuro decorado, Dashboard com hero clock, botões com ícones SVG, e sidebar admin fiel ao protótipo.

**Architecture:** Atualizar `theme.js` com os tokens exatos de LIGHT_C/DARK_C do index.html; criar componentes compartilhados `Icon.jsx` e `Logo.jsx`; redesenhar `LoginPage`, `EmployeeDashboardPage` e `AdminLayout` para replicar exatamente a aparência do protótipo; aplicar tokens nas páginas de funcionário restantes.

**Tech Stack:** React 18, Vite, lucide-react (mantido nas abas), inline styles com tokens do tema

---

### Task 1: Fonts + Theme Tokens

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/src/theme.js`

- [ ] **Step 1: Adicionar Geist + JetBrains Mono ao index.html**

Substituir o conteúdo do `<style>` e adicionar o `<link>` da Google Fonts:

```html
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="theme-color" content="#4f46e5" />
    <meta name="description" content="Sistema de registro de ponto com GPS e foto" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
    <title>Ponto Eletrônico</title>
    <style>
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      html,body,#root{height:100%;min-height:100%}
      body{font-family:'Geist','Inter',-apple-system,BlinkMacSystemFont,sans-serif;background:#fafafa;color:#09090b;font-feature-settings:"cv11","ss01","ss03";-webkit-font-smoothing:antialiased}
      #root{height:100%;min-height:100vh;display:flex;flex-direction:column}
      input,select,button,textarea{font-family:inherit}
      .mono{font-family:'JetBrains Mono',ui-monospace,monospace;font-feature-settings:"tnum"}
      ::-webkit-scrollbar{width:10px;height:10px}
      ::-webkit-scrollbar-track{background:transparent}
      ::-webkit-scrollbar-thumb{background:#e4e4e7;border-radius:10px;border:2px solid #fafafa}
      ::-webkit-scrollbar-thumb:hover{background:#d4d4d8}
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Atualizar theme.js com tokens exatos do index.html**

```js
// tokens LIGHT_C e DARK_C extraídos do index.html
export const lightTheme = {
  bg:          '#fafafa',
  card:        '#ffffff',
  ink:         '#09090b',
  muted:       '#71717a',
  subtle:      '#a1a1aa',
  line:        '#e4e4e7',
  hairline:    '#f4f4f5',
  surface:     '#f4f4f5',
  primary:     '#4f46e5',
  primaryDark: '#4338ca',
  primarySoft: '#eef2ff',
  ok:          '#10b981',
  okSoft:      '#ecfdf5',
  warn:        '#f59e0b',
  warnSoft:    '#fffbeb',
  danger:      '#ef4444',
  dangerSoft:  '#fef2f2',
  info:        '#0ea5e9',
  infoSoft:    '#f0f9ff',
  violet:      '#8b5cf6',
  violetSoft:  '#f5f3ff',
  night:       '#09090b',
  night2:      '#18181b',
  night3:      '#27272a',
};

export const darkTheme = {
  bg:          '#09090b',
  card:        '#111113',
  ink:         '#f4f4f5',
  muted:       '#a1a1aa',
  subtle:      '#71717a',
  line:        '#27272a',
  hairline:    '#1c1c1f',
  surface:     '#1c1c1f',
  primary:     '#818cf8',
  primaryDark: '#6366f1',
  primarySoft: '#1e1b4b',
  ok:          '#34d399',
  okSoft:      '#022c22',
  warn:        '#fbbf24',
  warnSoft:    '#291807',
  danger:      '#f87171',
  dangerSoft:  '#2d0a0a',
  info:        '#38bdf8',
  infoSoft:    '#0c1e2e',
  violet:      '#c4b5fd',
  violetSoft:  '#1a0936',
  night:       '#000000',
  night2:      '#09090b',
  night3:      '#111113',
};
```

- [ ] **Step 3: Atualizar ThemeContext para usar os novos nomes de token**

Abrir `frontend/src/contexts/ThemeContext.jsx` e verificar que ele exporta `theme` (o objeto inteiro, seja darkTheme ou lightTheme). Os componentes devem acessar `theme.card`, `theme.ink`, `theme.primary`, etc. — não os nomes antigos (`theme.bg`, `theme.accent`, `theme.textPrimary`).

**Mapeamento de nomes antigos → novos:**
| Antigo | Novo |
|---|---|
| `theme.textPrimary` | `theme.ink` |
| `theme.textSecondary` | `theme.muted` |
| `theme.textMuted` | `theme.subtle` |
| `theme.accent` | `theme.primary` |
| `theme.border` | `theme.line` |
| `theme.elevated` | `theme.surface` |
| `theme.success` | `theme.ok` |

Adicionar aliases de compatibilidade no final do ThemeContext (para não quebrar páginas de admin que ainda usam nomes antigos):
```js
// Em getTheme() ou no objeto exportado:
const t = isDark ? darkTheme : lightTheme;
return {
  ...t,
  // aliases de compatibilidade
  textPrimary:   t.ink,
  textSecondary: t.muted,
  textMuted:     t.subtle,
  accent:        t.primary,
  border:        t.line,
  elevated:      t.surface,
  success:       t.ok,
};
```

- [ ] **Step 4: Commit**

```bash
git add frontend/index.html frontend/src/theme.js frontend/src/contexts/ThemeContext.jsx
git commit -m "feat(frontend): tokens e fontes idênticos ao index.html"
```

---

### Task 2: Componentes compartilhados Icon + Logo

**Files:**
- Create: `frontend/src/components/shared/Icon.jsx`
- Create: `frontend/src/components/shared/Logo.jsx`

- [ ] **Step 1: Criar Icon.jsx**

```jsx
// SVG icon system extraído do index.html
const PATHS = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
  users:     <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  clock:     <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  camera:    <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>,
  block:     <><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></>,
  wrench:    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>,
  bell:      <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
  file:      <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
  tag:       <><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>,
  download:  <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
  image:     <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>,
  search:    <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
  plus:      <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
  logout:    <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
  chevron:   <polyline points="9 18 15 12 9 6"/>,
  check:     <polyline points="20 6 9 17 4 12"/>,
  x:         <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
  warn:      <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  filter:    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>,
  map:       <><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></>,
  arrow:     <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
  pin:       <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>,
  play:      <polygon points="5 3 19 12 5 21 5 3"/>,
  coffee:    <><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></>,
  list:      <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>,
  user:      <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  logo:      <><path d="M7 3v18" strokeWidth="2.5"/><path d="M7 3h6a5 5 0 0 1 0 10H7" strokeWidth="2.5"/></>,
};

export default function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 1.75 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke={color} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {PATHS[name]}
    </svg>
  );
}
```

- [ ] **Step 2: Criar Logo.jsx**

```jsx
import Icon from './Icon';

export default function Logo({ size = 32, theme }) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: size * 0.28,
      background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`,
      display: 'grid', placeItems: 'center',
      flexShrink: 0,
      boxShadow: `0 2px 8px -2px ${theme.primary}60`,
    }}>
      <Icon name="logo" size={size * 0.56} color="#fff" strokeWidth={2.5} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/shared/Icon.jsx frontend/src/components/shared/Logo.jsx
git commit -m "feat(frontend): componentes Icon e Logo do design system"
```

---

### Task 3: LoginPage Redesign

**Files:**
- Modify: `frontend/src/pages/LoginPage.jsx`

- [ ] **Step 1: Reescrever LoginPage para ser idêntica ao index.html**

O design tem: fundo escuro `theme.night` com dois radial-gradients e um dot-grid, card branco centralizado com sombra, Logo, campos com focus ring indigo, botão dark, link de "Esqueceu?" e toggle de tema.

```jsx
import { useState } from 'react';
import { useAuth }     from '../contexts/AuthContext';
import { useToast }    from '../contexts/ToastContext';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme }    from '../contexts/ThemeContext';
import Icon  from '../components/shared/Icon';
import Logo  from '../components/shared/Logo';

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [focus,    setFocus]    = useState(null);
  const { login }               = useAuth();
  const { error }               = useToast();
  const navigate                = useNavigate();
  const { theme, isDark, toggleTheme } = useTheme();

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

  function inp(n) {
    return {
      padding: '12px 14px',
      border: `1px solid ${focus === n ? theme.primary : theme.line}`,
      borderRadius: 10, fontSize: 14, outline: 'none',
      color: theme.ink, width: '100%', transition: 'all 0.15s',
      background: theme.card,
      boxShadow: focus === n ? `0 0 0 3px ${theme.primary}20` : 'none',
    };
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: theme.night,
      padding: 16, position: 'relative', overflow: 'hidden',
    }}>
      {/* Gradientes decorativos */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(circle at 20% 30%, ${theme.primary}22, transparent 50%),
                     radial-gradient(circle at 80% 70%, ${theme.violet}18, transparent 50%)`,
      }}/>
      {/* Dot grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
        backgroundSize: '32px 32px',
      }}/>

      <div style={{
        background: theme.card, borderRadius: 20, padding: '40px 36px',
        width: '100%', maxWidth: 400, position: 'relative',
        border: `1px solid ${theme.line}`,
        boxShadow: '0 20px 50px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.04)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex' }}><Logo size={52} theme={theme}/></div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: theme.ink, margin: '16px 0 4px', letterSpacing: '-0.02em' }}>Bem-vindo</h1>
          <p style={{ fontSize: 14, color: theme.muted }}>Entre na sua conta PontoTools</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: theme.muted, display: 'block', marginBottom: 6, letterSpacing: '-0.01em' }}>Email</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@empresa.com" required autoComplete="email"
              style={inp('email')} onFocus={() => setFocus('email')} onBlur={() => setFocus(null)}
            />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: theme.muted, letterSpacing: '-0.01em' }}>Senha</label>
              <Link to="/forgot-password" style={{ fontSize: 12, color: theme.primary, textDecoration: 'none', fontWeight: 500 }}>Esqueceu?</Link>
            </div>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" required autoComplete="current-password"
              style={inp('pwd')} onFocus={() => setFocus('pwd')} onBlur={() => setFocus(null)}
            />
          </div>

          <button type="submit" disabled={loading} style={{
            padding: 12, background: theme.ink, color: '#fff', border: 'none', borderRadius: 10,
            fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1, transition: 'all 0.15s', marginTop: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {loading ? 'Entrando...' : <><span>Entrar</span> <Icon name="arrow" size={16} color="#fff"/></>}
          </button>
        </form>

        <button onClick={toggleTheme} style={{
          marginTop: 16, width: '100%', padding: '8px',
          background: 'none', border: `1px solid ${theme.line}`,
          borderRadius: 8, fontSize: 12, color: theme.muted, cursor: 'pointer',
        }}>
          {isDark ? '☀️ Mudar para modo claro' : '🌙 Mudar para modo escuro'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/LoginPage.jsx
git commit -m "feat(frontend): LoginPage idêntica ao design index.html"
```

---

### Task 4: EmployeeDashboard Redesign

**Files:**
- Modify: `frontend/src/pages/employee/EmployeeDashboardPage.jsx`

O design do index.html tem:
1. Bloco "hero" escuro com gradiente `night → night2` contendo o relógio (sem greeting section)
2. Botões de ponto: 2x2 grid, cada um com caixa de ícone 36×36 + label + subtítulo
3. A greeting (Olá, [nome]) é removida — o hero substitui

- [ ] **Step 1: Definir constantes de botões com ícones**

No topo do arquivo, substituir `CLOCK_TYPES`:
```js
const CLOCK_TYPES = [
  { key: 'entry',       label: 'Entrada',         icon: 'play',   colorKey: 'ok'      },
  { key: 'break_start', label: 'Início Intervalo', icon: 'coffee', colorKey: 'warn'    },
  { key: 'break_end',   label: 'Fim Intervalo',    icon: 'arrow',  colorKey: 'info'    },
  { key: 'exit',        label: 'Saída',            icon: 'logout', colorKey: 'danger'  },
];
```

- [ ] **Step 2: Adicionar import do Icon**

```js
import Icon from '../../components/shared/Icon';
```

- [ ] **Step 3: Reescrever o JSX do componente**

Substituir o bloco `return (` inteiro:

```jsx
  return (
    <div>
      {/* Hero clock — fundo escuro com gradiente, como no index.html */}
      <div style={{
        background: `linear-gradient(135deg, ${theme.night} 0%, ${theme.night2} 100%)`,
        borderRadius: 20, padding: '28px 28px', color: '#fff',
        marginBottom: 16, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 100% 0%, ${theme.primary}30, transparent 50%)`, pointerEvents: 'none' }}/>
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 12, color: '#ffffff80', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500, marginBottom: 8 }}>{weekday}</div>
          <div style={{ fontSize: 56, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}>
            {timeHHmm}
            <span style={{ color: '#ffffff60', fontSize: 28 }}>:{timeSS}</span>
          </div>
          <div style={{ fontSize: 13, color: '#ffffffaa' }}>{dateLabel}</div>
        </div>
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
        <div style={{ padding: '12px 16px', background: theme.card, borderRadius: 12, border: `1px solid ${theme.line}`, color: theme.muted, fontSize: 13, fontWeight: 500, marginBottom: 10 }}>
          Localização livre — você pode registrar de qualquer lugar.
        </div>
      )}

      {/* Banner serviço ativo */}
      {todayRecords.find((r) => r.clock_type === 'entry') && !todayRecords.find((r) => r.clock_type === 'exit') && (
        <div style={{ padding: '14px 16px', marginBottom: 16, background: theme.okSoft, border: `1px solid ${theme.ok}40`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: theme.ok, display: 'inline-block' }}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: theme.ok, marginBottom: 2, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Serviço ativo</div>
            <div style={{ fontSize: 13, color: theme.ink }}>
              Iniciado às <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{
                (() => {
                  const entry = todayRecords.find((r) => r.clock_type === 'entry');
                  return entry ? formatInTimeZone(new Date(entry.clocked_at_utc), entry.timezone || TZ, 'HH:mm') : '';
                })()
              }</span>
            </div>
          </div>
        </div>
      )}

      {/* Botões de ponto — 2×2 grid com ícone */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {CLOCK_TYPES.map((ct) => {
          const color    = theme[ct.colorKey];
          const bg       = theme[ct.colorKey + 'Soft'] || theme.surface;
          const gpsBlocks = requireLocation && (!gpsOk || !isInsideZone);
          const seqBlocks = !available[ct.key];
          const disabled  = gpsBlocks || seqBlocks || clockMutation.isPending;
          return (
            <button
              key={ct.key}
              onClick={() => !disabled && handleClockClick(ct.key)}
              disabled={disabled}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                gap: 12, padding: '18px 16px',
                border: `1px solid ${disabled ? theme.line : color + '50'}`,
                borderRadius: 14, position: 'relative',
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                background: disabled ? theme.surface : theme.card,
                opacity: disabled ? 0.5 : 1,
                textAlign: 'left',
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: disabled ? theme.line : bg, display: 'grid', placeItems: 'center' }}>
                <Icon name={ct.icon} size={16} color={disabled ? theme.subtle : color}/>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: disabled ? theme.subtle : theme.ink, letterSpacing: '-0.01em', marginBottom: 2 }}>{ct.label}</div>
                <div style={{ fontSize: 11, color: theme.muted }}>{disabled ? 'Indisponível' : 'Toque para registrar'}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Banner fora da zona */}
      {requireLocation && gpsOk && !isInsideZone && distanceMeters !== null && (
        <div style={{ padding: '12px 14px', background: theme.dangerSoft, borderRadius: 10, border: `1px solid ${theme.danger}55`, color: theme.danger, fontSize: 13, fontWeight: 500, marginBottom: 16, lineHeight: 1.5 }}>
          Fora da zona — {Math.round(distanceMeters)}m de distância (limite: {user?.unit?.radiusMeters}m).
        </div>
      )}

      {/* Card de serviço */}
      {todayRecords.length > 0 && <ServiceCard records={todayRecords} />}

      {/* Registros de hoje */}
      {todayRecords.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: theme.subtle, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Hoje</span>
            <span style={{ fontSize: 11, color: theme.primary }}>{todayRecords.length} registro{todayRecords.length > 1 ? 's' : ''}</span>
          </div>
          <div style={{ background: theme.card, borderRadius: 14, border: `1px solid ${theme.line}`, overflow: 'hidden' }}>
            {todayRecords.map((r, i) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: i < todayRecords.length - 1 ? `1px solid ${theme.hairline}` : 'none' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: DOT_COLOR[r.clock_type] || theme.subtle, display: 'inline-block', flexShrink: 0 }}/>
                <span style={{ color: theme.ink, fontWeight: 500, fontSize: 13, flex: 1 }}>{CLOCK_TYPE_LABELS[r.clock_type]}</span>
                <span style={{ color: theme.ink, fontWeight: 600, fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>
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
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/employee/EmployeeDashboardPage.jsx
git commit -m "feat(frontend): dashboard funcionário idêntico ao design index.html"
```

---

### Task 5: GpsStatus com tokens do tema

**Files:**
- Modify: `frontend/src/components/employee/GpsStatus.jsx`

- [ ] **Step 1: Atualizar GpsStatus para receber `theme` e usar tokens**

```jsx
import { useTheme } from '../../contexts/ThemeContext';

export default function GpsStatus({ status, distanceMeters, isInsideZone, radiusMeters, requireLocation = true }) {
  const { theme } = useTheme();

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: theme.card, borderRadius: 12, color: theme.muted, fontSize: 13, border: `1px solid ${theme.line}` }}>
        ⟳ Obtendo localização GPS...
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div style={{ padding: '16px', background: theme.dangerSoft, borderRadius: 12, border: `1px solid ${theme.danger}55`, textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>📵</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: theme.danger, marginBottom: 4 }}>GPS desativado</div>
        <div style={{ fontSize: 12, color: theme.danger, lineHeight: 1.5 }}>
          Permita acesso à localização para registrar o ponto.
        </div>
      </div>
    );
  }

  if (status === 'unavailable') {
    return (
      <div style={{ padding: '16px', background: theme.warnSoft, borderRadius: 12, border: `1px solid ${theme.warn}55`, textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: theme.warn, marginBottom: 4 }}>GPS indisponível</div>
        <div style={{ fontSize: 12, color: theme.warn, lineHeight: 1.5 }}>
          Não foi possível obter sua localização. Verifique o GPS e tente novamente.
        </div>
      </div>
    );
  }

  const inside     = requireLocation ? isInsideZone : true;
  const okColor    = theme.ok;
  const badColor   = theme.danger;
  const dotColor   = inside ? okColor : badColor;
  const bgColor    = inside ? theme.okSoft : theme.dangerSoft;
  const bdColor    = inside ? okColor + '40' : badColor + '40';
  const statusText = requireLocation ? (isInsideZone ? 'Dentro da zona' : 'Fora da zona') : 'GPS obtido';
  const distLabel  = distanceMeters !== null ? `${Math.round(distanceMeters)}m da unidade` : 'Calculando distância...';

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: bgColor, borderRadius: 12, border: `1px solid ${bdColor}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: bgColor, border: `1px solid ${bdColor}`, display: 'grid', placeItems: 'center' }}>
          📍
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: dotColor, letterSpacing: '-0.01em' }}>{statusText}</div>
          <div style={{ fontSize: 11, color: dotColor + 'aa' }}>{distLabel}</div>
        </div>
      </div>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, display: 'inline-block', flexShrink: 0 }}/>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/employee/GpsStatus.jsx
git commit -m "feat(frontend): GpsStatus com tokens do tema"
```

---

### Task 6: EmployeeLayout — tab bar com tokens corretos

**Files:**
- Modify: `frontend/src/components/shared/EmployeeLayout.jsx`

- [ ] **Step 1: Atualizar tab bar para usar tokens do novo tema**

Substituir o NavLink style e nav style para usar `theme.card`, `theme.line`, `theme.primary`, `theme.subtle`:

```jsx
<nav style={{
  position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
  width: '100%', maxWidth: 480, display: 'flex',
  background: theme.card,
  borderTop: `1px solid ${theme.line}`,
  boxShadow: '0 -4px 16px rgba(0,0,0,0.15)',
}}>
  {tabs.map(({ to, label, Icon: TabIcon, badge }) => (
    <NavLink key={to} to={to} style={({ isActive }) => ({
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      padding: '10px 0', textDecoration: 'none',
      color: isActive ? theme.primary : theme.subtle,
    })}>
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <TabIcon size={20} strokeWidth={1.75} />
        {badge > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -6,
            background: theme.danger, color: '#fff',
            borderRadius: 10, fontSize: 9, fontWeight: 700,
            padding: '1px 4px', lineHeight: 1.4,
          }}>
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '-0.01em' }}>{label}</span>
    </NavLink>
  ))}
</nav>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/shared/EmployeeLayout.jsx
git commit -m "feat(frontend): tab bar do funcionário com tokens corretos"
```

---

### Task 7: Employee Sub-pages — tokens corretos

**Files:**
- Modify: `frontend/src/pages/employee/EmployeeHistoryPage.jsx`
- Modify: `frontend/src/pages/employee/EmployeeNotificationsPage.jsx`
- Modify: `frontend/src/pages/employee/ProfilePage.jsx`

- [ ] **Step 1: HistoryPage — substituir nomes de tokens**

Buscar e substituir no arquivo:
- `theme.textPrimary` → `theme.ink`
- `theme.textSecondary` → `theme.muted`
- `theme.textMuted` → `theme.subtle`
- `theme.accent` → `theme.primary`
- `theme.border` → `theme.line`
- `theme.elevated` → `theme.surface`
- `theme.success` → `theme.ok`
- `theme.warning` → `theme.warn`

Cards de histórico devem ter `background: theme.card, border: 1px solid theme.line, borderRadius: 14`.

- [ ] **Step 2: NotificationsPage — substituir nomes de tokens**

Mesmas substituições. Badge de "novas" usar `theme.primary` (não `theme.success`). Botões de ação usar `theme.primary` e `theme.danger`.

- [ ] **Step 3: ProfilePage — substituir nomes de tokens**

Mesmas substituições. Avatar: `background: linear-gradient(135deg, theme.primary, theme.violet)`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/employee/EmployeeHistoryPage.jsx \
        frontend/src/pages/employee/EmployeeNotificationsPage.jsx \
        frontend/src/pages/employee/ProfilePage.jsx
git commit -m "feat(frontend): sub-pages do funcionário com tokens do design system"
```

---

### Task 8: AdminLayout Redesign

**Files:**
- Modify: `frontend/src/components/shared/AdminLayout.jsx`

- [ ] **Step 1: Atualizar constantes de navegação com ícones SVG**

Substituir `ADMIN_NAV` e `GESTOR_NAV` para usar nomes de ícones do `Icon.jsx` (não emojis):

```js
import Icon  from './Icon';
import Logo  from './Logo';

const ADMIN_NAV = [
  { to: '/admin/dashboard',     label: 'Dashboard',     icon: 'dashboard' },
  { to: '/admin/employees',     label: 'Funcionários',  icon: 'users'     },
  { to: '/admin/clocks',        label: 'Registros',     icon: 'clock'     },
  { to: '/admin/photos',        label: 'Galeria',       icon: 'image'     },
  { to: '/admin/blocked',       label: 'Bloqueios',     icon: 'block'     },
  { to: '/admin/services',      label: 'Serviços',      icon: 'wrench'    },
  { to: '/admin/notifications', label: 'Notificações',  icon: 'bell'      },
  { to: '/admin/contracts',     label: 'Contratos',     icon: 'file'      },
  { to: '/admin/job-roles',     label: 'Cargos',        icon: 'tag'       },
  { to: '/admin/export',        label: 'Exportar',      icon: 'download'  },
];

const GESTOR_NAV = [
  { to: '/admin/employees',     label: 'Funcionários',  icon: 'users'  },
  { to: '/admin/clocks',        label: 'Registros',     icon: 'clock'  },
  { to: '/admin/photos',        label: 'Galeria',       icon: 'image'  },
  { to: '/admin/services',      label: 'Serviços',      icon: 'wrench' },
  { to: '/admin/notifications', label: 'Notificações',  icon: 'bell'   },
  { to: '/admin/contracts',     label: 'Contratos',     icon: 'file'   },
];
```

- [ ] **Step 2: Adicionar useTheme ao AdminLayout**

```js
import { useTheme } from '../../contexts/ThemeContext';
// dentro do componente:
const { theme, isDark, toggleTheme } = useTheme();
```

- [ ] **Step 3: Reescrever o JSX da sidebar para corresponder ao index.html**

Sidebar width 236px, `background: theme.card`, `borderRight: 1px solid theme.line`:
- Header: Logo + "PontoTools" + "Painel Admin"
- Barra de busca: `background: theme.hairline`, ícone search, texto "Buscar…", kbd ⌘K
- Nav: seção "OPERAÇÃO" (primeiros 7 itens), seção "CONFIGURAÇÃO" (últimos 3), cada item com Icon SVG, hover effect, item ativo `background: theme.surface`
- Footer: avatar gradient `primary → violet`, nome, email, botão logout com Icon "logout"

- [ ] **Step 4: Reescrever o header da área principal**

Header height 56px, `background: theme.card + 'cc'`, `backdropFilter: blur(8px)`, `borderBottom: 1px solid theme.line`:
- Breadcrumb: "PontoTools > [página atual]" em cores `theme.muted` e `theme.ink`
- Lado direito: botão toggle tema (☀️/🌙) + sino com badge

- [ ] **Step 5: Atualizar estilos do painel de notificações**

O `s.panel` e sub-componentes `NotifList`/`NotifDetail` devem usar tokens: `background: theme.card`, `border: 1px solid theme.line`, textos em `theme.ink`/`theme.muted`, hover em `theme.hairline`, não-lida `background: theme.primarySoft + '40'`.

- [ ] **Step 6: Atualizar TYPE_COLOR com novos tokens**

```js
const TYPE_COLOR = {
  service_assigned: '#818cf8', // primary (dark) / #4f46e5 (light)
  service_late:     '#fbbf24',
  service_problem:  '#f87171',
  manual:           '#c4b5fd',
};
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/shared/AdminLayout.jsx
git commit -m "feat(frontend): AdminLayout idêntico ao design index.html"
```

---

### Task 9: Verificação visual

- [ ] **Step 1: Rodar o dev server**

```bash
cd frontend && npm run dev
```

- [ ] **Step 2: Verificar cada tela lado a lado com o index.html**

Abrir `http://localhost:5173` e `index.html` (open in browser). Verificar:
- Login: fundo escuro, gradientes, dot-grid, card com sombra, logo correto
- Dashboard funcionário: hero clock escuro, botões com ícone + label + "Toque para registrar"
- Tab bar: cores certas (primary no ativo, subtle nos inativos)
- Admin sidebar: 236px, logo, search bar, seções, ícones SVG
- Modo escuro: tokens zinc-black (#09090b bg, #111113 card)

- [ ] **Step 3: Corrigir discrepâncias encontradas**

- [ ] **Step 4: Build final**

```bash
cd frontend && npm run build
```

Build deve completar sem erros TypeScript ou avisos críticos.

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "feat(frontend): redesign visual completo idêntico ao index.html"
```
