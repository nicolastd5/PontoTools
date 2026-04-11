const db      = require('../config/database');
const storage = require('../config/storage');
const push    = require('../services/push.service');
const logger  = require('../utils/logger');

// ----------------------------------------------------------------
// GET /api/services
// Admin/gestor: lista todos da unidade/contrato
// Employee: lista os seus
// ----------------------------------------------------------------
async function list(req, res, next) {
  try {
    const { status, employeeId } = req.query;
    const params  = [];
    const filters = [];

    if (req.user.role === 'employee') {
      params.push(req.user.id);
      filters.push(`so.assigned_employee_id = $${params.length}`);
    } else if (req.user.role === 'gestor') {
      // gestor vê apenas serviços de funcionários do seu contrato
      params.push(req.user.contractId);
      filters.push(`u.contract_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      filters.push(`so.status = $${params.length}`);
    }
    if (employeeId && req.user.role !== 'employee') {
      params.push(parseInt(employeeId, 10));
      filters.push(`so.assigned_employee_id = $${params.length}`);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT
         so.id, so.title, so.description, so.status,
         so.scheduled_date, so.due_time, so.problem_description,
         so.created_at, so.updated_at,
         e.name  AS employee_name,
         cb.name AS created_by_name,
         u.name  AS unit_name,
         u.code  AS unit_code
       FROM service_orders so
       JOIN employees e  ON e.id  = so.assigned_employee_id
       JOIN employees cb ON cb.id = so.created_by_id
       JOIN units u      ON u.id  = so.unit_id
       ${where}
       ORDER BY so.scheduled_date ASC, so.created_at DESC`,
      params
    );

    res.json({ services: result.rows });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// POST /api/services
// ----------------------------------------------------------------
async function create(req, res, next) {
  try {
    const { title, description, assigned_employee_id, scheduled_date, due_time } = req.body;

    // Busca unidade do funcionário
    const empResult = await db.query(
      `SELECT e.unit_id, e.name FROM employees e WHERE e.id = $1`,
      [assigned_employee_id]
    );
    if (!empResult.rows[0]) {
      return res.status(404).json({ error: 'Funcionário não encontrado.' });
    }
    const { unit_id, name: empName } = empResult.rows[0];

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

    logger.info('Serviço criado', { serviceId: service.id, assignedTo: assigned_employee_id });
    res.status(201).json(service);
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// GET /api/services/:id
// ----------------------------------------------------------------
async function getOne(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);

    const result = await db.query(
      `SELECT
         so.*,
         e.name  AS employee_name,
         cb.name AS created_by_name,
         u.name  AS unit_name
       FROM service_orders so
       JOIN employees e  ON e.id  = so.assigned_employee_id
       JOIN employees cb ON cb.id = so.created_by_id
       JOIN units u      ON u.id  = so.unit_id
       WHERE so.id = $1`,
      [id]
    );

    const service = result.rows[0];
    if (!service) return res.status(404).json({ error: 'Serviço não encontrado.' });

    // Funcionário só pode ver os seus
    if (req.user.role === 'employee' && service.assigned_employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    // Fotos
    const photos = await db.query(
      `SELECT id, phase, photo_path, created_at FROM service_photos WHERE service_order_id = $1 ORDER BY created_at`,
      [id]
    );

    res.json({ ...service, photos: photos.rows });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// PATCH /api/services/:id/status
// Funcionário atualiza status
// ----------------------------------------------------------------
async function updateStatus(req, res, next) {
  try {
    const id     = parseInt(req.params.id, 10);
    const { status, problem_description } = req.body;

    const current = await db.query(
      `SELECT assigned_employee_id, status, title, created_by_id FROM service_orders WHERE id = $1`,
      [id]
    );
    if (!current.rows[0]) return res.status(404).json({ error: 'Serviço não encontrado.' });

    if (req.user.role === 'employee' && current.rows[0].assigned_employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    const result = await db.query(
      `UPDATE service_orders
       SET status = $1, problem_description = COALESCE($2, problem_description), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, problem_description?.trim() || null, id]
    );

    // Notifica admin/gestor se houve problema
    if (status === 'problem') {
      await push.notify(
        current.rows[0].created_by_id,
        'Problema reportado em serviço',
        `O funcionário reportou um problema no serviço "${current.rows[0].title}": ${problem_description || 'sem descrição'}.`,
        'service_problem'
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// POST /api/services/:id/photos
// Funcionário envia foto (before | after)
// ----------------------------------------------------------------
async function addPhoto(req, res, next) {
  try {
    const id    = parseInt(req.params.id, 10);
    const phase = req.body.phase;
    const file  = req.file;

    if (!file) return res.status(400).json({ error: 'Foto obrigatória.' });
    if (!['before', 'after'].includes(phase)) {
      return res.status(400).json({ error: 'Fase inválida. Use before ou after.' });
    }

    const current = await db.query(
      `SELECT assigned_employee_id FROM service_orders WHERE id = $1`, [id]
    );
    if (!current.rows[0]) return res.status(404).json({ error: 'Serviço não encontrado.' });
    if (req.user.role === 'employee' && current.rows[0].assigned_employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    const dateStr  = new Date().toISOString().split('T')[0];
    const filename = `services/${id}/${phase}_${req.user.id}_${Date.now()}.jpg`;
    await storage.save(file.buffer, filename);

    const photo = await db.query(
      `INSERT INTO service_photos (service_order_id, phase, photo_path)
       VALUES ($1, $2, $3) RETURNING id, phase, photo_path, created_at`,
      [id, phase, filename]
    );

    res.status(201).json(photo.rows[0]);
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// GET /api/services/:id/photos/:photoId
// Serve foto autenticada
// ----------------------------------------------------------------
async function getPhoto(req, res, next) {
  try {
    const { id, photoId } = req.params;

    const result = await db.query(
      `SELECT sp.photo_path, so.assigned_employee_id
       FROM service_photos sp
       JOIN service_orders so ON so.id = sp.service_order_id
       WHERE sp.id = $1 AND sp.service_order_id = $2`,
      [photoId, id]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Foto não encontrada.' });
    if (req.user.role === 'employee' && result.rows[0].assigned_employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    const buffer = await storage.getBuffer(result.rows[0].photo_path);
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, getOne, updateStatus, addPhoto, getPhoto };
