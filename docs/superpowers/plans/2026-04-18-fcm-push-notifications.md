# FCM Push Notifications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar Firebase Cloud Messaging no app Android para entregar notificações push mesmo com o app fechado, aproveitando a infra de `notifications` e `push_subscriptions` já existente no backend.

**Architecture:** O backend instala `firebase-admin`, cria `fcm.service.js` que envia via FCM Admin SDK, e a função `notify()` existente em `push.service.js` passa a chamar o FCM em paralelo com o Web Push. O app nativo instala `@react-native-firebase/messaging`, registra o token FCM via `POST /api/notifications/fcm-token` ao logar, e trata refresh de token.

**Tech Stack:** `firebase-admin` (backend Node.js), `@react-native-firebase/app` + `@react-native-firebase/messaging` (React Native 0.74.5 Android), Google Services Gradle plugin 4.4.2.

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `backend/firebase-service-account.json` | Já existe | Credenciais Admin SDK (nunca commitado) |
| `backend/.gitignore` | Modificar | Ignorar service account JSON |
| `backend/services/fcm.service.js` | Criar | Lazy-init Admin SDK, enviar FCM por employeeId |
| `backend/services/push.service.js` | Modificar | `notify()` chama `fcm.sendFcm()` em paralelo |
| `backend/controllers/notification.controller.js` | Modificar | Adicionar `saveFcmToken()` |
| `backend/routes/notification.routes.js` | Modificar | Rota `POST /fcm-token` |
| `mobile/android/app/google-services.json` | Já existe | Config Firebase Android |
| `mobile/android/build.gradle` | Modificar | Classpath Google Services plugin |
| `mobile/android/app/build.gradle` | Modificar | Apply Google Services plugin |
| `mobile/src/hooks/useFcmToken.ts` | Criar | Permissão, obtenção e registro de token |
| `mobile/App.tsx` | Modificar | Chamar `useFcmToken` quando logado |

---

### Task 1: Proteger credenciais no .gitignore

**Files:**
- Modify: `backend/.gitignore` (ou `.gitignore` raiz)

- [ ] **Step 1: Verificar se existe .gitignore no backend**

```bash
cat backend/.gitignore 2>/dev/null || echo "não existe"
cat .gitignore | grep -i firebase
```

- [ ] **Step 2: Adicionar firebase-service-account.json ao .gitignore raiz**

Abrir `.gitignore` na raiz do projeto e adicionar ao final:

```
# Firebase Admin SDK credentials
backend/firebase-service-account.json
```

- [ ] **Step 3: Verificar que o arquivo não será commitado**

```bash
git status backend/firebase-service-account.json
```

Resultado esperado: arquivo aparece como `untracked` mas **não** staged. Se aparecer como tracked, rodar:
```bash
git rm --cached backend/firebase-service-account.json
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: ignorar firebase-service-account.json"
```

---

### Task 2: Instalar firebase-admin no backend

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Instalar dependência**

```bash
cd backend && npm install firebase-admin
```

- [ ] **Step 2: Verificar instalação**

```bash
node -e "const a = require('firebase-admin'); console.log(a.SDK_VERSION)"
```

Resultado esperado: versão impressa (ex: `12.x.x`), sem erros.

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore(backend): instalar firebase-admin"
```

---

### Task 3: Criar fcm.service.js no backend

**Files:**
- Create: `backend/services/fcm.service.js`

- [ ] **Step 1: Criar o arquivo**

```javascript
// backend/services/fcm.service.js
const path   = require('path');
const db     = require('../config/database');
const logger = require('../utils/logger');

let messaging = null;

function getMessaging() {
  if (messaging) return messaging;

  const admin = require('firebase-admin');

  if (!admin.apps.length) {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
      || path.join(__dirname, '..', 'firebase-service-account.json');

    const serviceAccount = require(serviceAccountPath);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  messaging = admin.messaging();
  return messaging;
}

async function sendFcm(employeeId, title, body) {
  try {
    const result = await db.query(
      `SELECT id, fcm_token FROM push_subscriptions
       WHERE employee_id = $1 AND fcm_token IS NOT NULL`,
      [employeeId]
    );

    if (result.rows.length === 0) return 0;

    const tokens = result.rows.map((r) => r.fcm_token);

    const response = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      android: {
        priority: 'high',
        notification: { sound: 'default' },
      },
    });

    // Remover tokens inválidos
    const invalidIds = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const code = resp.error?.code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          invalidIds.push(result.rows[idx].id);
        }
      }
    });

    if (invalidIds.length > 0) {
      await db.query(
        `DELETE FROM push_subscriptions WHERE id = ANY($1::int[])`,
        [invalidIds]
      );
    }

    const sent = response.successCount;
    logger.info('FCM enviado', { employeeId, sent, total: tokens.length });
    return sent;
  } catch (err) {
    logger.error('Erro ao enviar FCM', { employeeId, error: err.message });
    return 0;
  }
}

