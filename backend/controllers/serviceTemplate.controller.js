const db     = require('../config/database');
const push   = require('../services/push.service');
const logger = require('../utils/logger');

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
         st.interval_days, st.quantity, st.fire_weekdays, st.start_date, st.due_time,
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
      due_time, interval_days, start_date, quantity, fire_weekdays,
    } = req.body;

    const qty = Math.min(40, Math.max(1, parseInt(quantity, 10) || 1));
    const fwd = (fire_weekdays != null && fire_weekdays !== 127) ? (parseInt(fire_weekdays, 10) & 127) : null;

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
         (title, description, unit_id, assigned_employee_id, due_time, interval_days, quantity, fire_weekdays, start_date, next_run_at, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        title.trim(),
        description?.trim() || null,
        parseInt(unit_id, 10),
        assigned_employee_id ? parseInt(assigned_employee_id, 10) : null,
        due_time || null,
        parseInt(interval_days, 10),
        qty,
        fwd,
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
      due_time, interval_days, start_date, quantity, fire_weekdays,
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
    const newQuantity     = quantity !== undefined
      ? Math.min(40, Math.max(1, parseInt(quantity, 10) || 1))
      : tpl.quantity;
    const newFireWeekdays = fire_weekdays !== undefined
      ? ((fire_weekdays != null && fire_weekdays !== 127) ? (parseInt(fire_weekdays, 10) & 127) : null)
      : tpl.fire_weekdays;
    const newStartDate    = start_date     || tpl.start_date;
    const newAssigned     = assigned_employee_id !== undefined
      ? (assigned_employee_id ? parseInt(assigned_employee_id, 10) : null)
      : tpl.assigned_employee_id;

    // Gestor não pode mover template para unit fora do seu contrato
    if (unit_id && req.user.role === 'gestor') {
      const unitCheck = await db.query(
        'SELECT id FROM units WHERE id = $1 AND contract_id = $2',
        [newUnitId, req.user.contractId]
      );
      if (!unitCheck.rows[0]) return res.status(403).json({ error: 'Unidade fora do seu contrato.' });
    }

    // Verifica vínculo funcionário-posto se algum dos dois mudou
    if (newAssigned) {
      const empCheck = await db.query(
        'SELECT id FROM employees WHERE id = $1 AND unit_id = $2',
        [newAssigned, newUnitId]
      );
      if (!empCheck.rows[0]) {
        return res.status(400).json({ error: 'Funcionário não pertence a este posto.' });
      }
    }

    // Recalcula next_run_at se start_date mudou
    const next_run_at = start_date
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
         quantity             = $7,
         fire_weekdays        = $8,
         start_date           = $9,
         next_run_at          = $10,
         updated_at           = NOW()
       WHERE id = $11
       RETURNING *`,
      [
        title?.trim() || null,
        description !== undefined ? (description?.trim() || null) : tpl.description,
        newUnitId,
        newAssigned,
        due_time !== undefined ? (due_time || null) : tpl.due_time,
        newInterval,
        newQuantity,
        newFireWeekdays,
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

// ----------------------------------------------------------------
// POST /api/service-templates/:id/fire
// Dispara o template manualmente, criando uma OS com data de hoje
// sem avançar next_run_at (não interfere no agendamento automático)
// ----------------------------------------------------------------
async function fire(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);

    const tplRes = await db.query(
      `SELECT st.*, u.contract_id FROM service_templates st
       JOIN units u ON u.id = st.unit_id
       WHERE st.id = $1`,
      [id]
    );
    if (!tplRes.rows[0]) return res.status(404).json({ error: 'Template não encontrado.' });
    const tpl = tplRes.rows[0];

    if (req.user.role === 'gestor' && tpl.contract_id !== req.user.contractId) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    const scheduledDate = req.body?.scheduled_date || new Date(tpl.next_run_at).toISOString().slice(0, 10);
    const qty = tpl.quantity || 1;
    const serviceIds = [];
    for (let i = 0; i < qty; i++) {
      const result = await db.query(
        `INSERT INTO service_orders
           (title, description, assigned_employee_id, unit_id, created_by_id,
            scheduled_date, due_time, template_id)
         VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8)
         RETURNING id`,
        [tpl.title, tpl.description, tpl.assigned_employee_id, tpl.unit_id,
         req.user.id, scheduledDate, tpl.due_time, tpl.id]
      );
      serviceIds.push(result.rows[0].id);
    }
    const serviceId = serviceIds[0];

    if (tpl.assigned_employee_id) {
      push.notify(
        tpl.assigned_employee_id,
        'Novo serviço atribuído',
        `Você tem um novo serviço: "${tpl.title}".`,
        'service_assigned'
      ).catch(() => {});
    }

    logger.info('Template disparado manualmente', { templateId: id, serviceIds, firedBy: req.user.id });
    res.status(201).json({ serviceIds, count: serviceIds.length });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, toggle, remove, fire };
