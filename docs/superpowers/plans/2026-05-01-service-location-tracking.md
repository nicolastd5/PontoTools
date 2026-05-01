# Service Location Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build isolated service-based location tracking for webapp and mobile, visible on a new admin dashboard page.

**Architecture:** Add a separate backend module under `/api/service-tracking`, backed by a new `service_location_updates` table. Web and mobile get independent tracker hooks that send position updates only while the employee has a `pending` or `in_progress` service. The admin dashboard gets a separate `/admin/service-tracking` page that polls recent positions without touching existing GPS, photo, point, or service status flows.

**Tech Stack:** Node/Express/PostgreSQL/Jest backend, React/Vite/TanStack Query frontend, React Native mobile, Axios clients.

---

## File Structure

- Create `database/19_service_location_tracking.sql`: migration for location update storage and indexes.
- Create `backend/controllers/serviceTracking.controller.js`: validation, insert endpoint, live listing endpoint.
- Create `backend/routes/serviceTracking.routes.js`: isolated Express routes with auth and role guards.
- Create `backend/tests/serviceTracking.controller.test.js`: unit tests with mocked database calls.
- Modify `backend/server.js`: mount `/api/service-tracking`.
- Create `frontend/src/hooks/useServiceLocationTracker.js`: web-only tracker hook using `navigator.geolocation`.
- Modify `frontend/src/pages/employee/EmployeeServicesPage.jsx`: mount tracker with existing service list and show a small active indicator.
- Create `mobile/src/hooks/useServiceLocationTracker.ts`: mobile tracker hook using `GpsContext` coordinates.
- Modify `mobile/src/screens/ServicesScreen.tsx`: mount tracker with loaded service list and show a small active indicator.
- Create `frontend/src/pages/admin/AdminServiceTrackingPage.jsx`: admin/gestor live tracking page.
- Modify `frontend/src/App.jsx`: add admin route.
- Modify `frontend/src/components/shared/AdminLayout.jsx`: add navigation item.

---

### Task 1: Database Migration

**Files:**
- Create: `database/19_service_location_tracking.sql`

- [ ] **Step 1: Create the migration**

Add this file:

```sql
-- Migration 19: rastreamento isolado de localizacao por servico

CREATE TABLE IF NOT EXISTS service_location_updates (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  service_order_id INTEGER NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  accuracy_meters NUMERIC(8,2),
  source VARCHAR(20) NOT NULL CHECK (source IN ('web', 'mobile')),
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_location_service_created
  ON service_location_updates(service_order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_location_employee_created
  ON service_location_updates(employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_location_unit_created
  ON service_location_updates(unit_id, created_at DESC);
```

- [ ] **Step 2: Verify migration syntax**

Run:

```powershell
Get-Content database\19_service_location_tracking.sql
```

Expected: the file prints with one table and three indexes.

- [ ] **Step 3: Commit**

```powershell
git add database\19_service_location_tracking.sql
git commit -m "feat(tracking): add service location migration"
```

---

### Task 2: Backend Controller With Tests

**Files:**
- Create: `backend/tests/serviceTracking.controller.test.js`
- Create: `backend/controllers/serviceTracking.controller.js`

- [ ] **Step 1: Write failing controller tests**

Create `backend/tests/serviceTracking.controller.test.js`:

