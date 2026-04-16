# Service Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar templates de serviço recorrente por posto — admin/gestor cria um template e o sistema cria automaticamente ordens de serviço a cada X dias.

**Architecture:** Nova tabela `service_templates` armazena título, posto, funcionário (opcional), intervalo e próximo disparo (`next_run_at`). O cron existente em `push.service.js` (roda a cada hora) verifica templates vencidos e cria `service_orders`, avançando `next_run_at`. Serviços sem responsável têm `assigned_employee_id = NULL` e podem ser atribuídos manualmente depois.

**Tech Stack:** Express.js, PostgreSQL (pg), React 18, React Query, React Router v6, express-validator.

---

## Mapa de arquivos

| Arquivo | Ação |
|---------|------|
| `database/13_service_templates.sql` | Criar — migration |
| `backend/controllers/serviceTemplate.controller.js` | Criar — CRUD de templates |
| `backend/routes/serviceTemplate.routes.js` | Criar — rotas REST |
| `backend/services/push.service.js` | Modificar — adicionar `checkTemplates` |
| `backend/controllers/service.controller.js` | Modificar — LEFT JOIN + função `assign` |
| `backend/routes/service.routes.js` | Modificar — rota `PATCH /:id/assign` |
| `backend/server.js` | Modificar — registrar rotas de templates |
| `frontend/src/pages/admin/AdminServiceTemplatesPage.jsx` | Criar — UI de templates |
| `frontend/src/App.jsx` | Modificar — rota `/admin/service-templates` |
| `frontend/src/components/shared/AdminLayout.jsx` | Modificar — item de menu |
| `frontend/src/pages/admin/AdminServicesPage.jsx` | Modificar — badge + modal atribuição |

---

## Task 1: Migration do banco de dados

**Files:**
- Create: `database/13_service_templates.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- database/13_service_templates.sql

-- 1. Torna assigned_employee_id nullable em service_orders
ALTER TABLE service_orders
  ALTER COLUMN assigned_employee_id DROP NOT NULL;

-- 2. Adiciona coluna template_id em service_orders
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES service_templates(id) ON DELETE SET NULL;

-- Nota: a FK acima falha se service_templates não existe ainda.
-- Por isso criamos service_templates ANTES de alterar service_orders.
-- Reorganizamos abaixo na ordem correta:

-- Reverte a FK adicionada acima e recria após criar a tabela
-- (Copie o bloco todo e execute de uma vez no psql)

-- Cria tabela de templates
CREATE TABLE IF NOT EXISTS service_templates (
  id                   SERIAL PRIMARY KEY,
  title                VARCHAR(200) NOT NULL,
  description          TEXT,
  unit_id              INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  assigned_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  due_time             TIME,
  interval_days        INTEGER NOT NULL CHECK (interval_days >= 1),
  start_date           DATE NOT NULL,
  next_run_at          TIMESTAMPTZ NOT NULL,
  active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_id        INTEGER NOT NULL REFERENCES employees(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_templates_unit   ON service_templates(unit_id);
CREATE INDEX IF NOT EXISTS idx_service_templates_active ON service_templates(active, next_run_at);

CREATE OR REPLACE TRIGGER trigger_service_templates_updated_at
  BEFORE UPDATE ON service_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Altera service_orders: assigned_employee_id nullable + template_id
ALTER TABLE service_orders
  ALTER COLUMN assigned_employee_id DROP NOT NULL;

ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES service_templates(id) ON DELETE SET NULL;
```

**Atenção:** O arquivo possui um comentário explicando a ordem de execução. O bloco SQL deve ser executado inteiro de uma vez (não linha por linha) pois a FK em `service_orders.template_id` depende de `service_templates` já existir.

- [ ] **Step 2: Executar migration**

```bash
psql $DATABASE_URL -f database/13_service_templates.sql
```

Saída esperada: sem erros. Se `service_templates` já existir (re-execução), o `CREATE TABLE IF NOT EXISTS` e `ADD COLUMN IF NOT EXISTS` são idempotentes.

- [ ] **Step 3: Commit**

```bash
git add database/13_service_templates.sql
git commit -m "feat: migration — service_templates e nullable assigned_employee_id"
```

---

## Task 2: Ajustes em service.controller.js

**Files:**
- Modify: `backend/controllers/service.controller.js`

Os JOINs em `list` e `getOne` usam `JOIN employees e ON e.id = so.assigned_employee_id` — com `assigned_employee_id` nullable eles excluiriam serviços sem responsável. Precisam virar `LEFT JOIN`. Também adicionamos a função `assign`.

- [ ] **Step 1: Corrigir `list` — trocar JOIN por LEFT JOIN**

Em `backend/controllers/service.controller.js`, na função `list`, localize a query SELECT e substitua:

```js
// ANTES (linha ~37-52):
    const result = await db.query(
      `SELECT
         so.id, so.title, so.description, so.status,
         so.scheduled_date, so.due_time, so.problem_description,
         so.created_at, so.updated_at,
         e.full_name  AS employee_name,
         cb.full_name AS created_by_name,
         u.name       AS unit_name,
         u.code       AS unit_code
       FROM service_orders so
       JOIN employees e  ON e.id  = so.assigned_employee_id
       JOIN employees cb ON cb.id = so.created_by_id
       JOIN units u      ON u.id  = so.unit_id
       ${where}
       ORDER BY so.scheduled_date ASC, so.created_at DESC`,
      params
    );

// DEPOIS:
    const result = await db.query(
      `SELECT
         so.id, so.title, so.description, so.status,
         so.scheduled_date, so.due_time, so.problem_description,
         so.template_id,
         so.created_at, so.updated_at,
         e.full_name  AS employee_name,
         cb.full_name AS created_by_name,
         u.name       AS unit_name,
         u.code       AS unit_code
       FROM service_orders so
       LEFT JOIN employees e  ON e.id  = so.assigned_employee_id
       JOIN      employees cb ON cb.id = so.created_by_id
       JOIN      units u      ON u.id  = so.unit_id
       ${where}
       ORDER BY so.scheduled_date ASC, so.created_at DESC`,
      params
    );
```

- [ ] **Step 2: Corrigir `getOne` — trocar JOIN por LEFT JOIN**

Na função `getOne`, localize o SELECT e substitua:

```js
// ANTES (linha ~123-134):
    const result = await db.query(
      `SELECT
         so.*,
         e.full_name  AS employee_name,
         cb.full_name AS created_by_name,
         u.name       AS unit_name,
         u.contract_id
       FROM service_orders so
       JOIN employees e  ON e.id  = so.assigned_employee_id
       JOIN employees cb ON cb.id = so.created_by_id
       JOIN units u      ON u.id  = so.unit_id
       WHERE so.id = $1`,
      [id]
    );

// DEPOIS:
    const result = await db.query(
      `SELECT
         so.*,
         e.full_name  AS employee_name,
         cb.full_name AS created_by_name,
         u.name       AS unit_name,
         u.contract_id
       FROM service_orders so
       LEFT JOIN employees e  ON e.id  = so.assigned_employee_id
       JOIN      employees cb ON cb.id = so.created_by_id
       JOIN      units u      ON u.id  = so.unit_id
       WHERE so.id = $1`,
      [id]
    );
```

- [ ] **Step 3: Tornar `assigned_employee_id` opcional em `create`**

Na função `create`, substitua a desestruturação e a lógica de busca do employee:

```js
// ANTES (linha ~65-81):
async function create(req, res, next) {
  try {
    const { title, description, assigned_employee_id, scheduled_date, due_time } = req.body;

    // Busca unidade do funcionário — gestor só pode atribuir a employees do próprio contrato
    const empQuery = req.user.role === 'gestor'
      ? `SELECT e.unit_id, e.full_name FROM employees e
         JOIN units u ON u.id = e.unit_id
         WHERE e.id = $1 AND u.contract_id = $2`
      : `SELECT e.unit_id, e.full_name FROM employees e WHERE e.id = $1`;
    const empParams = req.user.role === 'gestor'
      ? [assigned_employee_id, req.user.contractId]
      : [assigned_employee_id];
    const empResult = await db.query(empQuery, empParams);
    if (!empResult.rows[0]) {
      return res.status(404).json({ error: 'Funcionário não encontrado.' });
    }
    const { unit_id, full_name: empName } = empResult.rows[0];

// DEPOIS:
async function create(req, res, next) {
  try {
    const { title, description, assigned_employee_id, unit_id: bodyUnitId, scheduled_date, due_time } = req.body;

    let unit_id;
    let empName = null;

    if (assigned_employee_id) {
      // Busca unidade do funcionário — gestor só pode atribuir a employees do próprio contrato
      const empQuery = req.user.role === 'gestor'
        ? `SELECT e.unit_id, e.full_name FROM employees e
           JOIN units u ON u.id = e.unit_id
           WHERE e.id = $1 AND u.contract_id = $2`
        : `SELECT e.unit_id, e.full_name FROM employees e WHERE e.id = $1`;
      const empParams = req.user.role === 'gestor'
        ? [assigned_employee_id, req.user.contractId]
        : [assigned_employee_id];
      const empResult = await db.query(empQuery, empParams);
      if (!empResult.rows[0]) {
        return res.status(404).json({ error: 'Funcionário não encontrado.' });
      }
      unit_id = empResult.rows[0].unit_id;
      empName = empResult.rows[0].full_name;
    } else {
      // Sem funcionário: unit_id obrigatório no body
      if (!bodyUnitId) {
        return res.status(400).json({ error: 'unit_id obrigatório quando não há funcionário atribuído.' });
      }
      unit_id = parseInt(bodyUnitId, 10);
      // Gestor só pode usar units do próprio contrato
      if (req.user.role === 'gestor') {
        const unitCheck = await db.query(
          'SELECT id FROM units WHERE id = $1 AND contract_id = $2',
          [unit_id, req.user.contractId]
        );
        if (!unitCheck.rows[0]) return res.status(403).json({ error: 'Unidade fora do seu contrato.' });
      }
    }
```

- [ ] **Step 4: Ajustar o INSERT e notificação em `create`**

Logo após a lógica acima, substitua o INSERT e a notificação:

```js
// ANTES (linha ~83-109):
    const result = await db.query(
      `INSERT INTO service_orders
         (title, description, assigned_employee_id, unit_id, created_by_id, scheduled_date, due_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        title.trim(),
        description?.trim() || null,
        assigned_employee_id,
        unit_id,
        req.user.id,
        scheduled_date,
        due_time || null,
      ]
    );

    const service = result.rows[0];

    // Notificação automática
    await push.notify(
      assigned_employee_id,
      'Novo serviço atribuído',
      `Você tem um novo serviço: "${title}" para ${new Date(scheduled_date).toLocaleDateString('pt-BR')}.`,
      'service_assigned'
    );

// DEPOIS:
    const result = await db.query(
      `INSERT INTO service_orders
         (title, description, assigned_employee_id, unit_id, created_by_id, scheduled_date, due_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        title.trim(),
        description?.trim() || null,
        assigned_employee_id || null,
        unit_id,
        req.user.id,
        scheduled_date,
        due_time || null,
      ]
    );

    const service = result.rows[0];

    // Notificação automática — apenas se há funcionário atribuído
    if (assigned_employee_id) {
      await push.notify(
        assigned_employee_id,
        'Novo serviço atribuído',
        `Você tem um novo serviço: "${title}" para ${new Date(scheduled_date).toLocaleDateString('pt-BR')}.`,
        'service_assigned'
      );
    }
```

- [ ] **Step 5: Adicionar função `assign` ao final do arquivo (antes do `module.exports`)**

```js
// ----------------------------------------------------------------
// PATCH /api/services/:id/assign
// Admin/gestor atribui funcionário a serviço sem responsável
// ----------------------------------------------------------------
async function assign(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const { assigned_employee_id } = req.body;

    const current = await db.query(
      `SELECT so.title, so.unit_id, u.contract_id
       FROM service_orders so
       JOIN units u ON u.id = so.unit_id
       WHERE so.id = $1`,
      [id]
    );
    if (!current.rows[0]) return res.status(404).json({ error: 'Serviço não encontrado.' });
    if (req.user.role === 'gestor' && current.rows[0].contract_id !== req.user.contractId) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    // Verifica se o funcionário pertence ao contrato do gestor
    if (req.user.role === 'gestor') {
      const empCheck = await db.query(
        `SELECT e.id FROM employees e
         JOIN units u ON u.id = e.unit_id
         WHERE e.id = $1 AND u.contract_id = $2`,
        [assigned_employee_id, req.user.contractId]
      );
      if (!empCheck.rows[0]) return res.status(403).json({ error: 'Funcionário fora do seu contrato.' });
    }

    const result = await db.query(
      `UPDATE service_orders
       SET assigned_employee_id = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [assigned_employee_id, id]
    );

    await push.notify(
      assigned_employee_id,
      'Novo serviço atribuído',
      `Você tem um novo serviço: "${current.rows[0].title}".`,
      'service_assigned'
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 6: Atualizar `module.exports`**

```js
// ANTES:
module.exports = { list, create, getOne, updateStatus, addPhoto, getPhoto, deletePhoto, reschedule, deleteService };

// DEPOIS:
module.exports = { list, create, getOne, updateStatus, addPhoto, getPhoto, deletePhoto, reschedule, deleteService, assign };
```

- [ ] **Step 7: Commit**

```bash
git add backend/controllers/service.controller.js
git commit -m "feat: service.controller — LEFT JOIN, assigned opcional, função assign"
```

---

## Task 3: Rota PATCH /:id/assign em service.routes.js

**Files:**
- Modify: `backend/routes/service.routes.js`

- [ ] **Step 1: Adicionar rota de atribuição**

No arquivo `backend/routes/service.routes.js`, após a rota de reagendamento e antes da rota de delete, adicione:

```js
// Atribuir funcionário — apenas admin/gestor
router.patch('/:id/assign',
  auth,
  requireAdminOrGestor,
  body('assigned_employee_id').isInt({ min: 1 }).withMessage('Funcionário obrigatório.'),
  validate,
  controller.assign
);
```

- [ ] **Step 2: Commit**

```bash
git add backend/routes/service.routes.js
git commit -m "feat: rota PATCH /services/:id/assign"
```

---

## Task 4: serviceTemplate.controller.js

**Files:**
- Create: `backend/controllers/serviceTemplate.controller.js`

- [ ] **Step 1: Criar o controller completo**

```js
// backend/controllers/serviceTemplate.controller.js
const db     = require('../config/database');
const logger = require('../utils/logger');

// Escopo: gestor vê apenas templates de unidades do seu contrato
function contractFilter(user, alias = 'st') {
  if (user.role === 'gestor') {
    return { clause: `AND u.contract_id = $`, param: user.contractId };
  }
  return { clause: '', param: null };
}

// ----------------------------------------------------------------
// GET /api/service-templates
// ----------------------------------------------------------------
async function list(req, res, next) {
  try {
    const params = [];
    let where = '';

    if (req.user.role === 'gestor') {
      params.push(req.user.contractId);
      where = `WHERE u.contract_id = $${params.length}`;
    }

    const result = await db.query(
      `SELECT
         st.id, st.title, st.description,
         st.interval_days, st.start_date, st.due_time,
         st.next_run_at, st.active,
         st.assigned_employee_id,
         e.full_name  AS employee_name,
         u.id         AS unit_id,
         u.name       AS unit_name,
         u.code       AS unit_code,
         st.created_at
       FROM service_templates st
       JOIN units u ON u.id = st.unit_id
       LEFT JOIN employees e ON e.id = st.assigned_employee_id
       ${where}
       ORDER BY st.created_at DESC`,
      params
    );

    res.json({ templates: result.rows });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// POST /api/service-templates
// ----------------------------------------------------------------
async function create(req, res, next) {
  try {
    const {
      title, description,
      unit_id, assigned_employee_id,
      due_time, interval_days, start_date,
    } = req.body;

    // Gestor só pode criar em units do próprio contrato
    const unitCheck = req.user.role === 'gestor'
      ? await db.query('SELECT id FROM units WHERE id = $1 AND contract_id = $2', [unit_id, req.user.contractId])
      : await db.query('SELECT id FROM units WHERE id = $1', [unit_id]);
    if (!unitCheck.rows[0]) return res.status(404).json({ error: 'Posto não encontrado.' });

    // Se há funcionário, verifica vínculo com o posto
    if (assigned_employee_id) {
      const empCheck = await db.query(
        'SELECT id FROM employees WHERE id = $1 AND unit_id = $2',
        [assigned_employee_id, unit_id]
      );
      if (!empCheck.rows[0]) {
        return res.status(400).json({ error: 'Funcionário não pertence a este posto.' });
      }
    }

    // next_run_at = start_date às 00:00 UTC
    const next_run_at = new Date(start_date + 'T00:00:00Z').toISOString();

    const result = await db.query(
      `INSERT INTO service_templates
         (title, description, unit_id, assigned_employee_id, due_time, interval_days, start_date, next_run_at, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        title.trim(),
        description?.trim() || null,
        parseInt(unit_id, 10),
        assigned_employee_id ? parseInt(assigned_employee_id, 10) : null,
        due_time || null,
        parseInt(interval_days, 10),
        start_date,
        next_run_at,
        req.user.id,
      ]
    );

    logger.info('Template criado', { templateId: result.rows[0].id, createdBy: req.user.id });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// PATCH /api/service-templates/:id