module.exports = { sendFcm };
```

- [ ] **Step 2: Adicionar FIREBASE_SERVICE_ACCOUNT_PATH ao .env.example**

Abrir `backend/.env.example` (ou `.env.example` na raiz) e adicionar:

```
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

- [ ] **Step 3: Verificar sintaxe**

```bash
cd backend && node -e "require('./services/fcm.service')"
```

Resultado esperado: sem erros (não inicializa o SDK ainda, só carrega o módulo).

- [ ] **Step 4: Commit**

```bash
git add backend/services/fcm.service.js
git commit -m "feat(backend): criar fcm.service com sendFcm por employeeId"
```

---

### Task 4: Integrar FCM em notify() do push.service.js

**Files:**
- Modify: `backend/services/push.service.js`

- [ ] **Step 1: Adicionar import do fcm.service no topo do arquivo**

Abrir `backend/services/push.service.js` e adicionar logo após os imports existentes:

```javascript
const fcm = require('./fcm.service');
```

- [ ] **Step 2: Modificar a função notify() para chamar sendFcm em paralelo**

Localizar o bloco que envia Web Push (após `if (subs.rows.length === 0) return;`) e substituir o final da função para disparar FCM em paralelo:

```javascript
async function notify(employeeId, title, body, type = 'manual') {
  // 1. Persiste no banco
  const result = await db.query(
    `INSERT INTO notifications (employee_id, title, body, type)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [employeeId, title, body, type]
  );
  const notifId = result.rows[0].id;

  // 2. Busca subscriptions Web Push do funcionário
  const subs = await db.query(
    `SELECT id, endpoint, p256dh, auth
     FROM push_subscriptions WHERE employee_id = $1 AND endpoint IS NOT NULL`,
    [employeeId]
  );

  const payload = JSON.stringify({ title, body, type });
  let sent = 0;

  // 3. Web Push (browsers) e FCM (mobile) em paralelo
  const [webResults, fcmSent] = await Promise.all([
    subs.rows.length > 0
      ? Promise.allSettled(
          subs.rows.map((sub) =>
            webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            ).catch(async (err) => {
              if (err.statusCode === 410) {
                await db.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
              }
              throw err;
            })
          )
        )
      : Promise.resolve([]),
    fcm.sendFcm(employeeId, title, body),
  ]);

  sent += webResults.filter((r) => r.status === 'fulfilled').length;
  sent += fcmSent;

  if (sent > 0) {
    await db.query('UPDATE notifications SET push_sent = TRUE WHERE id = $1', [notifId]);
  }

  logger.info('Notificação enviada', { employeeId, type, sent, total: subs.rows.length });
}
```

- [ ] **Step 3: Verificar sintaxe**

```bash
cd backend && node -e "require('./services/push.service')"
```

Resultado esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add backend/services/push.service.js
git commit -m "feat(backend): notify() dispara FCM em paralelo com Web Push"
```

---

### Task 5: Rota POST /api/notifications/fcm-token no backend

**Files:**
- Modify: `backend/controllers/notification.controller.js`
- Modify: `backend/routes/notification.routes.js`

- [ ] **Step 1: Adicionar saveFcmToken no controller**

Abrir `backend/controllers/notification.controller.js` e adicionar ao final (antes de `module.exports`):

```javascript
// ----------------------------------------------------------------
// POST /api/notifications/fcm-token
// Salva ou atualiza o FCM token do device do usuário autenticado
// ----------------------------------------------------------------
async function saveFcmToken(req, res, next) {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return res.status(400).json({ error: 'Token FCM inválido.' });
    }

    const employeeId = req.user.id;
    const fcmToken   = token.trim();

    // Upsert: se o token já existe (mesmo device, outro user), reassocia ao user atual
    await db.query(
      `INSERT INTO push_subscriptions (employee_id, endpoint, p256dh, auth, fcm_token)
       VALUES ($1, $2, '', '', $2)
       ON CONFLICT (endpoint) DO UPDATE
         SET employee_id = EXCLUDED.employee_id,
             fcm_token   = EXCLUDED.fcm_token`,
      [employeeId, fcmToken]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
```

E adicionar `saveFcmToken` ao `module.exports` existente.

- [ ] **Step 2: Adicionar a rota no notification.routes.js**

Abrir `backend/routes/notification.routes.js`, importar `saveFcmToken` e adicionar a rota:

```javascript
const { list, markRead, markAllRead, subscribe, unsubscribe, send, saveFcmToken } = require('../controllers/notification.controller');
// ...
router.post('/fcm-token', saveFcmToken);
```

- [ ] **Step 3: Verificar que o servidor sobe sem erros**

```bash
cd backend && node -e "require('./server')" 2>&1 | head -5
```

Resultado esperado: sem erros de sintaxe (vai tentar conectar ao banco mas tudo bem sair com erro de conexão).

- [ ] **Step 4: Commit**

```bash
git add backend/controllers/notification.controller.js backend/routes/notification.routes.js
git commit -m "feat(backend): rota POST /api/notifications/fcm-token"
```

---

