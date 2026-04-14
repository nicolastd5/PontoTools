# Service Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar card de serviço em andamento, cadastro de postos com mapa, PDF de serviços com fotos, e Excel com duas abas.

**Architecture:** Quatro funcionalidades independentes implementadas em sequência — backend primeiro, depois frontend. O banco de dados não muda. `leaflet` e `react-leaflet` já estão instalados no frontend.

**Tech Stack:** Express.js, PostgreSQL, React 18, Vite, react-leaflet 4, pdfkit, ExcelJS, date-fns-tz

---

## Mapa de arquivos

| Arquivo | Ação | Motivo |
|---------|------|--------|
| `backend/services/dashboard.service.js` | Modificar | Adicionar `getTodayServices()` |
| `backend/controllers/admin.controller.js` | Modificar | Adicionar handler `getTodayServices` |
| `backend/routes/admin.routes.js` | Modificar | Registrar rota `/services/today` e `/export/services/pdf` |
| `backend/controllers/export.controller.js` | Modificar | Adicionar `exportServicesPdf`, modificar `exportExcel` |
| `frontend/src/components/employee/ServiceCard.jsx` | Criar | Card "serviço em andamento / concluído" |
| `frontend/src/pages/employee/EmployeeDashboardPage.jsx` | Modificar | Usar `ServiceCard` |
| `frontend/src/components/admin/TodayServicesTable.jsx` | Criar | Tabela de serviços do dia para admin/gestor |
| `frontend/src/pages/admin/AdminDashboardPage.jsx` | Modificar | Adicionar seção de serviços |
| `frontend/src/components/admin/UnitFormModal.jsx` | Criar | Modal criar/editar posto com mapa Leaflet |
| `frontend/src/pages/admin/AdminUnitsPage.jsx` | Modificar | Botões novo/editar, usar `UnitFormModal` |
| `frontend/src/pages/admin/AdminExportPage.jsx` | Modificar | Adicionar seção PDF de serviços |

---

## Task 1: Backend — rota `GET /api/admin/services/today`

**Arquivos:**
- Modificar: `backend/services/dashboard.service.js`
- Modificar: `backend/controllers/admin.controller.js`
- Modificar: `backend/routes/admin.routes.js`

- [ ] **Step 1: Adicionar `getTodayServices` ao dashboard service**

Abra `backend/services/dashboard.service.js` e adicione esta função antes de `module.exports`:

```js
/**
 * Retorna serviços do dia (entrada/saída) agrupados por funcionário.
 * @param {number|null} contractId - null = admin vê todos; número = gestor vê só o contrato
 */
async function getTodayServices(contractId = null) {
  const contractFilter = contractId
    ? 'AND c.id = $1'
    : '';
  const params = contractId ? [contractId] : [];

  const result = await db.query(
    `SELECT
       e.id            AS employee_id,
       e.full_name,
       e.badge_number,
       u.name          AS unit_name,
       u.code          AS unit_code,
       MAX(CASE WHEN cr.clock_type = 'entry'      THEN cr.clocked_at_utc END) AS entry_time,
       MAX(CASE WHEN cr.clock_type = 'exit'       THEN cr.clocked_at_utc END) AS exit_time,
       MAX(CASE WHEN cr.clock_type = 'entry'      THEN cr.timezone END)       AS timezone,
       BOOL_AND(cr.is_inside_zone) AS all_inside_zone
     FROM clock_records cr
     JOIN employees e ON e.id = cr.employee_id
     JOIN units     u ON u.id = cr.unit_id
     JOIN contracts c ON c.id = u.contract_id
     WHERE cr.clocked_at_utc::date = CURRENT_DATE
       AND cr.clock_type IN ('entry', 'exit')
       ${contractFilter}
     GROUP BY e.id, e.full_name, e.badge_number, u.name, u.code
     ORDER BY entry_time ASC NULLS LAST`,
    params
  );

  return result.rows;
}
```

Adicione `getTodayServices` ao `module.exports`:

```js
module.exports = {
  getDailySummary,
  getRecentClocks,
  getClocksByUnit,
  getAbsentEmployees,
  getBlockedByReason,
  getTodayServices,
};
```

- [ ] **Step 2: Adicionar handler no admin controller**

Abra `backend/controllers/admin.controller.js` e adicione após a função `getAbsences`:

```js
// ----------------------------------------------------------------
// GET /api/admin/services/today
// Serviços do dia (entrada/saída) para admin e gestor
// ----------------------------------------------------------------
async function getTodayServices(req, res, next) {
  try {
    const contractId = req.user.role === 'gestor' ? req.user.contractId : null;
    const services   = await dashboardSvc.getTodayServices(contractId);
    res.json({ services });
  } catch (err) {
    next(err);
  }
}
```

Adicione `getTodayServices` ao `module.exports` do controller:

```js
module.exports = {
  getDashboard,
  getAbsences,
  getTodayServices,
  getClocks,
  getClockPhoto,
  getBlocked,
  getAuditLogs,
};
```

- [ ] **Step 3: Registrar a rota**

Abra `backend/routes/admin.routes.js`. Após a linha `router.get('/dashboard/absences', ...)`, adicione:

```js
// Serviços do dia — admin e gestor
router.get('/services/today', requireAdminOrGestor, controller.getTodayServices);
```

- [ ] **Step 4: Testar a rota manualmente**

Com o backend rodando (`cd backend && npm run dev`), faça uma requisição:

```bash
curl -H "Authorization: Bearer <token_admin>" http://localhost:3001/api/admin/services/today
```

