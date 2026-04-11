# Mobile Services + Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar telas de Serviços e Notificações (com push FCM nativo) ao app React Native Android, expandindo a navegação de 2 para 4 abas na parte inferior.

**Architecture:** Tab bar fixa extraída para componente `TabBar` compartilhado. `App.tsx` gerencia `unreadCount` via polling e passa como prop. Backend ganha coluna `fcm_token` e endpoints para registrar token FCM, com `firebase-admin` enviando push para dispositivos Android.

**Tech Stack:** React Native 0.74.5, TypeScript, `@react-native-firebase/messaging`, `firebase-admin` (backend), PostgreSQL, Axios, `react-native-image-picker`.

---

## Estrutura de Arquivos

| Arquivo | Ação |
|---------|------|
| `mobile/src/components/TabBar.tsx` | Criar — tab bar reutilizável com 4 abas e badge |
| `mobile/src/screens/ServicesScreen.tsx` | Criar — lista de ordens + modal de detalhe/ação |
| `mobile/src/screens/NotificationsScreen.tsx` | Criar — lista de avisos + registro FCM |
| `mobile/App.tsx` | Modificar — Screen type expandido, polling unread, render condicional |
| `mobile/src/screens/DashboardScreen.tsx` | Modificar — substituir tab bar inline por `<TabBar>` |
| `mobile/src/screens/HistoryScreen.tsx` | Modificar — substituir tab bar inline por `<TabBar>` |
| `database/10_fcm_token.sql` | Criar — migration coluna fcm_token |
| `backend/controllers/notification.controller.js` | Modificar — subscribeFcm, unsubscribeFcm |
| `backend/routes/notification.routes.js` | Modificar — registrar novos endpoints |
| `backend/services/push.service.js` | Modificar — envio FCM via firebase-admin |

---

## Task 1: Migration — coluna fcm_token

**Files:**
- Create: `database/10_fcm_token.sql`

- [ ] **Step 1: Criar migration**

```sql
-- database/10_fcm_token.sql
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS fcm_token TEXT;
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_fcm
  ON push_subscriptions(fcm_token)
  WHERE fcm_token IS NOT NULL;
```

- [ ] **Step 2: Rodar no banco de produção (AWS)**

```bash
psql $DATABASE_URL -f database/10_fcm_token.sql
```

Saída esperada: `ALTER TABLE` e `CREATE INDEX`

- [ ] **Step 3: Commit**

```bash
git add database/10_fcm_token.sql
git commit -m "feat: add fcm_token column to push_subscriptions"
```

---

## Task 2: Backend — instalar firebase-admin e configurar

**Files:**
- Modify: `backend/package.json` (via npm install)
- Modify: `backend/services/push.service.js`

- [ ] **Step 1: Instalar firebase-admin**

```bash
cd backend && npm install firebase-admin
```

- [ ] **Step 2: Obter credenciais do Firebase**

No console do Firebase (console.firebase.google.com):
1. Crie um projeto (ou use existente) — Project Settings → Service Accounts
2. Clique em "Generate new private key" — baixa um JSON
3. Extraia do JSON os campos: `project_id`, `client_email`, `private_key`
4. Adicione ao `.env` do backend:

```
FIREBASE_PROJECT_ID=seu-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@seu-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

- [ ] **Step 3: Atualizar push.service.js — inicializar firebase-admin e adicionar notifyFcm**

Substituir o conteúdo de `backend/services/push.service.js` por:

```js
const webpush = require('web-push');
const admin   = require('firebase-admin');
const db      = require('../config/database');
const logger  = require('../utils/logger');

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:admin@pontotools.shop',
  process.env.VAPID_PUBLIC_KEY  || '',
  process.env.VAPID_PRIVATE_KEY || '',
);

// Inicializa firebase-admin apenas uma vez
if (!admin.apps.length && process.env.FIREBASE_PROJECT_ID) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

