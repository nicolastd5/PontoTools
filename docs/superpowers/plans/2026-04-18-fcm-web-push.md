# FCM Web Push Notifications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar Firebase Cloud Messaging no frontend React (PWA) para entregar notificações push web mesmo com a aba fechada, substituindo o Web Push VAPID existente pelo FCM que já está configurado no backend.

**Architecture:** O frontend instala o Firebase JS SDK, cria um service worker dedicado ao FCM (`firebase-messaging-sw.js` em `public/`), e um hook `useFcmWeb` que solicita permissão, obtém o FCM token e o registra via `POST /api/notifications/fcm-token`. O backend já suporta tokens FCM via `fcm.service.js` e a rota `POST /api/notifications/fcm-token` (implementados na fase mobile). O Web Push VAPID existente é mantido em paralelo — FCM é adicionado como canal extra.

**Tech Stack:** `firebase` JS SDK v10+ (npm), `firebase-messaging-sw.js` (service worker dedicado FCM), React hook, Vite env vars.

---

## Contexto importante

- `frontend/public/sw-push.js` — service worker atual para Web Push VAPID (mantido, não removido)
- `frontend/vite.config.js` — usa VitePWA com `workbox` mode; o `sw-push.js` é injetado via `importScripts`
- `frontend/src/pages/employee/EmployeeNotificationsPage.jsx` — já tem UI de push (banner ativar/desativar VAPID); vamos adicionar FCM ao lado
- `backend/routes/notification.routes.js` — já tem `POST /fcm-token` protegida por `auth`
- Firebase config web: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId` já conhecidos

## Firebase Web Config

```javascript
const firebaseConfig = {
  apiKey:            "AIzaSyC6ZcD2wEE5dvQLBpgEG8jLKCBY7H67zmQ",
  authDomain:        "servicestools-57118.firebaseapp.com",
  projectId:         "servicestools-57118",
  storageBucket:     "servicestools-57118.firebasestorage.app",
  messagingSenderId: "88769605854",
  appId:             "1:88769605854:web:9febc845d5ee487cfad24f",
};
```

O `messagingSenderId` (88769605854) é o VAPID key público do FCM — usado no service worker.

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `frontend/public/firebase-messaging-sw.js` | Criar | Service worker FCM — recebe mensagens em background |
| `frontend/src/hooks/useFcmWeb.js` | Criar | Solicitar permissão, obter token FCM, registrar no backend |
| `frontend/src/pages/employee/EmployeeNotificationsPage.jsx` | Modificar | Chamar `useFcmWeb` e mostrar status FCM no banner |
| `frontend/.env.example` | Modificar | Documentar novas vars Firebase |
| `frontend/.env` (local, não commitado) | Modificar manualmente | Adicionar vars Firebase |

---

### Task 1: Criar firebase-messaging-sw.js em public/

**Files:**
- Create: `frontend/public/firebase-messaging-sw.js`

O FCM exige um service worker em `/firebase-messaging-sw.js` na raiz do domínio. Este arquivo é servido estaticamente pelo Nginx em produção (já está em `frontend/dist/` após build) ou pelo Vite dev server (arquivos de `public/` são servidos na raiz).

- [ ] **Step 1: Criar o arquivo**

```javascript
// frontend/public/firebase-messaging-sw.js
// Service worker dedicado ao Firebase Cloud Messaging
// Deve estar em /firebase-messaging-sw.js (raiz do domínio)

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyC6ZcD2wEE5dvQLBpgEG8jLKCBY7H67zmQ',
  authDomain:        'servicestools-57118.firebaseapp.com',
  projectId:         'servicestools-57118',
  storageBucket:     'servicestools-57118.firebasestorage.app',
  messagingSenderId: '88769605854',
  appId:             '1:88769605854:web:9febc845d5ee487cfad24f',
});

const messaging = firebase.messaging();

// Recebe mensagens quando o app está em background/fechado
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Gerenciador de Serviços';
  const body  = payload.notification?.body  || '';

  self.registration.showNotification(title, {
    body,
    icon:    '/icons/icon-192.svg',
    badge:   '/icons/icon-192.svg',
    vibrate: [200, 100, 200],
  });
});
```

- [ ] **Step 2: Verificar que o arquivo está em public/ e será servido na raiz**

```bash
ls frontend/public/firebase-messaging-sw.js
```

Resultado esperado: arquivo existe.

- [ ] **Step 3: Commit**

```bash
git add frontend/public/firebase-messaging-sw.js
git commit -m "feat(web): service worker FCM para notificações em background"
```

---

### Task 2: Instalar Firebase JS SDK no frontend

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Instalar**

```bash
cd frontend && npm install firebase
```

- [ ] **Step 2: Verificar**

```bash
node -e "const f = require('./node_modules/firebase/package.json'); console.log(f.version)"
```

Resultado esperado: versão `10.x.x` impressa.

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(frontend): instalar firebase JS SDK"
```

---

### Task 3: Criar hook useFcmWeb.js

**Files:**
- Create: `frontend/src/hooks/useFcmWeb.js`

Este hook inicializa o Firebase App, obtém o FCM token usando a VAPID key pública do FCM (o `messagingSenderId` convertido — mas o FCM web usa uma VAPID key diferente que vem do console Firebase → Project Settings → Cloud Messaging → Web Push certificates). 

**Importante:** A VAPID key do FCM web (também chamada de "Web Push certificate key pair") é diferente da `VITE_VAPID_PUBLIC_KEY` existente. Ela fica em Firebase Console → Project Settings → Cloud Messaging → "Web configuration" → "Key pair". Como não a temos ainda, usaremos uma env var `VITE_FIREBASE_VAPID_KEY`.

- [ ] **Step 1: Criar o arquivo**

