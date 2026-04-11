# Design: Serviços + Notificações no App Android

**Data:** 2026-04-11  
**Escopo:** Adicionar as telas de Serviços e Notificações ao app React Native Android, com push nativo via FCM.

---

## 1. Navegação

O `App.tsx` gerencia a tela ativa via `useState<Screen>`. O tipo `Screen` será expandido de `'dashboard' | 'history'` para `'dashboard' | 'history' | 'services' | 'notifications'`.

A tab bar, atualmente duplicada em `DashboardScreen` e `HistoryScreen`, será extraída para um componente compartilhado `TabBar` em `mobile/src/components/TabBar.tsx`. Ele recebe `active`, `onNavigate`, e `unreadCount` (badge de avisos). Isso evita quadruplicar o código.

Layout: tab bar fixa na parte **inferior** da tela, com 4 abas:
- 🕐 Ponto
- 📋 Histórico  
- 🔧 Serviços
- 🔔 Avisos (badge vermelho se `unreadCount > 0`)

---

## 2. ServicesScreen

**Arquivo:** `mobile/src/screens/ServicesScreen.tsx`

### Dados
- `GET /api/services/my` — lista ordens atribuídas ao funcionário logado
- `PUT /api/services/:id/status` — atualiza status (`in_progress`, `done`, `problem`)
- `POST /api/services/:id/photos` — envia foto da ordem (multipart)

### Interface
- Lista com `FlatList` + pull-to-refresh
- Cada item exibe: título, descrição resumida, badge de status colorido, data agendada
- Status badges: `pending` (cinza), `in_progress` (amarelo), `done` (verde), `problem` (vermelho)
- Toque abre **modal de detalhe** (bottom sheet)

### Modal de detalhe
Campos exibidos: título, descrição completa, localização, data, fotos existentes (scroll horizontal de thumbnails).

Ações disponíveis conforme o status atual:
- `pending` → botão **Iniciar** (→ `in_progress`)
- `in_progress` → botões **Concluir** (→ `done`, solicita foto) e **Reportar problema** (→ `problem`, solicita texto)
- `done` / `problem` → somente visualização

Fotos: mesmo padrão do `DashboardScreen` — `launchCamera` com opções frontal/traseira, preview de thumbnails com botão de remover, limite por `max_photos` da ordem.

### Tratamento de erros
- Falha de rede: Alert nativo com mensagem do backend
- Status já atualizado por outro dispositivo: reload silencioso da lista

---

## 3. NotificationsScreen

**Arquivo:** `mobile/src/screens/NotificationsScreen.tsx`

### Dados
- `GET /api/notifications` — lista + contagem `unread`
- `PATCH /api/notifications/:id/read` — marca individual como lida
- `PATCH /api/notifications/read-all` — marca todas como lidas
- `POST /api/notifications/subscribe-fcm` — registra token FCM no backend (novo endpoint)
- `DELETE /api/notifications/subscribe-fcm` — remove token FCM

### Interface
- Lista com `FlatList` + pull-to-refresh
- Notificações não lidas com fundo levemente destacado (azul claro)
- Timestamp relativo: "agora", "há 5 min", "há 2h", "ontem", "dd/MM"
- Botão "Marcar todas como lidas" no topo (visível apenas se `unread > 0`)
- Toque em item: marca como lida

### Push Nativo (FCM)
Ao montar a tela, o app solicita permissão de notificações do Android usando `@react-native-firebase/messaging`. Se concedida, obtém o FCM token e o registra no backend via `POST /api/notifications/subscribe-fcm`.

O token é armazenado no `AsyncStorage` para evitar reenvio desnecessário. A cada mount, compara o token atual com o armazenado — só chama o endpoint se mudou.

Quando o app está em **background ou fechado**, o FCM entrega a notificação diretamente ao SO Android (notification payload no FCM message). Quando está em **foreground**, o handler `onMessage` exibe um Alert nativo com título e corpo.

---

## 4. Backend — Suporte a FCM

### Nova migration: `database/10_fcm_token.sql`
Adiciona coluna `fcm_token TEXT` na tabela `push_subscriptions`:
```sql
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS fcm_token TEXT;
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_fcm ON push_subscriptions(fcm_token) WHERE fcm_token IS NOT NULL;
```

### Novos endpoints em `notification.routes.js`
- `POST /api/notifications/subscribe-fcm` — salva token FCM (upsert por `employee_id`)
- `DELETE /api/notifications/subscribe-fcm` — remove token FCM do funcionário

### `push.service.js` — função `notifyFcm`
Nova função que, além de enviar Web Push VAPID (existente), também envia via FCM usando `firebase-admin` se o funcionário tiver `fcm_token` registrado.

```
notify() chama:
  - webpush.sendNotification() para subscriptions Web Push (existente)
  - admin.messaging().send() para tokens FCM (novo)
```

### Variáveis de ambiente novas
```
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```
Configuradas via `firebase-admin` SDK com service account JSON.

---

## 5. Compartilhado — `unreadCount` state

O `unreadCount` precisa ser visível na tab bar de todas as telas. Como o app não usa Context para isso ainda, a solução mais simples é: `App.tsx` faz polling de `GET /api/notifications` a cada 30s e passa `unreadCount` como prop para o componente `TabBar`. Quando `NotificationsScreen` marca notificações como lidas, chama `onUnreadChange(0)` que atualiza o estado em `App.tsx`.

---

## 6. Arquivos afetados

| Arquivo | Ação |
|---------|------|
| `mobile/App.tsx` | Expandir Screen type, adicionar polling de unread, passar props para TabBar |
| `mobile/src/components/TabBar.tsx` | Criar — tab bar reutilizável com badge |
| `mobile/src/screens/DashboardScreen.tsx` | Substituir tab bar inline por `<TabBar>` |
| `mobile/src/screens/HistoryScreen.tsx` | Substituir tab bar inline por `<TabBar>` |
| `mobile/src/screens/ServicesScreen.tsx` | Criar |
| `mobile/src/screens/NotificationsScreen.tsx` | Criar |
| `backend/controllers/notification.controller.js` | Adicionar `subscribeFcm`, `unsubscribeFcm` |
| `backend/routes/notification.routes.js` | Registrar novos endpoints |
| `backend/services/push.service.js` | Adicionar `notifyFcm` integrado ao `notify()` |
| `database/10_fcm_token.sql` | Criar — migration para coluna fcm_token |

---

## 7. Dependências novas (mobile)
- `@react-native-firebase/app` — base obrigatória do Firebase
- `@react-native-firebase/messaging` — FCM + permissões de notificação

## 8. Dependências novas (backend)
- `firebase-admin` — SDK para envio FCM server-side
