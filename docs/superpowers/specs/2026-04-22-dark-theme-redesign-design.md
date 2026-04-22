# Design — Redesign tema escuro (telas do funcionário)

**Data:** 2026-04-22  
**Escopo:** Web PWA (frontend/) + App Android (mobile/)  
**Telas afetadas:** somente o fluxo do funcionário; painel admin inalterado

---

## Decisões

| Decisão | Escolha |
|---|---|
| Tema | Escuro por padrão; toggle para claro salvo em `localStorage` (web) e `AsyncStorage` (mobile) |
| Perfil | Nova tela básica: avatar com iniciais, nome, unidade, cargo, toggle de tema, botão logout |
| Ícones web | `lucide-react` (tree-shakeable, SVG inline) |
| Ícones mobile | `react-native-vector-icons/Ionicons` |
| Tokens | Objeto centralizado `theme.js` (web) e `theme.ts` (mobile); componentes leem tokens, nunca cores hardcoded |

---

## Tokens de design

### Tema escuro (padrão)

```js
const dark = {
  bg:       '#0d0f1a',   // fundo principal
  surface:  '#151825',   // cards, seções
  elevated: '#1e2235',   // inputs, botões inativos
  border:   'rgba(255,255,255,0.08)',
  textPrimary:   '#ffffff',
  textSecondary: '#8b92a9',
  textMuted:     '#4a5068',
  accent:   '#6c5ce7',   // logo, nav ativo, destaques
  success:  '#22c55e',   // GPS ok, Entrada
  warning:  '#f59e0b',   // Início Intervalo ativo
  danger:   '#ef4444',   // Saída, fora da zona
  info:     '#3b82f6',   // Fim Intervalo
};
```

### Tema claro (toggle)

```js
const light = {
  bg:       '#f8fafc',
  surface:  '#ffffff',
  elevated: '#f1f5f9',
  border:   '#e2e8f0',
  textPrimary:   '#0f172a',
  textSecondary: '#64748b',
  textMuted:     '#94a3b8',
  accent:   '#6c5ce7',
  success:  '#16a34a',
  warning:  '#d97706',
  danger:   '#dc2626',
  info:     '#0369a1',
};
```

---

## Arquitetura de tema

### Web (`frontend/`)

- Criar `src/theme.js` com `darkTheme` e `lightTheme`
- Criar `src/contexts/ThemeContext.jsx`:
  - Estado `isDark` inicializado de `localStorage.getItem('theme') === 'dark'` (padrão `true`)
  - `toggleTheme()` alterna e salva em `localStorage`
  - Exporta `useTheme()` hook
- Envolver `<App>` com `<ThemeProvider>`
- Aplicar `isDark ? darkTheme : lightTheme` ao `document.body` via CSS variables ou passagem direta para os componentes

### Mobile (`mobile/`)

- Criar `src/theme.ts` com `darkTheme` e `lightTheme`
- Criar `src/contexts/ThemeContext.tsx`:
  - Estado `isDark` inicializado de `AsyncStorage.getItem('theme')` (padrão `true`)
  - `toggleTheme()` alterna e persiste
  - Exporta `useTheme()` hook
- Envolver `<AppNavigator>` com `<ThemeProvider>`

---

## Telas a alterar

### Web (`frontend/src/`)

| Arquivo | Mudança |
|---|---|
| `pages/LoginPage.jsx` | Fundo escuro, logo roxa, título "PontoTools", inputs dark, botão branco com "Entrar →" |
| `components/shared/EmployeeLayout.jsx` | Remover header azul; adicionar saudação "Olá / Nome" + avatar com iniciais; nav inferior com ícones Lucide; aba Perfil |
| `pages/employee/EmployeeDashboardPage.jsx` | Relógio grande com dia da semana em roxo acima; cards GPS e serviço ativo no estilo dark; botões de ponto com cores dos tokens |
| `pages/employee/EmployeeHistoryPage.jsx` | Agrupamento por data (HOJE, DD MMM); badge "Fora" vermelho; remover paginação de datas (scroll contínuo) |
| `pages/employee/EmployeeNotificationsPage.jsx` | Header "AVISOS / Notificações" + badge "N novas"; itens com ícone colorido em círculo; leitura ao tocar |
| `pages/employee/ProfilePage.jsx` (novo) | Avatar iniciais, nome, unidade, cargo, toggle tema, botão logout |

### Mobile (`mobile/src/`)

| Arquivo | Mudança |
|---|---|
| `screens/LoginScreen.tsx` | Mesmo visual do web: fundo escuro, logo roxa, título "PontoTools" |
| `components/TabBar.tsx` | Ícones Ionicons outline; 5 abas (adicionar Perfil); cor ativa `accent` |
| `screens/DashboardScreen.tsx` | Saudação + avatar; relógio com dia da semana; cards GPS/serviço; botões com tokens |
| `screens/HistoryScreen.tsx` | Agrupamento por data; badge "Fora"; dots coloridos por tipo |
| `screens/NotificationsScreen.tsx` | Header com badge; ícones coloridos em círculo |
| `screens/ProfileScreen.tsx` (novo) | Avatar, dados do usuário, toggle tema, logout |

---

## Ícones de navegação (mobile — Ionicons)

| Aba | Ícone inativo | Ícone ativo |
|---|---|---|
| Ponto | `time-outline` | `time` |
| Histórico | `list-outline` | `list` |
| Serviços | `construct-outline` | `construct` |
| Avisos | `notifications-outline` | `notifications` |
| Perfil | `person-outline` | `person` |

## Ícones de navegação (web — Lucide)

| Aba | Componente |
|---|---|
| Ponto | `<Clock />` |
| Histórico | `<List />` |
| Serviços | `<Wrench />` |
| Avisos | `<Bell />` |
| Perfil | `<User />` |

---

## Comportamento do relógio (Dashboard)

- Linha superior: dia da semana em caps + cor `accent` (ex: `QUARTA-FEIRA`)
- Linha central: `HH:mm` em fonte grande bold + `:ss` em fonte menor com `opacity: 0.5`
- Linha inferior: `DD de mês` em `textSecondary`
- `font-variant-numeric: tabular-nums` para evitar salto dos dígitos

---

## Histórico — agrupamento por data

Os registros retornados por `GET /clock/history` são agrupados no frontend por data local (usando `formatInTimeZone`). O agrupamento é feito client-side; a API não muda. No web, a paginação existente é mantida mas os resultados de cada página são exibidos agrupados.

---

## Dependências novas

| Pacote | Onde | Versão sugerida |
|---|---|---|
| `lucide-react` | frontend | `^0.460.0` |
| `react-native-vector-icons` | mobile | `^10.x` |
| `@types/react-native-vector-icons` | mobile (dev) | `^6.x` |

> **Atenção:** `react-native-vector-icons` requer configuração nativa Android: adicionar `apply from: "../../node_modules/react-native-vector-icons/fonts.gradle"` no `android/app/build.gradle`. Isso deve ser feito como primeiro passo do mobile no plano de implementação.

---

## O que NÃO muda

- Toda a lógica de negócio (GPS, câmera, batida de ponto, serviços)
- Painel admin (AdminLayout, páginas admin)
- API backend
- Estrutura de rotas