```js
jest.mock('../config/database', () => ({ query: jest.fn() }));

const db = require('../config/database');
const controller = require('../controllers/serviceTracking.controller');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function mockNext() {
  return jest.fn((err) => { throw err; });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('serviceTracking.postLocation', () => {
  test('recusa envio de admin ou gestor', async () => {
    const req = {
      user: { id: 1, role: 'admin' },
      body: { service_order_id: 10, latitude: -23, longitude: -46, source: 'web' },
    };
    const res = mockRes();

    await controller.postLocation(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Apenas funcionarios podem enviar localizacao.' });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('recusa coordenadas invalidas', async () => {
    const req = {
      user: { id: 7, role: 'employee' },
      body: { service_order_id: 10, latitude: -123, longitude: -46, source: 'web' },
    };
    const res = mockRes();

    await controller.postLocation(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Coordenadas invalidas.' });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('recusa servico inexistente ou nao elegivel', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const req = {
      user: { id: 7, role: 'employee' },
      body: { service_order_id: 10, latitude: -23, longitude: -46, source: 'mobile' },
    };
    const res = mockRes();

    await controller.postLocation(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Servico nao elegivel para rastreamento.' });
  });

  test('insere localizacao para servico pending ou in_progress do funcionario', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 10, unit_id: 3, status: 'in_progress' }] })
      .mockResolvedValueOnce({
        rows: [{
          id: 99,
          employee_id: 7,
          service_order_id: 10,
          unit_id: 3,
          latitude: '-23.5505200',
          longitude: '-46.6333100',
          accuracy_meters: '12.40',
          source: 'web',
          recorded_at: '2026-05-01T15:00:00.000Z',
          created_at: '2026-05-01T15:00:01.000Z',
        }],
      });
    const req = {
      user: { id: 7, role: 'employee' },
      body: {
        service_order_id: 10,
        latitude: -23.55052,
        longitude: -46.63331,
        accuracy_meters: 12.4,
        source: 'web',
        recorded_at: '2026-05-01T15:00:00.000Z',
      },
    };
    const res = mockRes();

    await controller.postLocation(req, res, mockNext());

    expect(db.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("so.status IN ('pending', 'in_progress')"),
      [10, 7],
    );
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO service_location_updates'),
      [7, 10, 3, -23.55052, -46.63331, 12.4, 'web', '2026-05-01T15:00:00.000Z'],
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 99 }));
  });
});

describe('serviceTracking.listLive', () => {
  test('lista posicoes para admin', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ employee_id: 7, employee_name: 'Ana', signal_age_seconds: '25' }] });
    const req = { user: { id: 1, role: 'admin' }, query: {} };
    const res = mockRes();

    await controller.listLive(req, res, mockNext());

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WITH eligible_services AS'), []);
    expect(res.json).toHaveBeenCalledWith({ locations: [{ employee_id: 7, employee_name: 'Ana', signal_age_seconds: 25 }] });
  });

  test('filtra gestor por contrato', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const req = { user: { id: 2, role: 'gestor', contractId: 5 }, query: { unitId: '3' } };
    const res = mockRes();

    await controller.listLive(req, res, mockNext());

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('u.contract_id = $1'), [5, 3]);
    expect(res.json).toHaveBeenCalledWith({ locations: [] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
cd backend
npm test -- serviceTracking.controller.test.js
```

Expected: FAIL because `backend/controllers/serviceTracking.controller.js` does not exist.

- [ ] **Step 3: Implement controller**

Create `backend/controllers/serviceTracking.controller.js`:

