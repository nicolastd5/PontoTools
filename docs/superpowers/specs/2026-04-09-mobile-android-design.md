# Design — App Mobile Android (React Native)

**Data:** 2026-04-09
**Status:** Aprovado
**Tecnologia:** React Native
**Futuro:** iOS planejado, Kotlin como alternativa de longo prazo

---

## Contexto

O PontoTools já possui um backend Express + PostgreSQL na AWS e um frontend web React para o portal admin e para o funcionário. O app web do funcionário não consegue solicitar permissão de geolocalização via HTTP (sem HTTPS/domínio configurado), o que bloqueou o fluxo de batida de ponto no celular via browser.

A solução é um app Android nativo em React Native que se conecta ao mesmo backend, resolvendo o GPS nativamente.

---

## Objetivos

- Funcionário bate ponto pelo celular (GPS + foto), sem depender do browser
- Distribuição inicial via APK direto (fontes desconhecidas)
- Pequena alteração no backend: endpoint `/api/auth/refresh` precisa aceitar refresh token via body além do cookie (mobile não suporta cookies HttpOnly)
- Manutenção por uma única pessoa sem equipe mobile

---

## Arquitetura

```
PontoTools/
├── backend/          # Express — sem alterações
├── frontend/         # React web — sem alterações
├── mobile/           # React Native (novo)
│   ├── android/      # Configuração de build Android
│   ├── src/
│   │   ├── screens/
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── DashboardScreen.tsx
│   │   │   └── HistoryScreen.tsx
│   │   ├── services/
│   │   │   └── api.ts          # axios, mesmos endpoints do web
│   │   ├── hooks/
│   │   │   └── useGeolocation.ts
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx
│   │   └── navigation/
│   │       └── AppNavigator.tsx
│   ├── package.json
│   └── app.json
└── docs/
```

---

## Telas

### LoginScreen
- Campo email + senha
- Chama `POST /api/auth/login`
- Salva JWT em `AsyncStorage`
- Redireciona para tabs (Dashboard + Histórico)

### DashboardScreen
- Mostra data/hora atual
- Status do GPS em tempo real (`react-native-geolocation-service`)
- 4 botões: Entrada, Início Intervalo, Fim Intervalo, Saída
- Botões desabilitados se GPS negado ou fora da zona
- Ao clicar: abre câmera (`react-native-vision-camera`) → captura foto → envia `multipart/form-data` para `POST /api/clock`
- Mostra registros de hoje (GET /api/clock/today)

### HistoryScreen
- Lista paginada dos registros (GET /api/clock/history)
- Filtro por data
- Indicador de dentro/fora da zona por registro

---

## Autenticação

O middleware `auth.js` já aceita JWT via header `Authorization: Bearer <token>` — o app mobile usará isso para todas as requisições autenticadas, salvando o access token em `AsyncStorage`.

**Alteração necessária no backend** (`auth.controller.js` → função `refresh`):
O endpoint `POST /api/auth/refresh` atualmente lê o refresh token apenas do cookie HttpOnly. Para mobile, precisa aceitar também via body JSON:
```js
const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;
```
O web continua funcionando via cookie. O mobile envia o refresh token no body. Sem quebra de compatibilidade.

O app salva ambos os tokens em `AsyncStorage` após o login. Um interceptor do axios renova o access token automaticamente quando recebe 401.

---

## Dependências principais

| Pacote | Uso |
|--------|-----|
| `react-native-geolocation-service` | GPS nativo Android/iOS |
| `react-native-vision-camera` | Câmera ao vivo, sem galeria |
| `react-navigation` + `@react-navigation/bottom-tabs` | Navegação entre telas |
| `axios` | HTTP — mesmos padrões do frontend web |
| `@react-native-async-storage/async-storage` | Armazenamento do JWT |
| `date-fns` + `date-fns-tz` | Formatação de datas (mesma lib do web) |

---

## Distribuição Android

**Agora (APK direto):**
1. Build de release: `cd android && ./gradlew assembleRelease`
2. APK gerado em `android/app/build/outputs/apk/release/`
3. Distribuir via link (Google Drive, WhatsApp, e-mail)
4. Funcionário habilita "Instalar apps de fontes desconhecidas" nas configurações

**Futuro (Play Store):**
- Mesmo código, processo de build muda para `bundleRelease` (AAB)
- Criar conta Google Play Developer ($25 taxa única)
- Upload do AAB + screenshots + descrição

---

## Planejamento iOS

React Native suporta iOS com o mesmo código. O que muda na implementação futura:

- Precisa de Mac com Xcode instalado para compilar
- Conta Apple Developer ($99/ano) obrigatória para publicar
- Adicionar pasta `ios/` ao projeto RN
- Configurar permissões em `Info.plist` (GPS, câmera)
- Plugins escolhidos (`react-native-geolocation-service` e `react-native-vision-camera`) já têm suporte iOS nativo — zero reescrita de lógica

**Kotlin (alternativa de longo prazo):**
Manter em mente para quando precisar de: widgets na tela inicial, notificações ricas com ações, integrações profundas com o sistema Android, ou performance crítica. Nesse caso, o backend permanece igual — só o cliente muda.

---

## Permissões necessárias no Android

```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.INTERNET" />
```

---

## O que NÃO está no escopo desta versão

- Notificações push
- Modo offline / fila de registros
- Biometria / PIN
- Multi-idioma
- Tema escuro
- Publicação nas lojas (Play Store / App Store)