### Task 6: Configurar Gradle para Google Services (Android)

**Files:**
- Modify: `mobile/android/build.gradle`
- Modify: `mobile/android/app/build.gradle`

- [ ] **Step 1: Adicionar classpath do Google Services em android/build.gradle**

Abrir `mobile/android/build.gradle` e adicionar dentro de `dependencies {}` do `buildscript`:

```groovy
buildscript {
    // ...
    dependencies {
        classpath("com.android.tools.build:gradle")
        classpath("com.facebook.react:react-native-gradle-plugin")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin")
        classpath("com.google.gms:google-services:4.4.2")  // <-- adicionar
    }
}
```

- [ ] **Step 2: Aplicar o plugin em android/app/build.gradle**

Abrir `mobile/android/app/build.gradle` e adicionar no **final** do arquivo (após a última linha `apply from:`):

```groovy
apply plugin: 'com.google.gms.google-services'
```

- [ ] **Step 3: Commit**

```bash
git add mobile/android/build.gradle mobile/android/app/build.gradle
git commit -m "chore(android): configurar Google Services plugin para FCM"
```

---

### Task 7: Instalar SDKs Firebase no app nativo

**Files:**
- Modify: `mobile/package.json`

- [ ] **Step 1: Instalar pacotes**

```bash
cd mobile && npm install @react-native-firebase/app @react-native-firebase/messaging
```

- [ ] **Step 2: Verificar que os pacotes foram adicionados**

```bash
grep "react-native-firebase" mobile/package.json
```

Resultado esperado: duas linhas com `@react-native-firebase/app` e `@react-native-firebase/messaging`.

- [ ] **Step 3: Commit**

```bash
git add mobile/package.json mobile/package-lock.json
git commit -m "chore(mobile): instalar @react-native-firebase/app e messaging"
```

---

### Task 8: Criar hook useFcmToken.ts

**Files:**
- Create: `mobile/src/hooks/useFcmToken.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
// mobile/src/hooks/useFcmToken.ts
import { useEffect } from 'react';
import messaging from '@react-native-firebase/messaging';
import api from '../services/api';

async function registerToken(token: string) {
  try {
    await api.post('/notifications/fcm-token', { token });
  } catch {}
}

export function useFcmToken(isLoggedIn: boolean) {
  useEffect(() => {
    if (!isLoggedIn) return;

    let unsubRefresh: (() => void) | null = null;

    async function setup() {
      const authStatus = await messaging().requestPermission();
      const allowed =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!allowed) return;

      const token = await messaging().getToken();
      if (token) await registerToken(token);

      unsubRefresh = messaging().onTokenRefresh(registerToken);
    }

    setup();

    return () => {
      unsubRefresh?.();
    };
  }, [isLoggedIn]);
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/hooks/useFcmToken.ts
git commit -m "feat(mobile): hook useFcmToken — permissão, token e refresh"
```

---

### Task 9: Integrar useFcmToken em App.tsx

**Files:**
- Modify: `mobile/App.tsx`

- [ ] **Step 1: Importar e usar o hook em AppContent**

Abrir `mobile/App.tsx` e adicionar o import:

```typescript
import { useFcmToken } from './src/hooks/useFcmToken';
```

Dentro de `AppContent`, logo após a linha `const { user, loading } = useAuth();`, adicionar:

```typescript
useFcmToken(!!user);
```

- [ ] **Step 2: Verificar que o TypeScript compila**

```bash
cd mobile && npx tsc --noEmit 2>&1 | head -20
```

Resultado esperado: sem erros de tipo.

- [ ] **Step 3: Commit**

```bash
git add mobile/App.tsx
git commit -m "feat(mobile): registrar FCM token ao autenticar via useFcmToken"
```

---

### Task 10: Adicionar permissão POST_NOTIFICATIONS no AndroidManifest

**Files:**
- Modify: `mobile/android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: Verificar o manifesto atual**

```bash
cat mobile/android/app/src/main/AndroidManifest.xml
```

- [ ] **Step 2: Adicionar permissão (Android 13+)**

Dentro de `<manifest>`, antes de `<application>`, garantir que existe:

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
```

- [ ] **Step 3: Commit**

```bash
git add mobile/android/app/src/main/AndroidManifest.xml
git commit -m "chore(android): adicionar permissão POST_NOTIFICATIONS para FCM"
```

---

### Task 11: Commit final e verificação

- [ ] **Step 1: Verificar git log dos commits desta feature**

```bash
git log --oneline -12
```

Confirmar que todos os commits das Tasks 1–10 estão presentes.

- [ ] **Step 2: Verificar que google-services.json e firebase-service-account.json não são tracked**

```bash
git status --short | grep -E "firebase|google-services"
```

Resultado esperado: nenhuma linha (ambos ignorados pelo .gitignore).

- [ ] **Step 3: Build de verificação (opcional, requer Android SDK)**

```bash
cd mobile/android && ./gradlew assembleDebug 2>&1 | tail -5
```

Resultado esperado: `BUILD SUCCESSFUL`.