// ----------------------------------------------------------------
async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const {
      title, description,
      unit_id, assigned_employee_id,
      due_time, interval_days, start_date,
    } = req.body;

    // Verifica existência e escopo
    const current = await db.query(
      `SELECT st.*, u.contract_id FROM service_templates st
       JOIN units u ON u.id = st.unit_id
       WHERE st.id = $1`,
      [id]
    );
    if (!current.rows[0]) return res.status(404).json({ error: 'Template não encontrado.' });
    if (req.user.role === 'gestor' && current.rows[0].contract_id !== req.user.contractId) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    const tpl = current.rows[0];
    const newUnitId       = unit_id        ? parseInt(unit_id, 10)         : tpl.unit_id;
    const newInterval     = interval_days  ? parseInt(interval_days, 10)   : tpl.interval_days;
    const newStartDate    = start_date     || tpl.start_date;
    const newAssigned     = assigned_employee_id !== undefined
      ? (assigned_employee_id ? parseInt(assigned_employee_id, 10) : null)
      : tpl.assigned_employee_id;

    // Recalcula next_run_at se start_date ou interval_days mudaram
    const next_run_at = (start_date || interval_days)
      ? new Date(newStartDate + 'T00:00:00Z').toISOString()
      : tpl.next_run_at;

    const result = await db.query(
      `UPDATE service_templates SET
         title                = COALESCE($1, title),
         description          = $2,
         unit_id              = $3,
         assigned_employee_id = $4,
         due_time             = $5,
         interval_days        = $6,
         start_date           = $7,
         next_run_at          = $8,
         updated_at           = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        title?.trim() || null,
        description !== undefined ? (description?.trim() || null) : tpl.description,
        newUnitId,
        newAssigned,
        due_time !== undefined ? (due_time || null) : tpl.due_time,
        newInterval,
        newStartDate,
        next_run_at,
        id,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// PATCH /api/service-templates/:id/toggle
// ----------------------------------------------------------------
async function toggle(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);

    const current = await db.query(
      `SELECT st.active, u.contract_id FROM service_templates st
       JOIN units u ON u.id = st.unit_id
       WHERE st.id = $1`,
      [id]
    );
    if (!current.rows[0]) return res.status(404).json({ error: 'Template não encontrado.' });
    if (req.user.role === 'gestor' && current.rows[0].contract_id !== req.user.contractId) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    const result = await db.query(
      `UPDATE service_templates SET active = NOT active, updated_at = NOW()
       WHERE id = $1 RETURNING id, active`,
      [id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// DELETE /api/service-templates/:id
// ----------------------------------------------------------------
async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);

    const current = await db.query(
      `SELECT st.id, u.contract_id FROM service_templates st
       JOIN units u ON u.id = st.unit_id
       WHERE st.id = $1`,
      [id]
    );
    if (!current.rows[0]) return res.status(404).json({ error: 'Template não encontrado.' });
    if (req.user.role === 'gestor' && current.rows[0].contract_id !== req.user.contractId) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    await db.query('DELETE FROM service_templates WHERE id = $1', [id]);
    logger.info('Template removido', { templateId: id, deletedBy: req.user.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, toggle, remove };
```

- [ ] **Step 2: Commit**

```bash
git add backend/controllers/serviceTemplate.controller.js
git commit -m "feat: serviceTemplate.controller — CRUD com scoping por contrato"
```

---

## Task 5: serviceTemplate.routes.js

**Files:**
- Create: `backend/routes/serviceTemplate.routes.js`

- [ ] **Step 1: Criar o arquivo de rotas**

```js
// backend/routes/serviceTemplate.routes.js
const express  = require('express');
const { body } = require('express-validator');
const router   = express.Router();

const controller               = require('../controllers/serviceTemplate.controller');
const auth                     = require('../middleware/auth');
const { requireAdminOrGestor } = require('../middleware/roleGuard');
const validate                 = require('../middleware/validate');

// Listagem
router.get('/', auth, requireAdminOrGestor, controller.list);

// Criação
router.post('/',
  auth,
  requireAdminOrGestor,
  body('title').notEmpty().withMessage('Título obrigatório.'),
  body('unit_id').isInt({ min: 1 }).withMessage('Posto obrigatório.'),
  body('interval_days').isInt({ min: 1 }).withMessage('Intervalo mínimo de 1 dia.'),
  body('start_date').isDate().withMessage('Data de início inválida.'),
  validate,
  controller.create
);

// Edição
router.patch('/:id',
  auth,
  requireAdminOrGestor,
  body('title').optional().notEmpty().withMessage('Título não pode ser vazio.'),
  body('interval_days').optional().isInt({ min: 1 }).withMessage('Intervalo mínimo de 1 dia.'),
  body('start_date').optional().isDate().withMessage('Data inválida.'),
  validate,
  controller.update
);

// Ativar/Pausar
router.patch('/:id/toggle', auth, requireAdminOrGestor, controller.toggle);

// Deletar
router.delete('/:id', auth, requireAdminOrGestor, controller.remove);

module.exports = router;
```

- [ ] **Step 2: Commit**

```bash
git add backend/routes/serviceTemplate.routes.js
git commit -m "feat: serviceTemplate.routes — rotas REST de templates"
```

---

## Task 6: Registrar rotas em server.js

**Files:**
- Modify: `backend/server.js`

- [ ] **Step 1: Adicionar import e `app.use`**

Em `backend/server.js`, adicione após o `require` de `serviceRoutes`:

```js
const serviceTemplateRoutes  = require('./routes/serviceTemplate.routes');
```

E após `app.use('/api/services', serviceRoutes);`:

```js
app.use('/api/service-templates', serviceTemplateRoutes);
```

- [ ] **Step 2: Commit**

```bash
git add backend/server.js
git commit -m "feat: registrar rotas /api/service-templates em server.js"
```

---

## Task 7: checkTemplates no cron (push.service.js)

**Files:**
- Modify: `backend/services/push.service.js`

- [ ] **Step 1: Adicionar função `checkTemplates` antes de `startCron`**

Em `backend/services/push.service.js`, adicione antes da função `startCron`:

```js
async function checkTemplates() {
  try {
    const result = await db.query(
      `SELECT * FROM service_templates
       WHERE active = TRUE AND next_run_at <= NOW()`
    );

    for (const tpl of result.rows) {
      // Cria a ordem de serviço
      const inserted = await db.query(
        `INSERT INTO service_orders
           (title, description, assigned_employee_id, unit_id, created_by_id,
            scheduled_date, due_time, template_id)
         VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8)
         RETURNING id`,
        [
          tpl.title,
          tpl.description,
          tpl.assigned_employee_id,  // pode ser NULL
          tpl.unit_id,
          tpl.created_by_id,
          tpl.next_run_at,           // cast para date no SQL
          tpl.due_time,
          tpl.id,
        ]
      );

      // Notifica funcionário se houver um atribuído
      if (tpl.assigned_employee_id) {
        await notify(
          tpl.assigned_employee_id,
          'Novo serviço atribuído',
          `Você tem um novo serviço: "${tpl.title}".`,
          'service_assigned'
        );
      }

      // Avança next_run_at
      await db.query(
        `UPDATE service_templates
         SET next_run_at = next_run_at + ($1 || ' days')::interval,
             updated_at  = NOW()
         WHERE id = $2`,
        [tpl.interval_days, tpl.id]
      );

      logger.info('Serviço criado pelo template', {
        templateId: tpl.id,
        serviceId:  inserted.rows[0].id,
      });
    }
  } catch (err) {
    logger.error('Erro no cron de templates', { error: err.message });
  }
}
```