```js
const db = require('../config/database');

function parseFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validLatitude(value) {
  return value !== null && value >= -90 && value <= 90;
}

function validLongitude(value) {
  return value !== null && value >= -180 && value <= 180;
}

function normalizeSource(source) {
  return source === 'mobile' ? 'mobile' : 'web';
}

function normalizeRecordedAt(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function postLocation(req, res, next) {
  try {
    if (req.user?.role !== 'employee') {
      return res.status(403).json({ error: 'Apenas funcionarios podem enviar localizacao.' });
    }

    const serviceOrderId = parseInt(req.body.service_order_id, 10);
    const latitude = parseFiniteNumber(req.body.latitude);
    const longitude = parseFiniteNumber(req.body.longitude);
    const accuracy = req.body.accuracy_meters == null || req.body.accuracy_meters === ''
      ? null
      : parseFiniteNumber(req.body.accuracy_meters);
    const source = normalizeSource(req.body.source);
    const recordedAt = normalizeRecordedAt(req.body.recorded_at);

    if (!Number.isInteger(serviceOrderId) || serviceOrderId < 1) {
      return res.status(400).json({ error: 'Servico invalido.' });
    }
    if (!validLatitude(latitude) || !validLongitude(longitude)) {
      return res.status(400).json({ error: 'Coordenadas invalidas.' });
    }
    if (accuracy !== null && (accuracy < 0 || accuracy > 10000)) {
      return res.status(400).json({ error: 'Precisao invalida.' });
    }

    const service = await db.query(
      `SELECT so.id, so.unit_id, so.status
       FROM service_orders so
       WHERE so.id = $1
         AND so.assigned_employee_id = $2
         AND so.status IN ('pending', 'in_progress')`,
      [serviceOrderId, req.user.id],
    );

    if (!service.rows[0]) {
      return res.status(403).json({ error: 'Servico nao elegivel para rastreamento.' });
    }

    const inserted = await db.query(
      `INSERT INTO service_location_updates
         (employee_id, service_order_id, unit_id, latitude, longitude, accuracy_meters, source, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, NOW()))
       RETURNING id, employee_id, service_order_id, unit_id, latitude, longitude,
                 accuracy_meters, source, recorded_at, created_at`,
      [req.user.id, serviceOrderId, service.rows[0].unit_id, latitude, longitude, accuracy, source, recordedAt],
    );

    return res.status(201).json(inserted.rows[0]);
  } catch (err) {
    return next(err);
  }
}

async function listLive(req, res, next) {
  try {
    const params = [];
    const filters = ["so.status IN ('pending', 'in_progress')"];

    if (req.user.role === 'gestor') {
      params.push(req.user.contractId);
      filters.push(`u.contract_id = $${params.length}`);
    }

    if (req.query.unitId) {
      const unitId = parseInt(req.query.unitId, 10);
      if (Number.isInteger(unitId) && unitId > 0) {
        params.push(unitId);
        filters.push(`so.unit_id = $${params.length}`);
      }
    }

    if (['pending', 'in_progress'].includes(req.query.status)) {
      params.push(req.query.status);
      filters.push(`so.status = $${params.length}`);
    }

    const result = await db.query(
      `WITH eligible_services AS (
         SELECT
           so.id AS service_order_id,
           so.title AS service_title,
           so.status AS service_status,
           so.assigned_employee_id AS employee_id,
           so.unit_id,
           e.full_name AS employee_name,
           u.name AS unit_name
         FROM service_orders so
         JOIN employees e ON e.id = so.assigned_employee_id
         JOIN units u ON u.id = so.unit_id
         WHERE ${filters.join(' AND ')}
       ),
       latest_locations AS (
         SELECT DISTINCT ON (slu.service_order_id)
           slu.service_order_id,
           slu.latitude,
           slu.longitude,
           slu.accuracy_meters,
           slu.source,
           slu.recorded_at,
           slu.created_at
         FROM service_location_updates slu
         ORDER BY slu.service_order_id, slu.created_at DESC
       )
       SELECT
         es.employee_id,
         es.employee_name,
         es.service_order_id,
         es.service_title,
         es.service_status,
         es.unit_id,
         es.unit_name,
         ll.latitude,
         ll.longitude,
         ll.accuracy_meters,
         ll.source,
         ll.recorded_at,
         ll.created_at AS last_seen_at,
         CASE
           WHEN ll.created_at IS NULL THEN NULL
           ELSE EXTRACT(EPOCH FROM (NOW() - ll.created_at))::int
         END AS signal_age_seconds
       FROM eligible_services es
       LEFT JOIN latest_locations ll ON ll.service_order_id = es.service_order_id
       ORDER BY ll.created_at DESC NULLS LAST, es.service_title ASC`,
      params,
    );

    const locations = result.rows.map((row) => ({
      ...row,
      signal_age_seconds: row.signal_age_seconds == null ? null : Number(row.signal_age_seconds),
    }));

    return res.json({ locations });
  } catch (err) {
    return next(err);
  }
}

module.exports = { postLocation, listLive };
```

- [ ] **Step 4: Run controller tests**

Run:

```powershell
cd backend
npm test -- serviceTracking.controller.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend\controllers\serviceTracking.controller.js backend\tests\serviceTracking.controller.test.js
git commit -m "feat(tracking): add service tracking controller"
```

---

### Task 3: Backend Routes and Server Mount

**Files:**
- Create: `backend/routes/serviceTracking.routes.js`
- Modify: `backend/server.js`

- [ ] **Step 1: Create route file**

Create `backend/routes/serviceTracking.routes.js`:

```js
const express = require('express');
const { body } = require('express-validator');

const controller = require('../controllers/serviceTracking.controller');
const auth = require('../middleware/auth');
const { requireAdminOrGestor } = require('../middleware/roleGuard');
const validate = require('../middleware/validate');

const router = express.Router();

router.post(
  '/location',
  auth,
  body('service_order_id').isInt({ min: 1 }).withMessage('Servico invalido.'),
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude invalida.'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude invalida.'),
  body('accuracy_meters').optional({ values: 'falsy' }).isFloat({ min: 0, max: 10000 }).withMessage('Precisao invalida.'),
  body('source').optional({ values: 'falsy' }).isIn(['web', 'mobile']).withMessage('Origem invalida.'),
  body('recorded_at').optional({ values: 'falsy' }).isISO8601().withMessage('Data invalida.'),
  validate,
  controller.postLocation,
);

router.get('/live', auth, requireAdminOrGestor, controller.listLive);

module.exports = router;
```