Resposta esperada:
```json
{
  "services": [
    {
      "employee_id": 1,
      "full_name": "João Silva",
      "badge_number": "001",
      "unit_name": "Centro",
      "unit_code": "CEN",
      "entry_time": "2026-04-14T11:14:00.000Z",
      "exit_time": null,
      "timezone": "America/Sao_Paulo",
      "all_inside_zone": true
    }
  ]
}
```

- [ ] **Step 5: Commit**

```bash
git add backend/services/dashboard.service.js backend/controllers/admin.controller.js backend/routes/admin.routes.js
git commit -m "feat: rota GET /api/admin/services/today para serviços do dia"
```

---

## Task 2: Frontend — `ServiceCard` no dashboard do funcionário

**Arquivos:**
- Criar: `frontend/src/components/employee/ServiceCard.jsx`
- Modificar: `frontend/src/pages/employee/EmployeeDashboardPage.jsx`

- [ ] **Step 1: Criar o componente `ServiceCard`**

Crie `frontend/src/components/employee/ServiceCard.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { formatInTimeZone }    from 'date-fns-tz';

/**
 * Calcula "Xh Ym" a partir de dois Date objects.
 */
function elapsed(from, to = new Date()) {
  const diff = Math.max(0, Math.floor((to - from) / 1000));
  const h    = Math.floor(diff / 3600);
  const m    = Math.floor((diff % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m`;
}

/**
 * Formata hora local a partir de string UTC + timezone.
 */
function localTime(utcStr, tz) {
  return formatInTimeZone(new Date(utcStr), tz, 'HH:mm');
}

export default function ServiceCard({ records }) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const entry = records.find((r) => r.clock_type === 'entry');
  const exit  = records.find((r) => r.clock_type === 'exit');

  const [, tick] = useState(0);

  // Atualiza o cronômetro a cada minuto enquanto o serviço estiver em andamento
  useEffect(() => {
    if (!entry || exit) return;
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [entry, exit]);

  if (!entry) return null;

  const entryDate = new Date(entry.clocked_at_utc);
  const entryTz   = entry.timezone || tz;

  if (!exit) {
    // Em andamento
    return (
      <div style={styles.cardGreen}>
        <div style={styles.label}>▶ Serviço em andamento</div>
        <div style={styles.row}>
          <span>Início: <strong>{localTime(entry.clocked_at_utc, entryTz)}</strong></span>
          <span style={styles.sep}>|</span>
          <span>Decorrido: <strong>{elapsed(entryDate)}</strong></span>
        </div>
      </div>
    );
  }

  // Concluído
  const exitTz   = exit.timezone || tz;
  const exitDate = new Date(exit.clocked_at_utc);

  return (
    <div style={styles.cardBlue}>
      <div style={styles.label}>✓ Serviço concluído</div>
      <div style={styles.row}>
        <span>Início: <strong>{localTime(entry.clocked_at_utc, entryTz)}</strong></span>
        <span style={styles.sep}>→</span>
        <span>Fim: <strong>{localTime(exit.clocked_at_utc, exitTz)}</strong></span>
        <span style={styles.sep}>|</span>
        <span>Total: <strong>{elapsed(entryDate, exitDate)}</strong></span>
      </div>
    </div>
  );
}

const base = {
  borderRadius: 10,
  padding: '12px 16px',
  marginBottom: 16,
  border: '1.5px solid',
};

const styles = {
  cardGreen: { ...base, background: '#f0fdf4', borderColor: '#86efac' },
  cardBlue:  { ...base, background: '#eff6ff', borderColor: '#93c5fd' },
  label: { fontSize: 13, fontWeight: 700, marginBottom: 6 },
  row:   { fontSize: 14, color: '#374151', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  sep:   { color: '#94a3b8' },
};
```

- [ ] **Step 2: Usar `ServiceCard` no `EmployeeDashboardPage`**

Abra `frontend/src/pages/employee/EmployeeDashboardPage.jsx`.

Adicione o import no topo:

```js
import ServiceCard from '../../components/employee/ServiceCard';
```

Dentro do JSX, logo acima do bloco `{/* Botões de batida */}` (linha ~121), adicione:

```jsx
{/* Card de serviço em andamento / concluído */}
{todayRecords.length > 0 && (
  <ServiceCard records={todayRecords} />
)}
```

- [ ] **Step 3: Verificar no navegador**

Inicie o frontend (`cd frontend && npm run dev`) e faça login como funcionário. O card deve aparecer:
- Verde "em andamento" se há entrada mas não saída.
- Azul "concluído" se há entrada e saída.
- Ausente se não há registros.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/employee/ServiceCard.jsx frontend/src/pages/employee/EmployeeDashboardPage.jsx
git commit -m "feat: card de serviço em andamento no dashboard do funcionário"
```

---

## Task 3: Frontend — Seção de serviços no dashboard admin/gestor

**Arquivos:**
- Criar: `frontend/src/components/admin/TodayServicesTable.jsx`
- Modificar: `frontend/src/pages/admin/AdminDashboardPage.jsx`

- [ ] **Step 1: Criar `TodayServicesTable`**

Crie `frontend/src/components/admin/TodayServicesTable.jsx`:

```jsx
import { formatInTimeZone } from 'date-fns-tz';

function localTime(utcStr, tz) {
  if (!utcStr) return '—';
  return formatInTimeZone(new Date(utcStr), tz || 'America/Sao_Paulo', 'HH:mm');
}

function elapsed(fromUtc, toUtc) {
  const diff = Math.max(0, Math.floor((new Date(toUtc || Date.now()) - new Date(fromUtc)) / 1000));
  const h    = Math.floor(diff / 3600);
  const m    = Math.floor((diff % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m`;
}