```javascript
// frontend/src/hooks/useFcmWeb.js
import { useEffect, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import api from '../services/api';

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyC6ZcD2wEE5dvQLBpgEG8jLKCBY7H67zmQ',
  authDomain:        'servicestools-57118.firebaseapp.com',
  projectId:         'servicestools-57118',
  storageBucket:     'servicestools-57118.firebasestorage.app',
  messagingSenderId: '88769605854',
  appId:             '1:88769605854:web:9febc845d5ee487cfad24f',
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

function getFirebaseMessaging() {
  const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
  return getMessaging(app);
}

async function registerFcmToken() {
  try {
    const messaging = getFirebaseMessaging();
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) return;
    await api.post('/notifications/fcm-token', { token });
  } catch (err) {
    console.warn('[FCM] Falha ao registrar token:', err.message);
  }
}

export function useFcmWeb(isLoggedIn) {
  const unsubRef = useRef(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    if (!VAPID_KEY) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    registerFcmToken();

    // Recebe mensagens quando o app está em foreground
    try {
      const messaging = getFirebaseMessaging();
      unsubRef.current = onMessage(messaging, (payload) => {
        const title = payload.notification?.title || 'Gerenciador de Serviços';
        const body  = payload.notification?.body  || '';
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, {
            body,
            icon: '/icons/icon-192.svg',
          });
        }
      });
    } catch {}

    return () => {
      unsubRef.current?.();
    };
  }, [isLoggedIn]);
}
```

- [ ] **Step 2: Verificar que o arquivo existe**

```bash
ls frontend/src/hooks/useFcmWeb.js
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useFcmWeb.js
git commit -m "feat(web): hook useFcmWeb — init Firebase, token FCM, foreground messages"
```

---

### Task 4: Documentar env vars e obter VAPID key do FCM

**Files:**
- Modify: `frontend/.env.example` (ou `.env.example` na raiz)

O hook usa `VITE_FIREBASE_VAPID_KEY`. Esta key deve ser obtida em:
**Firebase Console → Project Settings → Cloud Messaging → Web configuration → Generate key pair** (se não existir) → copiar o valor da coluna "Key pair".

- [ ] **Step 1: Adicionar ao .env.example**

Abrir `frontend/.env.example` (ou criar se não existir) e adicionar:

```
# Firebase Web Push (FCM)
# Obter em: Firebase Console → Project Settings → Cloud Messaging → Web configuration → Key pair
VITE_FIREBASE_VAPID_KEY=sua_vapid_key_aqui
```

- [ ] **Step 2: Verificar se existe .env local e adicionar a var**

```bash
cat frontend/.env 2>/dev/null || echo "arquivo nao existe"
```

Se existir, adicionar manualmente (fora do git):
```
VITE_FIREBASE_VAPID_KEY=<valor_copiado_do_firebase_console>
```

**Nota:** Este step requer ação manual do desenvolvedor no Firebase Console.

- [ ] **Step 3: Commit do .env.example**

```bash
git add frontend/.env.example
git commit -m "chore(frontend): documentar VITE_FIREBASE_VAPID_KEY para FCM web"
```

---

### Task 5: Integrar useFcmWeb em EmployeeNotificationsPage

**Files:**
- Modify: `frontend/src/pages/employee/EmployeeNotificationsPage.jsx`

O hook `useFcmWeb` deve ser chamado quando o usuário já deu permissão (`pushGranted`). O banner existente já controla a permissão VAPID — aproveitamos o mesmo estado `pushGranted` para ativar o FCM também.

- [ ] **Step 1: Adicionar import do hook**

No topo do arquivo, após os imports existentes:

```javascript
import { useFcmWeb } from '../../hooks/useFcmWeb';
```

- [ ] **Step 2: Chamar o hook dentro do componente**

Logo após as declarações de estado existentes (após `const [subscribing, setSubscribing] = useState(false);`), adicionar:

```javascript
const { user } = useAuth();
useFcmWeb(pushGranted && !!user);
```

- [ ] **Step 3: Adicionar import do useAuth**

```javascript
import { useAuth } from '../../contexts/AuthContext';
```

- [ ] **Step 4: Atualizar a função enablePush para também registrar FCM token após conceder permissão**

Na função `enablePush`, após `setPushGranted(true);` e antes do bloco de VAPID subscribe, adicionar:

```javascript
// FCM token registrado automaticamente pelo useFcmWeb quando pushGranted = true
```

O hook já monitora `pushGranted` via `isLoggedIn` — quando `pushGranted` mudar para `true`, o hook vai registrar automaticamente o FCM token na próxima renderização.

- [ ] **Step 5: Verificar que não há erros de import**

```bash
cd frontend && npx vite build 2>&1 | tail -10
```

Resultado esperado: `✓ built in` sem erros de módulo.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/employee/EmployeeNotificationsPage.jsx
git commit -m "feat(web): integrar useFcmWeb na página de notificações"
```

---

### Task 6: Verificação final

- [ ] **Step 1: Verificar git log**

```bash
git log --oneline -6
```

Confirmar presença dos commits das Tasks 1–5.

- [ ] **Step 2: Verificar que firebase-messaging-sw.js está em public/**

```bash
ls frontend/public/
```

Resultado esperado: `firebase-messaging-sw.js` listado.

- [ ] **Step 3: Lembrete sobre VAPID key manual**

A `VITE_FIREBASE_VAPID_KEY` precisa ser:
1. Obtida no Firebase Console → Project Settings → Cloud Messaging → Web configuration
2. Adicionada ao `.env` local em `frontend/`
3. Configurada como variável de ambiente no servidor EC2 (ou no processo de build)

Sem ela, o hook silenciosamente não registra tokens (early return no `if (!VAPID_KEY)`).