- [ ] **Step 2: Mount route in server**

Modify `backend/server.js`.

Add this import near the other route imports:

```js
const serviceTrackingRoutes = require('./routes/serviceTracking.routes');
```

Add this mount near the services routes:

```js
app.use('/api/service-tracking', serviceTrackingRoutes);
```

- [ ] **Step 3: Run backend tests**

Run:

```powershell
cd backend
npm test
```

Expected: PASS for all backend tests.

- [ ] **Step 4: Commit**

```powershell
git add backend\routes\serviceTracking.routes.js backend\server.js
git commit -m "feat(tracking): expose service tracking routes"
```

---

### Task 4: Web Employee Tracker Hook

**Files:**
- Create: `frontend/src/hooks/useServiceLocationTracker.js`
- Modify: `frontend/src/pages/employee/EmployeeServicesPage.jsx`

- [ ] **Step 1: Add isolated web tracker hook**

Create `frontend/src/hooks/useServiceLocationTracker.js`:

```js
import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';

const ACTIVE_STATUSES = new Set(['pending', 'in_progress']);
const SEND_INTERVAL_MS = 30 * 1000;

function pickTrackedService(services) {
  const eligible = (services || []).filter((service) => ACTIVE_STATUSES.has(service.status));
  return eligible.find((service) => service.status === 'in_progress') || eligible[0] || null;
}

export function useServiceLocationTracker(services) {
  const trackedService = useMemo(() => pickTrackedService(services), [services]);
  const [state, setState] = useState({ active: false, lastSentAt: null, error: null });
  const serviceRef = useRef(trackedService);
  const sendingRef = useRef(false);

  useEffect(() => {
    serviceRef.current = trackedService;
  }, [trackedService]);

  useEffect(() => {
    if (!trackedService || !navigator.geolocation) {
      setState((prev) => ({ ...prev, active: false }));
      return undefined;
    }

    let cancelled = false;
    let intervalId = null;

    async function sendPosition(position) {
      const service = serviceRef.current;
      if (!service || sendingRef.current || cancelled) return;

      sendingRef.current = true;
      try {
        await api.post('/service-tracking/location', {
          service_order_id: service.id,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_meters: position.coords.accuracy ?? null,
          source: 'web',
          recorded_at: new Date(position.timestamp || Date.now()).toISOString(),
        });
        if (!cancelled) {
          setState({ active: true, lastSentAt: new Date().toISOString(), error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({ ...prev, active: true, error: err.response?.data?.error || 'tracking_failed' }));
        }
      } finally {
        sendingRef.current = false;
      }
    }

    function requestAndSend() {
      navigator.geolocation.getCurrentPosition(
        sendPosition,
        () => {
          if (!cancelled) setState((prev) => ({ ...prev, active: true, error: 'gps_unavailable' }));
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
      );
    }

    setState((prev) => ({ ...prev, active: true }));
    requestAndSend();
    intervalId = window.setInterval(requestAndSend, SEND_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [trackedService?.id]);

  return {
    ...state,
    service: trackedService,
  };
}
```

- [ ] **Step 2: Integrate hook in employee services page**

Modify `frontend/src/pages/employee/EmployeeServicesPage.jsx`.

Add this import:

```js
import { useServiceLocationTracker } from '../../hooks/useServiceLocationTracker';
```

After the `useMyServices()` call, add:

```js
  const tracking = useServiceLocationTracker(services);
```

Below the existing GPS panel, add this JSX:

```jsx
      {tracking.active && tracking.service && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 10, marginBottom: 16,
          border: `1px solid ${theme.accent}40`,
          background: `${theme.accent}14`,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: theme.accent, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: theme.textSecondary }}>
            Localizacao compartilhada enquanto houver servico ativo ou pendente.
          </span>
        </div>
      )}
```

- [ ] **Step 3: Build frontend**

Run:

```powershell
cd frontend
npm run build
```

Expected: Vite build completes successfully.

- [ ] **Step 4: Commit**