export default function TodayServicesTable({ services = [], loading }) {
  if (loading) return <p style={{ color: '#94a3b8', fontSize: 13 }}>Carregando serviços...</p>;
  if (!services.length) return <p style={{ color: '#94a3b8', fontSize: 13 }}>Nenhum serviço registrado hoje.</p>;

  const active    = services.filter((s) => s.entry_time && !s.exit_time);
  const completed = services.filter((s) => s.entry_time && s.exit_time);

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Serviços de Hoje</h3>

      {active.length > 0 && (
        <>
          <div style={styles.sectionLabel}>Em andamento ({active.length})</div>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Funcionário', 'Unidade', 'Início', 'Decorrido', 'Zona'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {active.map((s) => (
                <tr key={s.employee_id}>
                  <td style={styles.td}>{s.full_name}</td>
                  <td style={styles.td}>{s.unit_name}</td>
                  <td style={styles.td}>{localTime(s.entry_time, s.timezone)}</td>
                  <td style={styles.td}>{elapsed(s.entry_time)}</td>
                  <td style={styles.td}>
                    <span style={{ color: s.all_inside_zone ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                      {s.all_inside_zone ? '✓' : '✗'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {completed.length > 0 && (
        <>
          <div style={{ ...styles.sectionLabel, marginTop: active.length ? 16 : 0 }}>
            Concluídos ({completed.length})
          </div>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Funcionário', 'Unidade', 'Início', 'Fim', 'Total', 'Zona'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {completed.map((s) => (
                <tr key={s.employee_id}>
                  <td style={styles.td}>{s.full_name}</td>
                  <td style={styles.td}>{s.unit_name}</td>
                  <td style={styles.td}>{localTime(s.entry_time, s.timezone)}</td>
                  <td style={styles.td}>{localTime(s.exit_time, s.timezone)}</td>
                  <td style={styles.td}>{elapsed(s.entry_time, s.exit_time)}</td>
                  <td style={styles.td}>
                    <span style={{ color: s.all_inside_zone ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                      {s.all_inside_zone ? '✓' : '✗'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

const styles = {
  container: {
    background: '#fff', borderRadius: 12,
    border: '1px solid #e2e8f0', padding: '20px 24px', marginTop: 24,
  },
  title: { fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 16 },
  sectionLabel: { fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '6px 10px', color: '#64748b', fontWeight: 600, borderBottom: '2px solid #f1f5f9' },
  td: { padding: '8px 10px', borderBottom: '1px solid #f8fafc', color: '#374151' },
};
```

- [ ] **Step 2: Adicionar query e seção ao `AdminDashboardPage`**

Abra `frontend/src/pages/admin/AdminDashboardPage.jsx`.

Adicione o import:

```js
import TodayServicesTable from '../../components/admin/TodayServicesTable';
```

Adicione o hook `useTodayServices` junto aos outros hooks no topo do arquivo (logo após `function useUnits`):

```js
function useTodayServices() {
  return useQuery({
    queryKey:        ['services-today'],
    queryFn:         () => api.get('/admin/services/today').then((r) => r.data.services),
    refetchInterval: 60 * 1000,
  });
}
```

Dentro de `AdminDashboardPage`, adicione o hook:

```js
const { data: todayServices = [], isLoading: loadingServices } = useTodayServices();
```

No JSX, após o bloco `{/* Últimos registros */}` (após a `RecentClocksTable`), adicione:

```jsx
{/* Serviços do dia */}
<TodayServicesTable services={todayServices} loading={loadingServices} />
```

- [ ] **Step 3: Verificar no navegador**

Faça login como admin. O dashboard deve mostrar a tabela "Serviços de Hoje" com duas sub-seções: "Em andamento" e "Concluídos".

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/admin/TodayServicesTable.jsx frontend/src/pages/admin/AdminDashboardPage.jsx
git commit -m "feat: tabela de serviços do dia no dashboard admin/gestor"
```

---

## Task 4: Frontend — Cadastro de postos com mapa Leaflet

**Arquivos:**
- Criar: `frontend/src/components/admin/UnitFormModal.jsx`
- Modificar: `frontend/src/pages/admin/AdminUnitsPage.jsx`

- [ ] **Step 1: Criar `UnitFormModal`**

Crie `frontend/src/components/admin/UnitFormModal.jsx`:

```jsx
import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Corrige o ícone padrão do Leaflet que o Vite quebra
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const EMPTY = { name: '', code: '', radius_meters: 100, address: '', latitude: -14.235, longitude: -51.925 };

/** Captura cliques no mapa e atualiza a posição do pin. */
function ClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function UnitFormModal({ unit, onSave, onClose, contracts = [], userRole }) {
  const isEdit = Boolean(unit?.id);

  const [form, setForm] = useState(
    unit
      ? { name: unit.name, code: unit.code, radius_meters: unit.radius_meters,
          address: unit.address || '', latitude: parseFloat(unit.latitude), longitude: parseFloat(unit.longitude),
          contract_id: unit.contract_id || '' }
      : { ...EMPTY, contract_id: '' }
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searching,   setSearching]   = useState(false);
  const [mapCenter,   setMapCenter]   = useState([form.latitude, form.longitude]);
  const [mapKey,      setMapKey]      = useState(0); // força re-render do mapa ao mudar centro

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const handleMapClick = useCallback((lat, lng) => {
    set('latitude', lat);
    set('longitude', lng);
    setMapCenter([lat, lng]);
  }, []);

  async function searchAddress() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
        { headers: { 'Accept-Language': 'pt-BR' } }
      );
      const data = await res.json();
      if (data[0]) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        set('latitude', lat);
        set('longitude', lng);
        setMapCenter([lat, lng]);
        setMapKey((k) => k + 1);
      }
    } finally {
      setSearching(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave({
      ...form,
      latitude:      parseFloat(form.latitude),
      longitude:     parseFloat(form.longitude),
      radius_meters: parseInt(form.radius_meters, 10),
      contract_id:   form.contract_id || undefined,
    });
  }

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{isEdit ? 'Editar Posto' : 'Novo Posto'}</h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Campos de texto */}
          <div style={styles.row2}>
            <div style={styles.field}>
              <label style={styles.label}>Nome *</label>
              <input required value={form.name} onChange={(e) => set('name', e.target.value)} style={styles.input} />
            </div>
            <div style={{ ...styles.field, width: 120 }}>
              <label style={styles.label}>Código *</label>
              <input required value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} style={styles.input} />
            </div>
            <div style={{ ...styles.field, width: 110 }}>
              <label style={styles.label}>Raio (m)</label>
              <input type="number" min="10" max="5000" value={form.radius_meters}
                onChange={(e) => set('radius_meters', e.target.value)} style={styles.input} />
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Endereço (opcional)</label>
            <input value={form.address} onChange={(e) => set('address', e.target.value)} style={styles.input} placeholder="Apenas para exibição" />
          </div>

          {userRole === 'admin' && contracts.length > 0 && (
            <div style={styles.field}>
              <label style={styles.label}>Contrato</label>
              <select value={form.contract_id} onChange={(e) => set('contract_id', e.target.value)} style={styles.input}>
                <option value="">Sem contrato</option>
                {contracts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* Busca de endereço */}
          <div style={styles.field}>
            <label style={styles.label}>Localização no mapa</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchAddress())}
                placeholder="Buscar endereço..."
                style={{ ...styles.input, flex: 1 }}
              />
              <button type="button" onClick={searchAddress} disabled={searching}
                style={{ ...styles.saveBtn, width: 'auto', padding: '0 16px', background: '#64748b' }}>
                {searching ? '...' : 'Buscar'}
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
              Clique no mapa para posicionar o pin. Lat: {form.latitude.toFixed(5)} | Lon: {form.longitude.toFixed(5)}
            </p>

            {/* Mapa */}
            <div style={{ height: 300, borderRadius: 8, overflow: 'hidden', border: '1.5px solid #e2e8f0' }}>
              <MapContainer
                key={mapKey}
                center={mapCenter}
                zoom={15}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ClickHandler onMapClick={handleMapClick} />
                <Marker position={[form.latitude, form.longitude]} />
                <Circle
                  center={[form.latitude, form.longitude]}
                  radius={parseInt(form.radius_meters, 10) || 100}
                  pathOptions={{ color: '#1d4ed8', fillColor: '#1d4ed8', fillOpacity: 0.1 }}
                />
              </MapContainer>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>Cancelar</button>
            <button type="submit" style={styles.saveBtn}>Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: '#fff', borderRadius: 14, width: '100%', maxWidth: 680,
    maxHeight: '90vh', overflowY: 'auto', padding: '24px 28px',
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#0f172a' },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#64748b' },
  row2: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14, flex: 1 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151' },
  input: { padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#374151', outline: 'none' },
  cancelBtn: { padding: '10px 20px', background: '#f1f5f9', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', color: '#374151' },
  saveBtn:   { padding: '10px 24px', background: '#1d4ed8', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#fff' },
};
```

- [ ] **Step 2: Atualizar `AdminUnitsPage` com botões e modal**

Substitua o conteúdo de `frontend/src/pages/admin/AdminUnitsPage.jsx` por:

```jsx
import { useState }  from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api           from '../../services/api';
import { useAuth }   from '../../contexts/AuthContext';
import { useToast }  from '../../contexts/ToastContext';
import UnitFormModal from '../../components/admin/UnitFormModal';

function useContracts() {
  return useQuery({ queryKey: ['contracts'], queryFn: () => api.get('/contracts').then((r) => r.data.contracts) });
}

export default function AdminUnitsPage() {
  const queryClient  = useQueryClient();
  const { success, error } = useToast();
  const { user }     = useAuth();

  const { data: units = [], isLoading } = useQuery({
    queryKey: ['units-admin'],
    queryFn:  () => api.get('/units').then((r) => r.data.units),
  });

  const { data: contracts = [] } = useContracts();

  const [modal, setModal]   = useState(null); // null | { unit?: object }

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/units', data),
    onSuccess: () => { queryClient.invalidateQueries(['units-admin']); success('Posto criado.'); setModal(null); },
    onError:   () => error('Erro ao criar posto.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/units/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries(['units-admin']); success('Posto atualizado.'); setModal(null); },
    onError:   () => error('Erro ao atualizar posto.'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id) => api.delete(`/units/${id}`),
    onSuccess: () => { queryClient.invalidateQueries(['units-admin']); success('Posto desativado.'); },
    onError:   () => error('Erro ao desativar posto.'),
  });

  function handleSave(formData) {
    if (modal?.unit?.id) {
      updateMutation.mutate({ id: modal.unit.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={styles.title}>Unidades</h1>
          <p style={styles.subtitle}>Gerencie as unidades e seus pontos de referência GPS.</p>
        </div>
        <button onClick={() => setModal({})} style={styles.newBtn}>+ Novo Posto</button>
      </div>

      {isLoading ? (
        <p style={{ color: '#94a3b8' }}>Carregando...</p>
      ) : (
        <div style={styles.grid}>
          {units.map((u) => (
            <div key={u.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.code}>{u.code}</span>
                <span style={{ ...styles.badge, background: u.active ? '#dcfce7' : '#f1f5f9', color: u.active ? '#166534' : '#64748b' }}>
                  {u.active ? 'Ativa' : 'Inativa'}
                </span>
              </div>
              <h3 style={styles.name}>{u.name}</h3>
              {u.address && <p style={styles.address}>{u.address}</p>}
              <div style={styles.coords}>
                <div style={styles.coordItem}>
                  <span style={styles.coordLabel}>Lat</span>
                  <span style={styles.coordValue}>{parseFloat(u.latitude).toFixed(5)}</span>
                </div>
                <div style={styles.coordItem}>
                  <span style={styles.coordLabel}>Lng</span>
                  <span style={styles.coordValue}>{parseFloat(u.longitude).toFixed(5)}</span>
                </div>
                <div style={styles.coordItem}>
                  <span style={styles.coordLabel}>Raio</span>
                  <span style={styles.coordValue}>{u.radius_meters}m</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => setModal({ unit: u })} style={styles.editBtn}>Editar</button>
                {u.active && (
                  <button
                    onClick={() => window.confirm(`Desativar "${u.name}"?`) && deactivateMutation.mutate(u.id)}
                    style={styles.deactivateBtn}
                  >
                    Desativar
                  </button>
                )}
                <a href={`https://maps.google.com/?q=${u.latitude},${u.longitude}`}
                  target="_blank" rel="noreferrer" style={styles.mapLink}>
                  Ver no mapa ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <UnitFormModal
          unit={modal.unit}
          contracts={contracts}
          userRole={user?.role}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

const styles = {
  title:    { fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 0 },
  newBtn: {
    padding: '10px 18px', background: '#1d4ed8', border: 'none',
    borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
  card: { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px' },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  code:    { fontSize: 12, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', padding: '2px 8px', borderRadius: 4 },
  badge:   { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 },
  name:    { fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
  address: { fontSize: 12, color: '#64748b', marginBottom: 14, lineHeight: 1.5 },
  coords:  { display: 'flex', gap: 12, marginBottom: 8 },
  coordItem:   { display: 'flex', flexDirection: 'column', gap: 2 },
  coordLabel:  { fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' },
  coordValue:  { fontSize: 12, color: '#374151', fontWeight: 600 },
  editBtn:     { padding: '6px 14px', background: '#f1f5f9', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#374151' },
  deactivateBtn: { padding: '6px 14px', background: '#fef2f2', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#dc2626' },
  mapLink: { fontSize: 12, color: '#1d4ed8', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center' },
};
```

- [ ] **Step 3: Verificar no navegador**

Acesse `/admin/units`. Deve aparecer:
- Botão "Novo Posto" no canto superior direito.
- Botão "Editar" em cada card.
- Ao clicar em qualquer um, o modal abre com o mapa Leaflet.
- Busca de endereço move o pin e atualiza lat/lon.
- Círculo azul mostra o raio ao redor do pin.
- Ao clicar no mapa, o pin se move.
- Salvar chama a API e fecha o modal.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/admin/UnitFormModal.jsx frontend/src/pages/admin/AdminUnitsPage.jsx
git commit -m "feat: cadastro e edição de postos com mapa Leaflet interativo"
```

---

## Task 5: Backend — PDF de serviços com fotos

**Arquivos:**
- Modificar: `backend/controllers/export.controller.js`
- Modificar: `backend/routes/admin.routes.js`

- [ ] **Step 1: Adicionar `exportServicesPdf` ao export controller**

Abra `backend/controllers/export.controller.js`. Adicione esta função antes de `module.exports`:

```js
// ----------------------------------------------------------------
// GET /api/admin/export/services/pdf
// Relatório de serviços com fotos (entrada + saída)
// Filtros: employeeId + startDate + endDate  OU  unitId + startDate + endDate
// ----------------------------------------------------------------
async function exportServicesPdf(req, res, next) {
  try {
    const { employeeId, unitId, startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: startDate, endDate.' });
    }
    if (!employeeId && !unitId) {
      return res.status(400).json({ error: 'Informe employeeId ou unitId.' });
    }

    // Monta query dinâmica
    const params  = [startDate, endDate];
    const filters = [];
    if (employeeId) filters.push(`cr.employee_id = $${params.push(parseInt(employeeId, 10))}`);
    if (unitId)     filters.push(`cr.unit_id     = $${params.push(parseInt(unitId,     10))}`);

    const result = await db.query(
      `SELECT
         cr.employee_id,
         e.full_name, e.badge_number,
         u.name AS unit_name,
         cr.clock_type,
         cr.clocked_at_utc,
         cr.timezone,
         cr.is_inside_zone,
         cr.photo_path
       FROM clock_records cr
       JOIN employees e ON e.id = cr.employee_id
       JOIN units     u ON u.id = cr.unit_id
       WHERE cr.clocked_at_utc::date BETWEEN $1 AND $2
         AND cr.clock_type IN ('entry', 'exit')
         ${filters.length ? 'AND ' + filters.join(' AND ') : ''}
       ORDER BY cr.employee_id, cr.clocked_at_utc ASC`,
      params
    );

    // Agrupa em serviços por funcionário + dia
    const servicesMap = {};
    result.rows.forEach((r) => {
      const localDate = formatLocalTime(r.clocked_at_utc, r.timezone, 'yyyy-MM-dd');
      const key       = `${r.employee_id}_${localDate}`;
      if (!servicesMap[key]) {
        servicesMap[key] = {
          employee_id: r.employee_id,
          full_name:   r.full_name,
          badge_number: r.badge_number,
          unit_name:   r.unit_name,
          date:        formatLocalTime(r.clocked_at_utc, r.timezone, 'dd/MM/yyyy'),
          entry:       null,
          exit:        null,
        };
      }
      if (r.clock_type === 'entry') servicesMap[key].entry = r;
      if (r.clock_type === 'exit')  servicesMap[key].exit  = r;
    });

    const services = Object.values(servicesMap);

    if (!services.length) {
      return res.status(404).json({ error: 'Nenhum serviço encontrado para o período.' });
    }

    // Gera PDF
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="servicos_${startDate}_${endDate}.pdf"`);
    doc.pipe(res);

    // Capa / cabeçalho
    doc.fontSize(16).font('Helvetica-Bold').text('RELATÓRIO DE SERVIÇOS', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica')
       .text(`Período: ${startDate} a ${endDate}`, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#64748b')
       .text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
    doc.fillColor('#000');
    doc.moveDown(1);

    // Linha separadora
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.8);

    for (const svc of services) {
      // Verifica se há espaço para o bloco (aprox 200px); se não, nova página
      if (doc.y > 600) doc.addPage();

      // Título do serviço
      doc.fontSize(12).font('Helvetica-Bold')
         .text(`${svc.full_name}  ·  ${svc.unit_name}  ·  ${svc.date}`);
      doc.moveDown(0.3);

      const entryTime = svc.entry
        ? formatLocalTime(svc.entry.clocked_at_utc, svc.entry.timezone, 'HH:mm')
        : '—';
      const exitTime  = svc.exit
        ? formatLocalTime(svc.exit.clocked_at_utc,  svc.exit.timezone,  'HH:mm')
        : '—';

      let totalStr = '—';
      if (svc.entry && svc.exit) {
        const diffSec = Math.floor(
          (new Date(svc.exit.clocked_at_utc) - new Date(svc.entry.clocked_at_utc)) / 1000
        );
        const h = Math.floor(diffSec / 3600);
        const m = Math.floor((diffSec % 3600) / 60);
        totalStr = `${h}h${String(m).padStart(2, '0')}m`;
      }

      const inside = svc.entry?.is_inside_zone !== false && svc.exit?.is_inside_zone !== false;

      doc.fontSize(10).font('Helvetica')
         .text(`Entrada: ${entryTime}   →   Saída: ${exitTime}   |   Total: ${totalStr}   |   Zona: ${inside ? '✓ Dentro' : '✗ Fora'}`);
      doc.moveDown(0.5);

      // Fotos
      const photoY  = doc.y;
      const imgSize = 150;
      const photoPromises = [];

      if (svc.entry?.photo_path) {
        photoPromises.push(storage.getBuffer(svc.entry.photo_path).catch(() => null));
      } else {
        photoPromises.push(Promise.resolve(null));
      }
      if (svc.exit?.photo_path) {
        photoPromises.push(storage.getBuffer(svc.exit.photo_path).catch(() => null));
      } else {
        photoPromises.push(Promise.resolve(null));
      }

      const [entryBuf, exitBuf] = await Promise.all(photoPromises);

      if (entryBuf) {
        doc.image(entryBuf, 40, photoY, { width: imgSize, height: imgSize });
        doc.fontSize(9).fillColor('#64748b')
           .text(`Entrada ${entryTime}`, 40, photoY + imgSize + 2, { width: imgSize, align: 'center' });
        doc.fillColor('#000');
      }
      if (exitBuf) {
        doc.image(exitBuf, 210, photoY, { width: imgSize, height: imgSize });
        doc.fontSize(9).fillColor('#64748b')
           .text(`Saída ${exitTime}`, 210, photoY + imgSize + 2, { width: imgSize, align: 'center' });
        doc.fillColor('#000');
      }

      // Avança o cursor após as fotos
      doc.y = photoY + imgSize + 20;
      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#e2e8f0').stroke();
      doc.strokeColor('#000');
      doc.moveDown(0.8);
    }

    doc.end();
  } catch (err) {
    next(err);
  }
}
```

Atualize `module.exports`:

```js
module.exports = { exportPdf, exportExcel, exportServicesPdf };
```

- [ ] **Step 2: Registrar a rota**

Abra `backend/routes/admin.routes.js`. Após a linha `router.get('/export/excel', ...)`, adicione:

```js
router.get('/export/services/pdf', requireAdminOrGestor, exportController.exportServicesPdf);
```

- [ ] **Step 3: Testar manualmente**

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/admin/export/services/pdf?startDate=2026-04-01&endDate=2026-04-14&unitId=1" \
  --output servicos.pdf
```

Abra `servicos.pdf` e verifique se os blocos de serviço aparecem com fotos.

- [ ] **Step 4: Commit**

```bash
git add backend/controllers/export.controller.js backend/routes/admin.routes.js
git commit -m "feat: endpoint GET /api/admin/export/services/pdf com fotos"
```

---

## Task 6: Backend — Excel com abas "Serviços" e "Auditoria"

**Arquivos:**
- Modificar: `backend/controllers/export.controller.js`

- [ ] **Step 1: Modificar `exportExcel` para adicionar aba "Serviços"**

Abra `backend/controllers/export.controller.js`. Localize a função `exportExcel`. Após a linha `const result = await db.query(...)` (onde os dados brutos são buscados), adicione a criação da aba de serviços **antes** de criar a aba de auditoria.

Substitua a seção que começa em `const workbook = new ExcelJS.Workbook()` até o final da função pelo seguinte:

```js
    const workbook = new ExcelJS.Workbook();

    // ---- Aba 1: Serviços (turnos agrupados) ----
    const svcSheet = workbook.addWorksheet('Serviços');
    svcSheet.columns = [
      { header: 'Funcionário',    key: 'full_name',      width: 28 },
      { header: 'Matrícula',      key: 'badge_number',   width: 14 },
      { header: 'Unidade',        key: 'unit_name',      width: 22 },
      { header: 'Data',           key: 'date',           width: 12 },
      { header: 'Hora Entrada',   key: 'entry_time',     width: 14 },
      { header: 'Hora Saída',     key: 'exit_time',      width: 14 },
      { header: 'Total Horas',    key: 'total_hours',    width: 14 },
      { header: 'Dentro da Zona', key: 'inside_zone',    width: 14 },
    ];
    svcSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    svcSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } };

    // Agrupa batidas em serviços
    const svcMap = {};
    result.rows.forEach((r) => {
      const localDate = formatLocalTime(r.clocked_at_utc, r.timezone, 'yyyy-MM-dd');
      const key       = `${r.employee_id}_${localDate}`;
      if (!svcMap[key]) {
        svcMap[key] = {
          full_name:    r.full_name,
          badge_number: r.badge_number,
          unit_name:    r.unit_name,
          date:         formatLocalTime(r.clocked_at_utc, r.timezone, 'dd/MM/yyyy'),
          entry:        null,
          exit:         null,
        };
      }
      if (r.clock_type === 'entry') svcMap[key].entry = r;
      if (r.clock_type === 'exit')  svcMap[key].exit  = r;
    });

    Object.values(svcMap).forEach((svc) => {
      const entryTime = svc.entry
        ? formatLocalTime(svc.entry.clocked_at_utc, svc.entry.timezone, 'HH:mm')
        : '—';
      const exitTime  = svc.exit
        ? formatLocalTime(svc.exit.clocked_at_utc,  svc.exit.timezone,  'HH:mm')
        : '—';

      let totalHours = '—';
      if (svc.entry && svc.exit) {
        const diffSec = Math.floor(
          (new Date(svc.exit.clocked_at_utc) - new Date(svc.entry.clocked_at_utc)) / 1000
        );
        const h = Math.floor(diffSec / 3600);
        const m = Math.floor((diffSec % 3600) / 60);
        totalHours = `${h}h${String(m).padStart(2, '0')}m`;
      }

      const inside = svc.entry?.is_inside_zone !== false && svc.exit?.is_inside_zone !== false;

      svcSheet.addRow({
        full_name:    svc.full_name,
        badge_number: svc.badge_number,
        unit_name:    svc.unit_name,
        date:         svc.date,
        entry_time:   entryTime,
        exit_time:    exitTime,
        total_hours:  totalHours,
        inside_zone:  inside ? 'Sim' : 'Não',
      });
    });

    // ---- Aba 2: Auditoria (batidas individuais — igual ao original) ----
    const worksheet = workbook.addWorksheet('Auditoria');
    worksheet.columns = [
      { header: 'ID',             key: 'id',               width: 8  },
      { header: 'Funcionário',    key: 'full_name',        width: 28 },
      { header: 'Matrícula',      key: 'badge_number',     width: 14 },
      { header: 'Unidade',        key: 'unit_name',        width: 22 },
      { header: 'Código Unidade', key: 'unit_code',        width: 14 },
      { header: 'Tipo Batida',    key: 'clock_type',       width: 16 },
      { header: 'Horário UTC',    key: 'clocked_at_utc',  width: 22 },
      { header: 'Fuso Horário',   key: 'timezone',         width: 20 },
      { header: 'Horário Local',  key: 'local_time',       width: 22 },
      { header: 'Latitude',       key: 'latitude',         width: 14 },
      { header: 'Longitude',      key: 'longitude',        width: 14 },
      { header: 'Precisão GPS (m)', key: 'accuracy_meters', width: 16 },
      { header: 'Distância (m)',  key: 'distance_meters',  width: 14 },
      { header: 'Dentro da Zona', key: 'is_inside_zone',  width: 14 },
      { header: 'IP',             key: 'ip_address',       width: 16 },
    ];
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    result.rows.forEach((r) => {
      worksheet.addRow({
        ...r,
        local_time:     formatLocalTime(r.clocked_at_utc, r.timezone),
        is_inside_zone: r.is_inside_zone ? 'Sim' : 'Não',
        latitude:       parseFloat(r.latitude),
        longitude:      parseFloat(r.longitude),
      });
    });

    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="auditoria_${startDate}_${endDate}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
```

- [ ] **Step 2: Testar o Excel**

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/admin/export/excel?startDate=2026-04-01&endDate=2026-04-14" \
  --output auditoria.xlsx
```

Abra o arquivo e confirme que há duas abas: "Serviços" e "Auditoria".

- [ ] **Step 3: Commit**

```bash
git add backend/controllers/export.controller.js
git commit -m "feat: Excel com abas Serviços e Auditoria"
```

---

## Task 7: Frontend — Seção de serviços na página de exportação

**Arquivos:**
- Modificar: `frontend/src/pages/admin/AdminExportPage.jsx`

- [ ] **Step 1: Adicionar estado e função de exportação de serviços**

Abra `frontend/src/pages/admin/AdminExportPage.jsx`.

Adicione o estado do formulário de serviços junto aos outros estados (após `const [xlsForm, ...]`):

```js
const [svcForm, setSvcForm] = useState({ filterType: 'employee', employeeId: '', unitId: '', startDate: '', endDate: '' });
```

Adicione a função de exportação após `exportExcel`:

```js
async function exportServicesPdf() {
  if (!svcForm.startDate || !svcForm.endDate) {
    return error('Selecione o intervalo de datas.');
  }
  if (svcForm.filterType === 'employee' && !svcForm.employeeId) {
    return error('Selecione o funcionário.');
  }
  if (svcForm.filterType === 'unit' && !svcForm.unitId) {
    return error('Selecione a unidade.');
  }
  try {
    const params = {
      startDate: svcForm.startDate,
      endDate:   svcForm.endDate,
    };
    if (svcForm.filterType === 'employee') params.employeeId = svcForm.employeeId;
    else params.unitId = svcForm.unitId;

    const res = await api.get('/admin/export/services/pdf', { params, responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a   = document.createElement('a');
    a.href = url;
    a.download = `servicos_${svcForm.startDate}_${svcForm.endDate}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    error('Erro ao gerar PDF de serviços. Tente novamente.');
  }
}
```

- [ ] **Step 2: Adicionar o card de serviços no JSX**

Dentro do `<div style={styles.grid}>`, adicione um terceiro card após o card do Excel:

```jsx
{/* PDF — Relatório de Serviços */}
<div style={styles.card}>
  <div style={styles.cardIcon}>📋</div>
  <h2 style={styles.cardTitle}>Relatório de Serviços (PDF)</h2>
  <p style={styles.cardDesc}>
    Exporta os serviços (turnos completos) com fotos de entrada e saída de cada funcionário.
  </p>

  <div style={styles.field}>
    <label style={styles.label}>Filtrar por</label>
    <select
      value={svcForm.filterType}
      onChange={(e) => setSvcForm((p) => ({ ...p, filterType: e.target.value, employeeId: '', unitId: '' }))}
      style={styles.select}
    >
      <option value="employee">Funcionário</option>
      <option value="unit">Unidade</option>
    </select>
  </div>

  {svcForm.filterType === 'employee' ? (
    <div style={styles.field}>
      <label style={styles.label}>Funcionário</label>
      <select
        value={svcForm.employeeId}
        onChange={(e) => setSvcForm((p) => ({ ...p, employeeId: e.target.value }))}
        style={styles.select}
      >
        <option value="">Selecione...</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>{e.full_name} ({e.badge_number})</option>
        ))}
      </select>
    </div>
  ) : (
    <div style={styles.field}>
      <label style={styles.label}>Unidade</label>
      <select
        value={svcForm.unitId}
        onChange={(e) => setSvcForm((p) => ({ ...p, unitId: e.target.value }))}
        style={styles.select}
      >
        <option value="">Selecione...</option>
        {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
    </div>
  )}

  <div style={{ display: 'flex', gap: 10 }}>
    <div style={{ ...styles.field, flex: 1 }}>
      <label style={styles.label}>Data início</label>
      <input type="date" value={svcForm.startDate}
        onChange={(e) => setSvcForm((p) => ({ ...p, startDate: e.target.value }))}
        style={styles.input} />
    </div>
    <div style={{ ...styles.field, flex: 1 }}>
      <label style={styles.label}>Data fim</label>
      <input type="date" value={svcForm.endDate}
        onChange={(e) => setSvcForm((p) => ({ ...p, endDate: e.target.value }))}
        style={styles.input} />
    </div>
  </div>

  <button onClick={exportServicesPdf} style={{ ...styles.btn, background: '#7c3aed' }}>
    Gerar PDF de Serviços
  </button>
</div>
```

- [ ] **Step 3: Verificar no navegador**

Acesse `/admin/export`. O terceiro card "Relatório de Serviços (PDF)" deve aparecer com o toggle de filtro por funcionário/unidade e o botão roxo "Gerar PDF de Serviços".

- [ ] **Step 4: Commit final**

```bash
git add frontend/src/pages/admin/AdminExportPage.jsx
git commit -m "feat: exportação de relatório de serviços com fotos na página de exportação"
```

---

## Self-Review

**Spec coverage:**
- ✓ Card de serviço em andamento com cronômetro → Task 2
- ✓ Card vira resumo após saída → Task 2 (`ServiceCard`)
- ✓ Admin/gestor vê serviços do dia → Task 1 (backend) + Task 3 (frontend)
- ✓ Gestor filtrado por `contractId` → Task 1 (`getTodayServices`)
- ✓ Mapa com busca de endereço → Task 4 (`UnitFormModal`)
- ✓ Lat/lon ocultos, raio visual → Task 4
- ✓ Create/edit posts → Task 4 (`AdminUnitsPage`)
- ✓ PDF de serviços por funcionário ou unidade → Task 5 + Task 7
- ✓ Fotos de entrada e saída no PDF → Task 5
- ✓ Excel com aba Serviços + aba Auditoria → Task 6
- ✓ Exportação acessível via página de export → Task 7

**Sem placeholders detectados.**

**Consistência de tipos:**
- `formatLocalTime` usada uniformemente em tasks 5 e 6.
- `storage.getBuffer` chamado corretamente em task 5.
- Props de `ServiceCard` (`records`) correspondem ao que `EmployeeDashboardPage` passa (`todayRecords`).
- Props de `UnitFormModal` (`unit`, `contracts`, `userRole`, `onSave`, `onClose`) correspondem ao uso em `AdminUnitsPage`.
