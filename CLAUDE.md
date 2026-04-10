# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Ponto Eletrônico com GPS e Foto** — Electronic time-clock system. Employees punch in/out from their assigned geographic zone; the app captures GPS coordinates and a mandatory photo. Built as a 3-tier monorepo: Express API, React PWA, React Native Android app.

## Commands

### Backend (`cd backend`)
```bash
npm run dev          # nodemon server.js (development)
npm start            # node server.js (production)
npm run db:setup     # Run schema + seed against $DATABASE_URL
```

### Frontend (`cd frontend`)
```bash
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # Build to frontend/dist/ (served by Nginx in prod)
npm run preview      # Preview the production build locally
```

### Mobile (`cd mobile`)
```bash
npm start            # Metro bundler
npm run android      # Build and run on Android device/emulator
npm test             # Jest
npm run lint         # ESLint
```

### Database
Schema migrations must be run manually in order:
```bash
psql $DATABASE_URL -f database/01_schema.sql
psql $DATABASE_URL -f database/02_seed.sql
psql $DATABASE_URL -f database/03_contracts.sql
psql $DATABASE_URL -f database/04_gestor.sql
```

## Architecture

### Backend — `backend/`
Express.js + PostgreSQL (direct `pg`, no ORM).

**Request lifecycle:**  
`server.js` → `routes/*.routes.js` → `middleware/auth.js` (JWT verify, attaches `req.user`) → `middleware/roleGuard.js` (role check) → `middleware/validate.js` (express-validator) → `controllers/*.controller.js` → `config/database.js`

**Key middleware:**
- `auth.js` — verifies JWT Bearer token, sets `req.user = { id, role, unitId, contractId, email }`
- `roleGuard.js` — `requireAdmin`, `requireAdminOrGestor`, `requireEmployee`
- `rateLimiter.js` — separate limiters for login (5/15min) and clock (10/min)

**Roles and data scoping:**
- `admin` — full access to all records across all contracts/units
- `gestor` — scoped to their `contractId`; controllers enforce this with an extra `AND u.contract_id = $N` filter on every query touching employees or units
- `employee` — can only register and view their own clock records

**Clock record flow (`clock.controller.js`):**  
Receives `multipart/form-data` (lat/lon + photo). Validates GPS zone via `services/geoValidation.service.js` (Haversine distance vs `unit.radius_meters`). Blocked attempts are logged in `blocked_attempts` table. Accepted records insert into `clock_records` and save the photo via `config/storage.js`.

**Photo storage:**  
Controlled by `STORAGE_DRIVER=local|s3`. Local stores in `PHOTOS_BASE_PATH`. S3 uses `AWS_*` env vars.

**Auth tokens:**  
- Access token: short-lived JWT (default 15m), signed with `JWT_SECRET`
- Refresh token: `crypto.randomBytes(48)`, only the SHA-256 hash stored in `refresh_tokens` table; token is rotated on every `/auth/refresh` call (old hash revoked, new one inserted)
- Web clients receive refresh token only via HttpOnly cookie; mobile clients receive it in the JSON body (detected by absence of `Origin` header: `!req.headers.origin`)

### Frontend — `frontend/`
React 18 + Vite PWA. Uses React Query for server state, React Router v6.

- `src/services/api.js` — Axios instance with `baseURL: '/api'` (relative, proxied by Nginx in prod). Uses `withCredentials: true` for the HttpOnly refresh cookie. Has auto-refresh interceptor.
- Frontend is built to `frontend/dist/` and served as static files by Nginx in production (no Node process).

### Mobile — `mobile/`
React Native 0.74.5 (TypeScript). Android only in CI.

- `src/services/api.ts` — Axios instance pointing to `https://pontotools.shop`. Stores `accessToken` and `refreshToken` in AsyncStorage. Implements the same refresh-queue pattern as the web client.
- `src/contexts/AuthContext.tsx` — global auth state
- `android/app/src/main/res/xml/network_security_config.xml` — cleartext blocked by default; exceptions only for `10.0.2.2` and `localhost` (emulator dev)

## Production Infrastructure

- **Server:** AWS EC2 (Ubuntu), IP `56.124.74.200`
- **Domain:** `pontotools.shop` (DNS on Cloudflare, "DNS only" mode)
- **Nginx:** reverse proxy; serves `frontend/dist/` as static files, proxies `/api/` to `127.0.0.1:3001`, proxies `status.pontotools.shop` to `127.0.0.1:8080`
- **TLS:** Let's Encrypt via Certbot
- **Process manager:** PM2 (`pm2 restart backend` after deploys)
- **Deploy:** SSH into EC2, `cd ~/pontotools && git pull origin main && pm2 restart backend`

## Environment Variables

See `.env.example` for the full list. Critical ones:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- `STORAGE_DRIVER` — `local` or `s3`
- `CORS_ORIGIN` — comma-separated allowed origins
- `NODE_ENV=production` — enables `secure` flag on cookies

## CI/CD

`.github/workflows/android-build.yml` — triggers on pushes to `main` that touch `mobile/`. Builds a debug APK and uploads it as a GitHub Actions artifact (7-day retention).