async function notify(employeeId, title, body, type = 'manual') {
  // 1. Persiste no banco
  const result = await db.query(
    `INSERT INTO notifications (employee_id, title, body, type)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [employeeId, title, body, type]
  );
  const notifId = result.rows[0].id;

  // 2. Busca subscriptions do funcionário
  const subs = await db.query(
    `SELECT id, endpoint, p256dh, auth, fcm_token
     FROM push_subscriptions WHERE employee_id = $1`,
    [employeeId]
  );

  if (subs.rows.length === 0) return;

  const payload = JSON.stringify({ title, body, type });
  let sent = 0;

  // 3. Web Push (browsers)
  const webSubs = subs.rows.filter((s) => s.endpoint);
  const webResults = await Promise.allSettled(
    webSubs.map((sub) =>
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
  );
  sent += webResults.filter((r) => r.status === 'fulfilled').length;

  // 4. FCM (Android app nativo)
  const fcmSubs = subs.rows.filter((s) => s.fcm_token);
  if (fcmSubs.length > 0 && admin.apps.length) {
    const fcmResults = await Promise.allSettled(
      fcmSubs.map((sub) =>
        admin.messaging().send({
          token: sub.fcm_token,
          notification: { title, body },
          data: { type },
          android: { priority: 'high' },
        }).catch(async (err) => {
          // Token inválido ou desregistrado — remove
          const code = err?.errorInfo?.code || '';
          if (code === 'messaging/registration-token-not-registered' ||
              code === 'messaging/invalid-registration-token') {
            await db.query(
              'UPDATE push_subscriptions SET fcm_token = NULL WHERE id = $1',
              [sub.id]
            );
          }
          throw err;
        })
      )
    );
    sent += fcmResults.filter((r) => r.status === 'fulfilled').length;
  }

  if (sent > 0) {
    await db.query('UPDATE notifications SET push_sent = TRUE WHERE id = $1', [notifId]);
  }

  logger.info('Notificação enviada', { employeeId, type, sent, total: subs.rows.length });
}

async function checkLateServices() {
  try {
    const result = await db.query(
      `SELECT so.id, so.title, so.assigned_employee_id
       FROM service_orders so
       WHERE so.status IN ('pending','in_progress')
         AND so.late_notified = FALSE
         AND (
           so.scheduled_date < CURRENT_DATE
           OR (so.scheduled_date = CURRENT_DATE AND so.due_time IS NOT NULL AND so.due_time < CURRENT_TIME)
         )`
    );

    for (const row of result.rows) {
      await notify(
        row.assigned_employee_id,
        'Serviço atrasado',
        `O serviço "${row.title}" está atrasado e ainda não foi concluído.`,
        'service_late'
      );
      await db.query('UPDATE service_orders SET late_notified = TRUE WHERE id = $1', [row.id]);
    }
  } catch (err) {
    logger.error('Erro no cron de serviços atrasados', { error: err.message });
  }
}

function startCron() {
  setInterval(checkLateServices, 60 * 60 * 1000);
  checkLateServices();
}

module.exports = { notify, startCron };
```

- [ ] **Step 4: Commit**

```bash
git add backend/services/push.service.js backend/package.json backend/package-lock.json
git commit -m "feat: add FCM support to push service via firebase-admin"
```

---

## Task 3: Backend — endpoints subscribe-fcm e unsubscribe-fcm

**Files:**
- Modify: `backend/controllers/notification.controller.js`
- Modify: `backend/routes/notification.routes.js`

- [ ] **Step 1: Adicionar subscribeFcm e unsubscribeFcm no controller**

Adicionar ao final de `backend/controllers/notification.controller.js`, antes do `module.exports`:

```js
// ----------------------------------------------------------------
// POST /api/notifications/subscribe-fcm
// Registra ou atualiza token FCM do funcionário (app nativo)
// ----------------------------------------------------------------
async function subscribeFcm(req, res, next) {
  try {
    const { fcm_token } = req.body;
    if (!fcm_token) return res.status(400).json({ error: 'fcm_token obrigatório.' });

    await db.query(
      `INSERT INTO push_subscriptions (employee_id, fcm_token, endpoint, p256dh, auth)
       VALUES ($1, $2, '', '', '')
       ON CONFLICT (employee_id) WHERE endpoint = ''
         DO UPDATE SET fcm_token = $2
       -- fallback: upsert genérico se constraint não existir
      `,
      [req.user.id, fcm_token]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// DELETE /api/notifications/subscribe-fcm
// Remove token FCM do funcionário
// ----------------------------------------------------------------
async function unsubscribeFcm(req, res, next) {
  try {
    await db.query(
      `UPDATE push_subscriptions SET fcm_token = NULL
       WHERE employee_id = $1 AND fcm_token IS NOT NULL`,
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
```

Atualizar o `module.exports` no final do arquivo:

```js
module.exports = { list, markRead, markAllRead, send, subscribe, unsubscribe, subscribeFcm, unsubscribeFcm };
```

- [ ] **Step 2: Registrar rotas em notification.routes.js**

Adicionar antes de `module.exports = router;`:

```js
// FCM token (app nativo Android)
router.post('/subscribe-fcm', auth, controller.subscribeFcm);
router.delete('/subscribe-fcm', auth, controller.unsubscribeFcm);
```

- [ ] **Step 3: Testar endpoints manualmente**

```bash
# Substitua TOKEN pelo access token de um funcionário
curl -s -X POST https://pontotools.shop/api/notifications/subscribe-fcm \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fcm_token":"test_token_123"}' | jq .
# Esperado: {"ok":true}

curl -s -X DELETE https://pontotools.shop/api/notifications/subscribe-fcm \
  -H "Authorization: Bearer TOKEN" | jq .
# Esperado: {"ok":true}
```

- [ ] **Step 4: Commit**

```bash
git add backend/controllers/notification.controller.js backend/routes/notification.routes.js
git commit -m "feat: add FCM subscribe/unsubscribe endpoints"
```

---

## Task 4: Mobile — instalar @react-native-firebase

**Files:**
- Modify: `mobile/package.json` (via npm install)
- Modify: `mobile/android/app/build.gradle`
- Modify: `mobile/android/build.gradle`
- Create: `mobile/android/app/google-services.json`

- [ ] **Step 1: Baixar google-services.json do Firebase**

No console Firebase:
1. Project Settings → Android app → adicione o app com package name `com.pontomobile` (verificar em `mobile/android/app/build.gradle` → `applicationId`)
2. Baixe `google-services.json` e coloque em `mobile/android/app/google-services.json`

- [ ] **Step 2: Instalar dependências Firebase**

```bash
cd mobile && npm install @react-native-firebase/app @react-native-firebase/messaging
```

- [ ] **Step 3: Configurar android/build.gradle (nível projeto)**

Abrir `mobile/android/build.gradle`. Adicionar no bloco `dependencies` do `buildscript`:

```groovy
classpath 'com.google.gms:google-services:4.4.2'
```

O bloco ficará assim:
```groovy
buildscript {
    // ...
    dependencies {
        classpath("com.android.tools.build:gradle:8.3.2")
        classpath 'com.google.gms:google-services:4.4.2'
    }
}
```

- [ ] **Step 4: Configurar android/app/build.gradle (nível app)**

Abrir `mobile/android/app/build.gradle`.

No topo do arquivo (após `apply plugin: "com.android.application"`), adicionar:
```groovy
apply plugin: 'com.google.gms.google-services'
```

No bloco `dependencies`, adicionar:
```groovy
implementation platform('com.google.firebase:firebase-bom:33.7.0')
implementation 'com.google.firebase:firebase-messaging'
```

- [ ] **Step 5: Verificar que o build compila**

```bash
cd mobile && npx react-native run-android 2>&1 | tail -20
```

Esperado: app abre no dispositivo/emulador sem erro de build.

- [ ] **Step 6: Commit**

```bash
git add mobile/package.json mobile/package-lock.json \
        mobile/android/build.gradle mobile/android/app/build.gradle \
        mobile/android/app/google-services.json
git commit -m "feat: add @react-native-firebase/messaging to mobile"
```

---

## Task 5: Mobile — componente TabBar

**Files:**
- Create: `mobile/src/components/TabBar.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// mobile/src/components/TabBar.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type Screen = 'dashboard' | 'history' | 'services' | 'notifications';

interface TabBarProps {
  active: Screen;
  onNavigate: (screen: Screen) => void;
  unreadCount?: number;
}

const TABS: { screen: Screen; label: string; icon: string }[] = [
  { screen: 'dashboard',     label: 'Ponto',     icon: '🕐' },
  { screen: 'history',       label: 'Histórico', icon: '📋' },
  { screen: 'services',      label: 'Serviços',  icon: '🔧' },
  { screen: 'notifications', label: 'Avisos',    icon: '🔔' },
];

export default function TabBar({ active, onNavigate, unreadCount = 0 }: TabBarProps) {
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
  tabBar:    { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingBottom: 4 },
  tab:       { flex: 1, alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  iconWrap:  { position: 'relative' },
  icon:      { fontSize: 20, color: '#94a3b8' },
  iconActive:{ color: '#1d4ed8' },
  label:     { fontSize: 10, color: '#94a3b8', marginTop: 2, fontWeight: '500' },
  labelActive:{ color: '#1d4ed8', fontWeight: '700' },
  badge: {
    position: 'absolute', top: -4, right: -8,
    backgroundColor: '#dc2626', borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/components/TabBar.tsx
git commit -m "feat: add reusable TabBar component with badge support"
```

---

## Task 6: Mobile — atualizar DashboardScreen e HistoryScreen

**Files:**
- Modify: `mobile/src/screens/DashboardScreen.tsx`
- Modify: `mobile/src/screens/HistoryScreen.tsx`

- [ ] **Step 1: Atualizar DashboardScreen — substituir tab bar inline**

No topo do arquivo, adicionar import:
```tsx
import TabBar from '../components/TabBar';
```

Alterar a prop `onNavigate`:
```tsx
// antes:
export default function DashboardScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
// depois:
type Screen = 'dashboard' | 'history' | 'services' | 'notifications';
export default function DashboardScreen({
  onNavigate,
  unreadCount = 0,
}: {
  onNavigate: (s: Screen) => void;
  unreadCount?: number;
}) {
```

Remover o bloco `{/* Tab bar */}` e o `<View style={styles.tabBar}>` com os dois `<TouchableOpacity>` dentro dele (linhas 195–202 aproximadamente).

Substituir por `<TabBar active="dashboard" onNavigate={onNavigate} unreadCount={unreadCount} />` logo após `<SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>`:

```tsx
return (
  <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
    <TabBar active="dashboard" onNavigate={onNavigate} unreadCount={unreadCount} />
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {/* ... resto do conteúdo ... */}
    </ScrollView>
    {/* Modal permanece igual */}
  </SafeAreaView>
);
```

Remover as entradas do `styles` que não são mais usadas: `tabBar`, `tab`, `tabActive`, `tabText`, `tabTextActive`.

- [ ] **Step 2: Atualizar HistoryScreen — substituir tab bar inline**

No topo do arquivo, adicionar import:
```tsx
import TabBar from '../components/TabBar';
```

Alterar tipos e props:
```tsx
type Screen = 'dashboard' | 'history' | 'services' | 'notifications';

export default function HistoryScreen({
  onNavigate,
  unreadCount = 0,
}: {
  onNavigate: (s: Screen) => void;
  unreadCount?: number;
}) {
```

Substituir o bloco da tab bar (os dois `<TouchableOpacity>` dentro de `<View style={styles.tabBar}>`) pela `<TabBar>`, colocada **fora** do `<FlatList>` mas dentro do `<SafeAreaView>`:

```tsx
return (
  <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
    <TabBar active="history" onNavigate={onNavigate} unreadCount={unreadCount} />
    <FlatList
      {/* ... props iguais ... */}
    />
  </SafeAreaView>
);
```

Remover `tabBar`, `tab`, `tabActive`, `tabText`, `tabTextActive` do `styles`.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/screens/DashboardScreen.tsx mobile/src/screens/HistoryScreen.tsx
git commit -m "refactor: replace inline tab bar with TabBar component in Dashboard and History"
```

---

## Task 7: Mobile — ServicesScreen

**Files:**
- Create: `mobile/src/screens/ServicesScreen.tsx`

- [ ] **Step 1: Criar ServicesScreen**

```tsx
// mobile/src/screens/ServicesScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Modal, ScrollView, Alert, ActivityIndicator,
  RefreshControl, TextInput, Image,
} from 'react-native';
import { launchCamera, type CameraOptions } from 'react-native-image-picker';
import api from '../services/api';
import TabBar from '../components/TabBar';

type Screen = 'dashboard' | 'history' | 'services' | 'notifications';

interface ServiceOrder {
  id: number;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'done' | 'problem';
  scheduled_date: string;
  due_time: string | null;
  unit_name: string;
  problem_description: string | null;
}

interface ServicePhoto {
  id: number;
  phase: 'before' | 'after';
}

const STATUS_LABEL: Record<string, string> = {
  pending:    'Pendente',
  in_progress:'Em andamento',
  done:       'Concluído',
  problem:    'Problema',
};

const STATUS_COLOR: Record<string, string> = {
  pending:    '#64748b',
  in_progress:'#d97706',
  done:       '#16a34a',
  problem:    '#dc2626',
};

const STATUS_BG: Record<string, string> = {
  pending:    '#f1f5f9',
  in_progress:'#fffbeb',
  done:       '#f0fdf4',
  problem:    '#fef2f2',
};

function fmtDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export default function ServicesScreen({
  onNavigate,
  unreadCount = 0,
}: {
  onNavigate: (s: Screen) => void;
  unreadCount?: number;
}) {
  const [services, setServices]       = useState<ServiceOrder[]>([]);
  const [loading, setLoading]         = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [selected, setSelected]       = useState<ServiceOrder | null>(null);
  const [photos, setPhotos]           = useState<ServicePhoto[]>([]);
  const [newPhotoUris, setNewPhotoUris] = useState<string[]>([]);
  const [problemText, setProblemText] = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [showProblemInput, setShowProblemInput] = useState(false);

  const loadServices = useCallback(async (reset = false) => {
    if (!reset) setLoading(true);
    try {
      const { data } = await api.get('/services');
      setServices(data.services);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  React.useEffect(() => { loadServices(false); }, []);

  const openDetail = useCallback(async (service: ServiceOrder) => {
    setSelected(service);
    setNewPhotoUris([]);
    setProblemText('');
    setShowProblemInput(false);
    try {
      const { data } = await api.get(`/services/${service.id}`);
      setPhotos(data.photos || []);
    } catch { setPhotos([]); }
  }, []);

  const takePhoto = useCallback(async () => {
    const options: CameraOptions = {
      mediaType: 'photo',
      cameraType: 'back',
      quality: 0.7,
      maxWidth: 1024,
      maxHeight: 1024,
      saveToPhotos: false,
    };
    const result = await launchCamera(options);
    if (result.didCancel || result.errorCode) return;
    const uri = result.assets?.[0]?.uri;
    if (uri) setNewPhotoUris((prev) => [...prev, uri]);
  }, []);

  const handleUpdateStatus = useCallback(async (
    serviceId: number,
    status: 'in_progress' | 'done' | 'problem',
    problemDescription?: string
  ) => {
    setSubmitting(true);
    try {
      // 1. Atualiza status
      await api.patch(`/services/${serviceId}/status`, { status, problem_description: problemDescription });

      // 2. Envia fotos novas (fase 'after' para done/problem, 'before' para in_progress)
      const phase = status === 'in_progress' ? 'before' : 'after';
      for (const uri of newPhotoUris) {
        const form = new FormData();
        form.append('photo', { uri, type: 'image/jpeg', name: 'photo.jpg' } as any);
        form.append('phase', phase);
        await api.post(`/services/${serviceId}/photos`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      setSelected(null);
      loadServices(false);
      Alert.alert('Atualizado!', `Status alterado para "${STATUS_LABEL[status]}".`);
    } catch (err: any) {
      Alert.alert('Erro', err?.response?.data?.error || 'Não foi possível atualizar.');
    } finally {
      setSubmitting(false);
    }
  }, [newPhotoUris, loadServices]);

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <TabBar active="services" onNavigate={onNavigate} unreadCount={unreadCount} />

      <FlatList
        data={services}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadServices(true); }}
            colors={['#1d4ed8']}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openDetail(item)}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <View style={[styles.badge, { backgroundColor: STATUS_BG[item.status] }]}>
                <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] }]}>
                  {STATUS_LABEL[item.status]}
                </Text>
              </View>
            </View>
            {item.description ? (
              <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
            ) : null}
            <Text style={styles.cardMeta}>{item.unit_name} · {fmtDate(item.scheduled_date)}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? null : (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ color: '#94a3b8', fontSize: 15 }}>Nenhum serviço atribuído.</Text>
            </View>
          )
        }
        ListFooterComponent={loading ? <ActivityIndicator style={{ margin: 16 }} color="#1d4ed8" /> : null}
      />

      {/* Modal de detalhe */}
      <Modal visible={selected !== null} transparent animationType="slide">
        <View style={modal.overlay}>
          <View style={modal.box}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selected && (
                <>
                  <View style={modal.header}>
                    <Text style={modal.title}>{selected.title}</Text>
                    <TouchableOpacity onPress={() => setSelected(null)}>
                      <Text style={{ fontSize: 20, color: '#64748b' }}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[modal.statusBadge, { backgroundColor: STATUS_BG[selected.status] }]}>
                    <Text style={[modal.statusText, { color: STATUS_COLOR[selected.status] }]}>
                      {STATUS_LABEL[selected.status]}
                    </Text>
                  </View>

                  {selected.description ? (
                    <Text style={modal.desc}>{selected.description}</Text>
                  ) : null}

                  <Text style={modal.meta}>
                    {selected.unit_name} · {fmtDate(selected.scheduled_date)}
                    {selected.due_time ? ` às ${selected.due_time.slice(0, 5)}` : ''}
                  </Text>

                  {selected.problem_description ? (
                    <View style={modal.problemBox}>
                      <Text style={modal.problemLabel}>Problema relatado:</Text>
                      <Text style={modal.problemText}>{selected.problem_description}</Text>
                    </View>
                  ) : null}

                  {/* Fotos existentes */}
                  {photos.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      {photos.map((p) => (
                        <View key={p.id} style={{ marginRight: 8 }}>
                          <Image
                            source={{ uri: `${api.defaults.baseURL?.replace('/api','')}/api/services/${selected.id}/photos/${p.id}`,
                              headers: { Authorization: '' } }}
                            style={modal.thumb}
                          />
                          <Text style={modal.thumbLabel}>{p.phase === 'before' ? 'Antes' : 'Depois'}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  )}

                  {/* Fotos novas selecionadas */}
                  {newPhotoUris.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                      {newPhotoUris.map((uri, i) => (
                        <View key={i} style={{ marginRight: 8, position: 'relative' }}>
                          <Image source={{ uri }} style={modal.thumb} />
                          <TouchableOpacity
                            style={modal.removeBtn}
                            onPress={() => setNewPhotoUris((prev) => prev.filter((_, idx) => idx !== i))}
                          >
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  )}

                  {/* Botão adicionar foto (visível se ainda pode agir) */}
                  {(selected.status === 'pending' || selected.status === 'in_progress') && (
                    <TouchableOpacity style={modal.photoBtn} onPress={takePhoto}>
                      <Text style={modal.photoBtnText}>📸 Adicionar foto</Text>
                    </TouchableOpacity>
                  )}

                  {/* Ações */}
                  {selected.status === 'pending' && !submitting && (
                    <TouchableOpacity
                      style={[modal.actionBtn, { backgroundColor: '#d97706' }]}
                      onPress={() => handleUpdateStatus(selected.id, 'in_progress')}
                    >
                      <Text style={modal.actionBtnText}>Iniciar serviço</Text>
                    </TouchableOpacity>
                  )}

                  {selected.status === 'in_progress' && !showProblemInput && !submitting && (
                    <View style={{ gap: 10 }}>
                      <TouchableOpacity
                        style={[modal.actionBtn, { backgroundColor: '#16a34a' }]}
                        onPress={() => handleUpdateStatus(selected.id, 'done')}
                      >
                        <Text style={modal.actionBtnText}>Concluir serviço</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[modal.actionBtn, { backgroundColor: '#dc2626' }]}
                        onPress={() => setShowProblemInput(true)}
                      >
                        <Text style={modal.actionBtnText}>Reportar problema</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {showProblemInput && (
                    <View>
                      <TextInput
                        style={modal.problemInput}
                        placeholder="Descreva o problema..."
                        placeholderTextColor="#94a3b8"
                        value={problemText}
                        onChangeText={setProblemText}
                        multiline
                        numberOfLines={3}
                        maxLength={500}
                      />
                      <TouchableOpacity
                        style={[modal.actionBtn, { backgroundColor: '#dc2626', marginTop: 10 }]}
                        onPress={() => handleUpdateStatus(selected.id, 'problem', problemText)}
                        disabled={!problemText.trim()}
                      >
                        <Text style={modal.actionBtnText}>Confirmar problema</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {submitting && <ActivityIndicator color="#1d4ed8" style={{ marginTop: 16 }} />}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card:       { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle:  { fontSize: 15, fontWeight: '700', color: '#0f172a', flex: 1, marginRight: 8 },
  cardDesc:   { fontSize: 13, color: '#64748b', marginBottom: 6 },
  cardMeta:   { fontSize: 12, color: '#94a3b8' },
  badge:      { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:  { fontSize: 11, fontWeight: '700' },
});

const modal = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  box:          { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, maxHeight: '90%' },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title:        { fontSize: 17, fontWeight: '800', color: '#0f172a', flex: 1, marginRight: 12 },
  statusBadge:  { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12 },
  statusText:   { fontSize: 12, fontWeight: '700' },
  desc:         { fontSize: 14, color: '#374151', marginBottom: 10, lineHeight: 20 },
  meta:         { fontSize: 12, color: '#94a3b8', marginBottom: 14 },
  problemBox:   { backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, marginBottom: 12 },
  problemLabel: { fontSize: 11, fontWeight: '700', color: '#dc2626', marginBottom: 4 },
  problemText:  { fontSize: 13, color: '#374151' },
  thumb:        { width: 80, height: 80, borderRadius: 8, resizeMode: 'cover' },
  thumbLabel:   { fontSize: 10, color: '#64748b', textAlign: 'center', marginTop: 2 },
  removeBtn:    { position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  photoBtn:     { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 12 },
  photoBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  actionBtn:    { borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 8 },
  actionBtnText:{ color: '#fff', fontWeight: '700', fontSize: 15 },
  problemInput: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, color: '#0f172a', minHeight: 80, textAlignVertical: 'top' },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/screens/ServicesScreen.tsx
git commit -m "feat: add ServicesScreen with status actions and photo upload"
```

---

## Task 8: Mobile — NotificationsScreen

**Files:**
- Create: `mobile/src/screens/NotificationsScreen.tsx`

- [ ] **Step 1: Criar NotificationsScreen**

```tsx
// mobile/src/screens/NotificationsScreen.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import api from '../services/api';
import TabBar from '../components/TabBar';

type Screen = 'dashboard' | 'history' | 'services' | 'notifications';

interface Notification {
  id: number;
  title: string;
  body: string;
  type: string;
  read: boolean;
  created_at: string;
}

function fmtRelative(isoDate: string): string {
  const diff = (Date.now() - new Date(isoDate).getTime()) / 1000;
  if (diff < 60)   return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  if (diff < 172800) return 'ontem';
  const d = new Date(isoDate);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

export default function NotificationsScreen({
  onNavigate,
  unreadCount = 0,
  onUnreadChange,
}: {
  onNavigate: (s: Screen) => void;
  unreadCount?: number;
  onUnreadChange?: (count: number) => void;
}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]             = useState(false);
  const [refreshing, setRefreshing]       = useState(false);

  const loadNotifications = useCallback(async (reset = false) => {
    if (!reset) setLoading(true);
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications);
      onUnreadChange?.(data.unread);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [onUnreadChange]);

  // Registrar FCM ao entrar na tela
  useEffect(() => {
    loadNotifications(false);
    registerFcm();

    // Ouve notificações com app em foreground
    const unsub = messaging().onMessage(async (remoteMessage) => {
      const title = remoteMessage.notification?.title || 'Aviso';
      const body  = remoteMessage.notification?.body  || '';
      Alert.alert(title, body);
      loadNotifications(false);
    });
    return unsub;
  }, []);

  async function registerFcm() {
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      if (!enabled) return;

      const token = await messaging().getToken();
      const stored = await AsyncStorage.getItem('fcmToken');
      if (token !== stored) {
        await api.post('/notifications/subscribe-fcm', { fcm_token: token });
        await AsyncStorage.setItem('fcmToken', token);
      }
    } catch (err) {
      // Silencia erros de permissão negada
    }
  }

  const markRead = useCallback(async (id: number) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      onUnreadChange?.(Math.max(0, unreadCount - 1));
    } catch {}
  }, [unreadCount, onUnreadChange]);

  const markAllRead = useCallback(async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      onUnreadChange?.(0);
    } catch {}
  }, [onUnreadChange]);

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <TabBar active="notifications" onNavigate={onNavigate} unreadCount={unreadCount} />

      {unreadCount > 0 && (
        <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
          <Text style={styles.markAllText}>Marcar todas como lidas ({unreadCount})</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadNotifications(true); }}
            colors={['#1d4ed8']}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, !item.read && styles.itemUnread]}
            onPress={() => !item.read && markRead(item.id)}
          >
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemBody} numberOfLines={2}>{item.body}</Text>
            </View>
            <View style={styles.itemMeta}>
              <Text style={styles.itemTime}>{fmtRelative(item.created_at)}</Text>
              {!item.read && <View style={styles.dot} />}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? null : (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ color: '#94a3b8', fontSize: 15 }}>Nenhum aviso recebido.</Text>
            </View>
          )
        }
        ListFooterComponent={loading ? <ActivityIndicator style={{ margin: 16 }} color="#1d4ed8" /> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  markAllBtn:   { backgroundColor: '#eff6ff', padding: 12, margin: 12, marginBottom: 0, borderRadius: 10, alignItems: 'center' },
  markAllText:  { color: '#1d4ed8', fontWeight: '700', fontSize: 13 },
  item:         { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  itemUnread:   { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  itemContent:  { flex: 1, marginRight: 8 },
  itemTitle:    { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 3 },
  itemBody:     { fontSize: 13, color: '#64748b', lineHeight: 18 },
  itemMeta:     { alignItems: 'flex-end', gap: 6 },
  itemTime:     { fontSize: 11, color: '#94a3b8' },
  dot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1d4ed8' },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/screens/NotificationsScreen.tsx
git commit -m "feat: add NotificationsScreen with FCM registration and read tracking"
```

---

## Task 9: Mobile — atualizar App.tsx

**Files:**
- Modify: `mobile/App.tsx`

- [ ] **Step 1: Substituir conteúdo de App.tsx**

```tsx
// mobile/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import LoginScreen             from './src/screens/LoginScreen';
import ForgotPasswordScreen    from './src/screens/ForgotPasswordScreen';
import DashboardScreen         from './src/screens/DashboardScreen';
import HistoryScreen           from './src/screens/HistoryScreen';
import ServicesScreen          from './src/screens/ServicesScreen';
import NotificationsScreen     from './src/screens/NotificationsScreen';
import api                     from './src/services/api';

type Screen     = 'dashboard' | 'history' | 'services' | 'notifications';
type AuthScreen = 'login' | 'forgot-password';

function AppContent() {
  const { user, loading }           = useAuth();
  const [screen, setScreen]         = useState<Screen>('dashboard');
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Polling de notificações não lidas a cada 30s
  useEffect(() => {
    if (!user) return;
    function fetchUnread() {
      api.get('/notifications')
        .then(({ data }) => setUnreadCount(data.unread ?? 0))
        .catch(() => {});
    }
    fetchUnread();
    intervalRef.current = setInterval(fetchUnread, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  if (!user) {
    if (authScreen === 'forgot-password') {
      return <ForgotPasswordScreen onBack={() => setAuthScreen('login')} />;
    }
    return <LoginScreen onForgotPassword={() => setAuthScreen('forgot-password')} />;
  }

  const sharedProps = { onNavigate: setScreen, unreadCount };

  return (
    <View style={{ flex: 1 }}>
      {screen === 'dashboard'     && <DashboardScreen     {...sharedProps} />}
      {screen === 'history'       && <HistoryScreen       {...sharedProps} />}
      {screen === 'services'      && <ServicesScreen      {...sharedProps} />}
      {screen === 'notifications' && (
        <NotificationsScreen
          {...sharedProps}
          onUnreadChange={setUnreadCount}
        />
      )}
    </View>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/App.tsx
git commit -m "feat: expand App.tsx to 4-screen navigation with unread polling"
```

---

## Task 10: Deploy e teste

- [ ] **Step 1: Rodar migration no banco**

```bash
# Na máquina local ou via SSH no AWS:
psql $DATABASE_URL -f database/10_fcm_token.sql
```

- [ ] **Step 2: Configurar variáveis de ambiente no backend AWS**

Adicionar ao `.env` em `~/pontotools/backend/.env`:
```
FIREBASE_PROJECT_ID=seu-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@seu-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

- [ ] **Step 3: Deploy backend no AWS**

```bash
# No servidor AWS:
cd ~/pontotools && git pull origin main
cd backend && npm install
pm2 restart backend
pm2 logs backend --lines 20
```

Saída esperada: sem erros de inicialização do firebase-admin.

- [ ] **Step 4: Push e build do APK**

```bash
# Local:
git push origin main
```

O CI (`.github/workflows/android-build.yml`) gera o APK automaticamente na branch main. Baixar o artefato do GitHub Actions para instalar no dispositivo.

- [ ] **Step 5: Teste manual no dispositivo**

1. Abra o app → tab Serviços deve listar ordens atribuídas
2. Toque em uma ordem → modal abre com detalhe e botões de ação
3. Inicie um serviço → status muda para "Em andamento"
4. Abra tab Avisos → solicita permissão de notificações
5. Aceite → app registra token FCM (verificar log no servidor)
6. Peça a um admin enviar notificação via painel web → aparece como push no Android
7. Badge na aba Avisos some após marcar como lida

---

## Self-Review contra o Spec

| Requisito do spec | Task |
|-------------------|------|
| Tab bar inferior com 4 abas + badge | Task 5 (TabBar) + Task 9 (App.tsx) |
| ServicesScreen — lista com FlatList + pull-to-refresh | Task 7 |
| ServicesScreen — modal detalhe com fotos | Task 7 |
| ServicesScreen — ações por status (iniciar/concluir/problema) | Task 7 |
| NotificationsScreen — lista + marcar lida / marcar todas | Task 8 |
| NotificationsScreen — push nativo FCM | Tasks 4, 8 |
| Backend — coluna fcm_token | Task 1 |
| Backend — subscribe-fcm / unsubscribe-fcm | Task 3 |
| Backend — firebase-admin no push.service.js | Task 2 |
| DashboardScreen / HistoryScreen usando TabBar | Task 6 |
| unreadCount compartilhado via App.tsx polling | Task 9 |