- [ ] **Step 2: Atualizar `startCron` para chamar `checkTemplates`**

```js
// ANTES:
function startCron() {
  setInterval(checkLateServices, 60 * 60 * 1000);
  checkLateServices();
}

// DEPOIS:
function startCron() {
  setInterval(async () => {
    await checkLateServices();
    await checkTemplates();
  }, 60 * 60 * 1000);
  checkLateServices();
  checkTemplates();
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/services/push.service.js
git commit -m "feat: cron checkTemplates — cria service_orders automaticamente"
```

---

## Task 8: AdminServiceTemplatesPage.jsx

**Files:**
- Create: `frontend/src/pages/admin/AdminServiceTemplatesPage.jsx`

- [ ] **Step 1: Criar a página completa**

```jsx
// frontend/src/pages/admin/AdminServiceTemplatesPage.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const EMPTY_FORM = {
  title: '',
  description: '',
  unit_id: '',
  assigned_employee_id: '',
  due_time: '',
  interval_days: '',
  start_date: '',
};

function useTemplates() {
  return useQuery({
    queryKey: ['service-templates'],
    queryFn: () => api.get('/service-templates').then((r) => r.data.templates),
  });
}

function useUnits() {
  return useQuery({
    queryKey: ['units'],
    queryFn: () => api.get('/units').then((r) => r.data.units),
  });
}

function useEmployeesByUnit(unitId) {
  return useQuery({
    queryKey: ['employees-by-unit', unitId],
    queryFn: () =>
      api.get('/employees').then((r) =>
        (r.data.employees || r.data).filter((e) => String(e.unit_id) === String(unitId))
      ),
    enabled: !!unitId,
  });
}

export default function AdminServiceTemplatesPage() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  const [modal, setModal] = useState(false);       // false | 'create' | template object
  const [form, setForm]   = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { data: templates = [], isLoading } = useTemplates();
  const { data: units = [] }                = useUnits();
  const { data: employees = [] }            = useEmployeesByUnit(form.unit_id);

  const isEditing = modal && modal !== 'create';

  const createMutation = useMutation({
    mutationFn: (body) => api.post('/service-templates', body),
    onSuccess: () => {
      queryClient.invalidateQueries(['service-templates']);
      success('Template criado com sucesso.');
      closeModal();
    },
    onError: (err) => error(err.response?.data?.error || 'Erro ao criar template.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => api.patch(`/service-templates/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries(['service-templates']);
      success('Template atualizado.');
      closeModal();
    },
    onError: (err) => error(err.response?.data?.error || 'Erro ao atualizar template.'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id) => api.patch(`/service-templates/${id}/toggle`),
    onSuccess: () => queryClient.invalidateQueries(['service-templates']),
    onError: () => error('Erro ao alterar status do template.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/service-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['service-templates']);
      success('Template removido.');
      setConfirmDelete(null);
    },
    onError: () => error('Erro ao remover template.'),
  });

  function openCreate() {
    setForm(EMPTY_FORM);
    setModal('create');
  }

  function openEdit(tpl) {
    setForm({
      title:                tpl.title,
      description:          tpl.description || '',
      unit_id:              String(tpl.unit_id),
      assigned_employee_id: tpl.assigned_employee_id ? String(tpl.assigned_employee_id) : '',
      due_time:             tpl.due_time?.slice(0, 5) || '',
      interval_days:        String(tpl.interval_days),
      start_date:           tpl.start_date?.slice(0, 10) || '',
    });
    setModal(tpl);
  }

  function closeModal() {
    setModal(false);
    setForm(EMPTY_FORM);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const body = {
      title:                form.title,
      description:          form.description || undefined,
      unit_id:              parseInt(form.unit_id, 10),
      assigned_employee_id: form.assigned_employee_id ? parseInt(form.assigned_employee_id, 10) : undefined,
      due_time:             form.due_time || undefined,
      interval_days:        parseInt(form.interval_days, 10),
      start_date:           form.start_date,
    };
    if (isEditing) {
      updateMutation.mutate({ id: modal.id, body });
    } else {
      createMutation.mutate(body);
    }
  }

  function fmtDate(dt) {
    if (!dt) return '—';
    return formatInTimeZone(new Date(dt), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm');
  }

  const isBusy = createMutation.isLoading || updateMutation.isLoading;

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>Templates de Serviço</h1>
        <button onClick={openCreate} style={s.primaryBtn}>+ Novo Template</button>
      </div>

      <div style={s.card}>
        {isLoading ? (
          <p style={s.empty}>Carregando...</p>
        ) : templates.length === 0 ? (
          <p style={s.empty}>Nenhum template cadastrado.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['Título', 'Posto', 'Responsável', 'Intervalo', 'Próximo disparo', 'Status', 'Ações'].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {templates.map((tpl) => (
                  <tr key={tpl.id} style={s.tr}>
                    <td style={s.td}>{tpl.title}</td>
                    <td style={s.td}>{tpl.unit_name} <span style={s.code}>{tpl.unit_code}</span></td>
                    <td style={s.td}>
                      {tpl.employee_name
                        ? tpl.employee_name
                        : <span style={s.badgeYellow}>A definir</span>}
                    </td>
                    <td style={s.td}>A cada {tpl.interval_days} dia(s)</td>
                    <td style={s.td}>{fmtDate(tpl.next_run_at)}</td>
                    <td style={s.td}>
                      <span style={tpl.active ? s.badgeGreen : s.badgeGray}>
                        {tpl.active ? 'Ativo' : 'Pausado'}
                      </span>
                    </td>
                    <td style={{ ...s.td, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => openEdit(tpl)} style={s.actionBtn}>Editar</button>
                      <button
                        onClick={() => toggleMutation.mutate(tpl.id)}
                        style={{ ...s.actionBtn, color: tpl.active ? '#d97706' : '#16a34a' }}
                      >
                        {tpl.active ? 'Pausar' : 'Ativar'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(tpl)}
                        style={{ ...s.actionBtn, color: '#dc2626' }}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal criar/editar */}
      {modal && (
        <div style={s.overlay} onClick={closeModal}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={s.modalTitle}>{isEditing ? 'Editar Template' : 'Novo Template'}</h2>
            <form onSubmit={handleSubmit} style={s.form}>
              <label style={s.label}>Título *</label>
              <input
                style={s.input}
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                required
              />

              <label style={s.label}>Descrição</label>
              <textarea
                style={{ ...s.input, height: 60, resize: 'vertical' }}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />

              <label style={s.label}>Posto *</label>
              <select
                style={s.input}
                value={form.unit_id}
                onChange={(e) => setForm((p) => ({ ...p, unit_id: e.target.value, assigned_employee_id: '' }))}
                required
              >
                <option value="">Selecione o posto</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                ))}
              </select>

              <label style={s.label}>Responsável</label>
              <select
                style={s.input}
                value={form.assigned_employee_id}
                onChange={(e) => setForm((p) => ({ ...p, assigned_employee_id: e.target.value }))}
                disabled={!form.unit_id}
              >
                <option value="">A definir / atribuir manualmente</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                ))}
              </select>

              <label style={s.label}>Data de início *</label>
              <input
                type="date"
                style={s.input}
                value={form.start_date}
                onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                required
              />

              <label style={s.label}>Horário limite (opcional)</label>
              <input
                type="time"
                style={s.input}
                value={form.due_time}
                onChange={(e) => setForm((p) => ({ ...p, due_time: e.target.value }))}
              />

              <label style={s.label}>Intervalo em dias *</label>
              <input
                type="number"
                min={1}
                style={s.input}
                value={form.interval_days}
                onChange={(e) => setForm((p) => ({ ...p, interval_days: e.target.value }))}
                required
              />

              <div style={s.modalActions}>
                <button type="button" onClick={closeModal} style={s.cancelBtn} disabled={isBusy}>Cancelar</button>
                <button type="submit" style={s.primaryBtn} disabled={isBusy}>
                  {isBusy ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmação de exclusão */}
      {confirmDelete && (
        <div style={s.overlay} onClick={() => setConfirmDelete(null)}>
          <div style={{ ...s.modal, maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={s.modalTitle}>Excluir template?</h2>
            <p style={{ fontSize: 14, color: '#374151', marginBottom: 20 }}>
              O template <strong>"{confirmDelete.title}"</strong> será removido. Os serviços já gerados não serão afetados.
            </p>
            <div style={s.modalActions}>
              <button onClick={() => setConfirmDelete(null)} style={s.cancelBtn}>Cancelar</button>
              <button
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
                style={{ ...s.primaryBtn, background: '#dc2626' }}
                disabled={deleteMutation.isLoading}
              >
                {deleteMutation.isLoading ? 'Removendo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  header:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  title:        { fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 },
  primaryBtn:   { background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  cancelBtn:    { background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  actionBtn:    { background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#1d4ed8', fontWeight: 600 },
  card:         { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 },
  empty:        { color: '#94a3b8', textAlign: 'center', padding: '32px 0' },
  table:        { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:           { textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap' },
  td:           { padding: '10px 12px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
  tr:           { transition: 'background 0.1s' },
  code:         { fontSize: 11, color: '#94a3b8', marginLeft: 4 },
  badgeYellow:  { background: '#fef9c3', color: '#854d0e', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 },
  badgeGreen:   { background: '#dcfce7', color: '#166534', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 },
  badgeGray:    { background: '#f1f5f9', color: '#64748b', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 },
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 },
  modal:        { background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' },
  modalTitle:   { fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 20, marginTop: 0 },
  form:         { display: 'flex', flexDirection: 'column', gap: 12 },
  label:        { fontSize: 13, fontWeight: 600, color: '#374151' },
  input:        { border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/admin/AdminServiceTemplatesPage.jsx
git commit -m "feat: AdminServiceTemplatesPage — UI de templates recorrentes"
```

---

## Task 9: Registrar rota e menu no frontend

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/shared/AdminLayout.jsx`

- [ ] **Step 1: Adicionar import e rota em App.jsx**

Em `frontend/src/App.jsx`, adicione o import após `AdminServicesPage`:

```js
import AdminServiceTemplatesPage from './pages/admin/AdminServiceTemplatesPage';
```

Dentro do bloco `<Route path="/admin" ...>`, adicione após a rota de `services`:

```jsx
<Route path="service-templates" element={<AdminServiceTemplatesPage />} />
```

- [ ] **Step 2: Adicionar item de menu em AdminLayout.jsx**

Em `frontend/src/components/shared/AdminLayout.jsx`, nos arrays `ADMIN_NAV` e `GESTOR_NAV`, adicione após o item de `services`:

```js
// Em ADMIN_NAV:
{ to: '/admin/service-templates', label: 'Templates', icon: '🔁' },

// Em GESTOR_NAV:
{ to: '/admin/service-templates', label: 'Templates', icon: '🔁' },
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/shared/AdminLayout.jsx
git commit -m "feat: rota e menu para Templates de Serviço"
```

---

## Task 10: Ajustes em AdminServicesPage.jsx

**Files:**
- Modify: `frontend/src/pages/admin/AdminServicesPage.jsx`

- [ ] **Step 1: Adicionar hook de atribuição e estado do modal**

Leia o arquivo completo antes de editar. No topo do componente `AdminServicesPage`, adicione o estado do modal de atribuição junto aos outros estados:

```js
const [assignModal, setAssignModal] = useState(null);   // service object | null
const [assignEmpId, setAssignEmpId] = useState('');
```

Adicione o hook de employees por unit (reutiliza o padrão da página de templates):

```js
function useEmployeesByUnit(unitId) {
  return useQuery({
    queryKey: ['employees-by-unit', unitId],
    queryFn: () =>
      api.get('/employees').then((r) =>
        (r.data.employees || r.data).filter((e) => String(e.unit_id) === String(unitId))
      ),
    enabled: !!unitId,
  });
}
```

Instancie dentro do componente:

```js
const { data: assignEmployees = [] } = useEmployeesByUnit(assignModal?.unit_id);
```

- [ ] **Step 2: Adicionar mutation de atribuição**

```js
const assignMutation = useMutation({
  mutationFn: ({ id, assigned_employee_id }) =>
    api.patch(`/services/${id}/assign`, { assigned_employee_id }),
  onSuccess: async () => {
    queryClient.invalidateQueries(['admin-services']);
    success('Funcionário atribuído.');
    setAssignModal(null);
    setAssignEmpId('');
  },
  onError: (err) => error(err.response?.data?.error || 'Erro ao atribuir funcionário.'),
});
```

- [ ] **Step 3: Adicionar badge "Sem responsável" e botão Atribuir na tabela**

Encontre na tabela onde `employee_name` é exibido e adicione a lógica de badge:

```jsx
// Onde aparece employee_name na célula da tabela, substitua por:
<td style={s.td}>
  {service.employee_name ? (
    service.employee_name
  ) : (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ background: '#fef9c3', color: '#854d0e', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
        Sem responsável
      </span>
      <button
        onClick={() => { setAssignModal(service); setAssignEmpId(''); }}
        style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: '#1d4ed8', fontWeight: 600 }}
      >
        Atribuir
      </button>
    </span>
  )}
</td>
```

- [ ] **Step 4: Adicionar modal de atribuição ao final do JSX (antes do fechamento do `<div>` raiz)**

```jsx
{/* Modal de atribuição de funcionário */}
{assignModal && (
  <div
    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
    onClick={() => { setAssignModal(null); setAssignEmpId(''); }}
  >
    <div
      style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400 }}
      onClick={(e) => e.stopPropagation()}
    >
      <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 16, marginTop: 0 }}>
        Atribuir funcionário
      </h2>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
        Serviço: <strong>{assignModal.title}</strong>
      </p>
      <select
        style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 14, width: '100%', marginBottom: 20 }}
        value={assignEmpId}
        onChange={(e) => setAssignEmpId(e.target.value)}
      >
        <option value="">Selecione o funcionário</option>
        {assignEmployees.map((emp) => (
          <option key={emp.id} value={emp.id}>{emp.full_name}</option>
        ))}
      </select>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button
          onClick={() => { setAssignModal(null); setAssignEmpId(''); }}
          style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          Cancelar
        </button>
        <button
          onClick={() => assignMutation.mutate({ id: assignModal.id, assigned_employee_id: parseInt(assignEmpId, 10) })}
          disabled={!assignEmpId || assignMutation.isLoading}
          style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: !assignEmpId ? 0.5 : 1 }}
        >
          {assignMutation.isLoading ? 'Salvando...' : 'Atribuir'}
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/AdminServicesPage.jsx
git commit -m "feat: AdminServicesPage — badge sem responsável e modal de atribuição"
```

---

## Self-Review

**Cobertura do spec:**
- [x] Migration DB com `service_templates` + alterações em `service_orders` → Task 1
- [x] `assigned_employee_id` nullable em service_orders → Task 1 + Task 2
- [x] `template_id` FK em service_orders → Task 1
- [x] LEFT JOIN em `list` e `getOne` → Task 2
- [x] Função `assign` + rota `PATCH /:id/assign` → Task 2 + Task 3
- [x] Controller CRUD de templates com scoping por contrato → Task 4
- [x] Rotas REST de templates → Task 5
- [x] Registro em server.js → Task 6
- [x] `checkTemplates` no cron → Task 7
- [x] AdminServiceTemplatesPage com tabela, modal criar/editar, toggle, delete → Task 8
- [x] Rota `/admin/service-templates` em App.jsx → Task 9
- [x] Item de menu em ADMIN_NAV e GESTOR_NAV → Task 9
- [x] Badge "Sem responsável" + modal de atribuição em AdminServicesPage → Task 10

**Consistência de tipos:**
- `unit_id`, `assigned_employee_id`, `interval_days` são sempre parseados como `parseInt` antes de enviar ao backend
- `next_run_at` calculado como ISO string UTC consistentemente no controller e no cron

**Sem placeholders:** confirmado.