```powershell
git add frontend\src\hooks\useServiceLocationTracker.js frontend\src\pages\employee\EmployeeServicesPage.jsx
git commit -m "feat(tracking): add web service location tracker"
```

---

### Task 5: Mobile Tracker Hook

**Files:**
- Create: `mobile/src/hooks/useServiceLocationTracker.ts`
- Modify: `mobile/src/screens/ServicesScreen.tsx`

- [ ] **Step 1: Add isolated mobile tracker hook**

Create `mobile/src/hooks/useServiceLocationTracker.ts`:

```ts
import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import { useGpsContext } from '../contexts/GpsContext';

type ServiceStatus = 'pending' | 'in_progress' | 'done' | 'done_with_issues' | 'problem';

interface TrackableService {
  id: number;
  status: ServiceStatus;
}

const SEND_INTERVAL_MS = 30 * 1000;

function pickTrackedService(services: TrackableService[]): TrackableService | null {
  const eligible = services.filter((service) => service.status === 'pending' || service.status === 'in_progress');
  return eligible.find((service) => service.status === 'in_progress') || eligible[0] || null;
}

export function useServiceLocationTracker(services: TrackableService[]) {
  const { coords } = useGpsContext();
  const trackedService = useMemo(() => pickTrackedService(services || []), [services]);
  const serviceRef = useRef<TrackableService | null>(trackedService);
  const coordsRef = useRef(coords);
  const sendingRef = useRef(false);
  const [state, setState] = useState<{ active: boolean; lastSentAt: string | null; error: string | null }>({
    active: false,
    lastSentAt: null,
    error: null,
  });

  useEffect(() => {
    serviceRef.current = trackedService;
  }, [trackedService]);

  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);

  useEffect(() => {
    if (!trackedService) {
      setState((prev) => ({ ...prev, active: false }));
      return undefined;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function send() {
      const service = serviceRef.current;
      const currentCoords = coordsRef.current;
      if (!service || !currentCoords || sendingRef.current || cancelled) return;

      sendingRef.current = true;
      try {
        await api.post('/service-tracking/location', {
          service_order_id: service.id,
          latitude: currentCoords.latitude,
          longitude: currentCoords.longitude,
          accuracy_meters: currentCoords.accuracy ?? null,
          source: 'mobile',
          recorded_at: new Date().toISOString(),
        });
        if (!cancelled) {
          setState({ active: true, lastSentAt: new Date().toISOString(), error: null });
        }
      } catch (err: any) {
        if (!cancelled) {
          setState((prev) => ({ ...prev, active: true, error: err?.response?.data?.error || 'tracking_failed' }));
        }
      } finally {
        sendingRef.current = false;
      }
    }

    setState((prev) => ({ ...prev, active: true }));
    send();
    intervalId = setInterval(send, SEND_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [trackedService?.id]);

  return { ...state, service: trackedService };
}
```

- [ ] **Step 2: Integrate hook in ServicesScreen**

Modify `mobile/src/screens/ServicesScreen.tsx`.

Add import:

```ts
import { useServiceLocationTracker } from '../hooks/useServiceLocationTracker';
```

After `const address = useReverseGeocode(coords);`, add:

```ts
  const tracking = useServiceLocationTracker(services);
```

Below the existing GPS panel, add:

```tsx
      {tracking.active && tracking.service ? (
        <View style={{ marginHorizontal: 16, marginBottom: 4, borderRadius: 12, padding: 10, borderWidth: 1, backgroundColor: theme.accent + '14', borderColor: theme.accent + '40', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent }} />
          <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary, flex: 1 }}>
            Localizacao compartilhada enquanto houver servico ativo ou pendente.
          </Text>
        </View>
      ) : null}
```

- [ ] **Step 3: Run mobile type check**

Run:

```powershell
cd mobile
npx tsc --noEmit
```

Expected: TypeScript completes without errors.

- [ ] **Step 4: Commit**

```powershell
git add mobile\src\hooks\useServiceLocationTracker.ts mobile\src\screens\ServicesScreen.tsx
git commit -m "feat(tracking): add mobile service location tracker"
```

---

### Task 6: Admin Tracking Page

**Files:**
- Create: `frontend/src/pages/admin/AdminServiceTrackingPage.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/shared/AdminLayout.jsx`

- [ ] **Step 1: Create admin page**

Create `frontend/src/pages/admin/AdminServiceTrackingPage.jsx`:

```jsx
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import Icon from '../../components/shared/Icon';

function useUnits() {
  return useQuery({
    queryKey: ['units'],
    queryFn: () => api.get('/units').then((r) => r.data.units),
  });
}

function useLiveTracking(unitId) {
  return useQuery({
    queryKey: ['service-tracking-live', unitId],
    queryFn: () => api.get('/service-tracking/live', { params: unitId ? { unitId } : {} }).then((r) => r.data.locations),
    refetchInterval: 30 * 1000,
  });
}

function signalStatus(location) {
  if (location.signal_age_seconds == null) return { key: 'offline', label: 'Sem sinal', color: 'var(--color-danger)' };
  if (location.signal_age_seconds <= 60) return { key: 'online', label: 'Online', color: 'var(--color-ok)' };
  if (location.signal_age_seconds <= 300) return { key: 'recent', label: 'Recente', color: 'var(--color-warn)' };
  return { key: 'offline', label: 'Sem sinal', color: 'var(--color-danger)' };
}

function formatAge(seconds) {
  if (seconds == null) return 'Sem envio';
  if (seconds < 60) return `${seconds}s atras`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min atras`;
  return `${Math.floor(minutes / 60)}h atras`;
}

function mapUrl(location) {
  return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
}

export default function AdminServiceTrackingPage() {
  const [selectedUnit, setSelectedUnit] = useState('');
  const unitId = selectedUnit ? parseInt(selectedUnit, 10) : null;
  const { data: units = [] } = useUnits();
  const { data: locations = [], isLoading } = useLiveTracking(unitId);

  const summary = useMemo(() => locations.reduce((acc, location) => {
    acc[signalStatus(location).key] += 1;
    return acc;
  }, { online: 0, recent: 0, offline: 0 }), [locations]);

  return (
    <div>
      <div style={st.header}>
        <div>
          <h1 style={st.title}>Rastreamento</h1>
          <p style={st.subtitle}>Localizacao recente de funcionarios com servico ativo ou pendente.</p>
        </div>
        <select value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)} style={st.select}>
          <option value="">Todas as unidades</option>
          {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
        </select>
      </div>

      <div style={st.summaryGrid}>
        <SummaryCard label="Online" value={summary.online} color="var(--color-ok)" />
        <SummaryCard label="Recente" value={summary.recent} color="var(--color-warn)" />
        <SummaryCard label="Sem sinal" value={summary.offline} color="var(--color-danger)" />
      </div>

      <div style={st.card}>
        <div style={st.cardHeader}>
          <span style={st.cardTitle}>Servicos rastreados</span>
          <span style={st.cardHint}>Atualiza a cada 30s</span>
        </div>

        {isLoading ? (
          <div style={st.empty}>Carregando...</div>
        ) : locations.length === 0 ? (
          <div style={st.empty}>Nenhum servico ativo ou pendente encontrado.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={st.table}>
              <thead>
                <tr>
                  <Th>Funcionario</Th>
                  <Th>Servico</Th>
                  <Th>Unidade</Th>
                  <Th>Status</Th>
                  <Th>Ultimo sinal</Th>
                  <Th>Precisao</Th>
                  <Th>Origem</Th>
                  <Th>Mapa</Th>
                </tr>
              </thead>
              <tbody>
                {locations.map((location) => {
                  const signal = signalStatus(location);
                  return (
                    <tr key={location.service_order_id} style={st.row}>
                      <Td strong>{location.employee_name}</Td>
                      <Td>{location.service_title}</Td>
                      <Td>{location.unit_name}</Td>
                      <Td>
                        <span style={{ ...st.badge, color: signal.color, background: `${signal.color}18` }}>
                          {signal.label}
                        </span>
                      </Td>
                      <Td>{formatAge(location.signal_age_seconds)}</Td>
                      <Td>{location.accuracy_meters ? `${Math.round(Number(location.accuracy_meters))}m` : '-'}</Td>
                      <Td>{location.source || '-'}</Td>
                      <Td>
                        {location.latitude && location.longitude ? (
                          <a href={mapUrl(location)} target="_blank" rel="noreferrer" style={st.mapLink}>
                            <Icon name="pin" size={14} /> Abrir
                          </a>
                        ) : '-'}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div style={st.summaryCard}>
      <span style={{ ...st.summaryDot, background: color }} />
      <span style={st.summaryLabel}>{label}</span>
      <strong style={st.summaryValue}>{value}</strong>
    </div>
  );
}

function Th({ children }) {
  return <th style={st.th}>{children}</th>;
}

function Td({ children, strong = false }) {
  return <td style={{ ...st.td, fontWeight: strong ? 700 : 500 }}>{children}</td>;
}

const st = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 18 },
  title: { fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, letterSpacing: '-0.03em' },
  subtitle: { fontSize: 13, color: 'var(--color-muted)' },
  select: { padding: '8px 11px', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-card)' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 },
  summaryCard: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '14px 16px' },
  summaryDot: { width: 8, height: 8, borderRadius: '50%' },
  summaryLabel: { fontSize: 12, color: 'var(--color-muted)', flex: 1 },
  summaryValue: { fontSize: 22, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' },
  card: { background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 12, overflow: 'hidden' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--color-hairline)' },
  cardTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  cardHint: { fontSize: 12, color: 'var(--color-subtle)' },
  empty: { padding: 32, textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 860 },
  th: { textAlign: 'left', padding: '11px 14px', fontSize: 11, color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--color-hairline)' },
  td: { padding: '13px 14px', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--color-hairline)', verticalAlign: 'middle' },
  row: { background: 'var(--bg-card)' },
  badge: { display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 700 },
  mapLink: { display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 700 },
};
```

- [ ] **Step 2: Add route in App**

Modify `frontend/src/App.jsx`.

Add import:

```js
import AdminServiceTrackingPage   from './pages/admin/AdminServiceTrackingPage';
```

Add route inside the `/admin` layout:

```jsx
        <Route path="service-tracking" element={<AdminServiceTrackingPage />} />
```

- [ ] **Step 3: Add nav item**

Modify `frontend/src/components/shared/AdminLayout.jsx`.

Add this item to `ADMIN_NAV_OP` after services:

```js
  { to: '/admin/service-tracking', label: 'Rastreamento', icon: 'pin'       },
```

Add this item to `GESTOR_NAV_OP` after services:

```js
  { to: '/admin/service-tracking', label: 'Rastreamento', icon: 'pin'    },
```

- [ ] **Step 4: Build frontend**

Run:

```powershell
cd frontend
npm run build
```

Expected: Vite build completes successfully.

- [ ] **Step 5: Commit**

```powershell
git add frontend\src\pages\admin\AdminServiceTrackingPage.jsx frontend\src\App.jsx frontend\src\components\shared\AdminLayout.jsx
git commit -m "feat(tracking): add admin tracking page"
```

---

### Task 7: End-to-End Verification

**Files:**
- Verify only

- [ ] **Step 1: Run backend tests**

Run:

```powershell
cd backend
npm test
```

Expected: all Jest tests pass.

- [ ] **Step 2: Run frontend build**

Run:

```powershell
cd frontend
npm run build
```

Expected: Vite build completes successfully.

- [ ] **Step 3: Run mobile type check**

Run:

```powershell
cd mobile
npx tsc --noEmit
```

Expected: TypeScript completes without errors.

- [ ] **Step 4: Manual smoke test locally**

Start backend and frontend in separate terminals:

```powershell
cd backend
npm run dev
```

```powershell
cd frontend
npm run dev
```

Expected:

- Employee services page still loads.
- Existing GPS panel still appears.
- Tracking indicator appears only when the employee has `pending` or `in_progress` service.
- Admin menu shows `Rastreamento`.
- `/admin/service-tracking` loads and displays empty state or rows from `/api/service-tracking/live`.

- [ ] **Step 5: Confirm clean working tree**

Run:

```powershell
git status --short
```

Expected: no output. If verification exposed a defect, return to the task that owns the affected files, apply the fix there, rerun that task's verification command, and use that task's commit command.

---

## Self-Review

- Spec coverage: migration, backend isolated endpoints, web tracker, mobile tracker, admin page, role filtering, service status filtering, and non-blocking behavior are covered.
- Isolation: existing `useGeolocation`, `GpsContext`, photo upload, point flows, and service status logic are not modified except for reading existing service lists in the two services screens.
- TDD coverage: backend controller behavior is covered with Jest before implementation. Frontend and mobile are verified with build/type-check because no frontend/mobile unit test runner is configured in the current packages.
- Ambiguity resolved: first version uses polling, link-out maps, and latest-position dashboard behavior.
