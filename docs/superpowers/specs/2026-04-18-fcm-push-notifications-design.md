# FCM Push Notifications — Design Spec
**Data:** 2026-04-18  
**Escopo:** App nativo Android (fase 1). Web app em fase futura separada.

## Contexto

O backend já persiste notificações em `notifications` e envia Web Push (VAPID) via `push.service.js`. A tabela `push_subscriptions` já tem a coluna `fcm_token` (migration 10). O app nativo usa polling de 30s para buscar notificações, sem entrega com app fechado.

## Objetivo

Integrar Firebase Cloud Messaging (FCM) para entregar notificações push nativas no Android mesmo com o app fechado, sem custo adicional (plano Spark gratuito).

## Eventos que disparam push

Todos os eventos que já chamam `notify()` no backend:
- `service_assigned` — novo serviço atribuído ao funcionário
- `service_late` — serviço atrasado (cron horário)
- `service_problem` — funcionário reportou problema em serviço
- `manual` — notificação administrativa criada manualmente

## Arquitetura

```
[App Android]
  └─ @react-native-firebase/messaging
       ├─ solicita permissão ao usuário
       ├─ obtém FCM token
       └─ POST /api/notifications/fcm-token → backend salva token

[Backend]
  └─ push.service.js → notify()
       ├─ INSERT notifications (banco)
       ├─ Web Push VAPID (subscriptions existentes)
       └─ fcm.service.js → firebase-admin.sendEachForMulticast()
            └─ busca fcm_token em push_subscriptions WHERE employee_id
```

## Componentes

### Mobile

**`google-services.json`** em `mobile/android/app/`  
Arquivo gerado pelo Firebase Console para o package `com.pontomobile`.

**`mobile/android/build.gradle`**  
Adicionar classpath do plugin Google Services:
```
classpath('com.google.gms:google-services:4.4.2')
```

**`mobile/android/app/build.gradle`**  
Adicionar no final:
```
apply plugin: 'com.google.gms.google-services'
```

**Dependências npm** (em `mobile/`):
```
@react-native-firebase/app
@react-native-firebase/messaging
```

**`mobile/src/hooks/useFcmToken.ts`** (novo)  
Responsabilidade única: solicitar permissão, obter token, registrar no backend, tratar `onTokenRefresh`.  
- Só executa quando `user` está autenticado  
- Registra token via `POST /api/notifications/fcm-token`  
- Retries silenciosos em falha de rede  

**`mobile/App.tsx`**  
Chama `useFcmToken()` dentro de `AppContent`, após `user` estar disponível.

### Backend

**`firebase-service-account.json`** (nunca commitado)  
Gerado em Firebase Console → Project Settings → Service Accounts → Generate new private key.  
Adicionado ao `.gitignore`.

**`.env`** — nova variável:
```
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

**`backend/services/fcm.service.js`** (novo)  
- Inicializa `firebase-admin` com Service Account na primeira chamada (lazy init)  
- Expõe `sendFcm(employeeId, title, body)`:  
  1. Busca todos os `fcm_token` ativos do funcionário em `push_subscriptions`  
  2. Chama `messaging().sendEachForMulticast()`  
  3. Remove tokens inválidos (erros `registration-token-not-registered`)  

**`backend/services/push.service.js`** — `notify()` atualizado  
Adiciona chamada a `fcm.sendFcm()` em paralelo com o envio Web Push existente. Falha no FCM é logada mas não propaga erro (não quebra a notificação no banco).

**`backend/controllers/notification.controller.js`** — nova função `saveFcmToken`  
Rota: `POST /api/notifications/fcm-token`  
Body: `{ token: string }`  
Comportamento:
- Upsert em `push_subscriptions` usando `(employee_id, fcm_token)` como chave lógica  
- Se o mesmo token já existe para outro employee (app reinstalado), atualiza `employee_id`  
- Requer auth (`requireEmployee` ou qualquer role)

**`backend/routes/notification.routes.js`**  
Adicionar: `router.post('/fcm-token', auth, saveFcmToken)`

### Banco de dados

Nenhuma migration necessária — `fcm_token` já existe em `push_subscriptions`.

## Segurança

- `firebase-service-account.json` nunca entra no git (`.gitignore`)  
- Token FCM é per-device; rotação tratada via `onTokenRefresh`  
- Tokens inválidos são removidos automaticamente após falha de envio  

## Fora de escopo (fase 1)

- Web app (frontend React) — implementado em fase futura separada  
- Notificações com ação clicável (deep link para tela específica)  
- Tópicos FCM (broadcast para grupos)  
