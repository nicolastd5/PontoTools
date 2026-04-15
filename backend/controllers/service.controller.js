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
         so.started_at, so.finished_at,
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

    const service = result.rows[0];
    if (!service) return res.status(404).json({ error: 'Serviço não encontrado.' });

    // Funcionário só pode ver os seus
    if (req.user.role === 'employee' && service.assigned_employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    // Gestor só pode ver serviços do próprio contrato
    if (req.user.role === 'gestor' && service.contract_id !== req.user.contractId) {
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
    const { status, problem_description, issue_description } = req.body;

    const current = await db.query(
      `SELECT so.assigned_employee_id, so.status, so.title, so.created_by_id, u.contract_id
       FROM service_orders so
       JOIN units u ON u.id = so.unit_id
       WHERE so.id = $1`,
      [id]
    );
    if (!current.rows[0]) return res.status(404).json({ error: 'Serviço não encontrado.' });

    if (req.user.role === 'employee' && current.rows[0].assigned_employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    if (req.user.role === 'gestor' && current.rows[0].contract_id !== req.user.contractId) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    // Determina quais timestamps atualizar conforme a transição de status
    const tsExtra =
      status === 'in_progress'                          ? ', started_at  = COALESCE(started_at,  NOW())' :
      ['done', 'done_with_issues', 'problem'].includes(status) ? ', finished_at = COALESCE(finished_at, NOW())' :
      '';

    const result = await db.query(
      `UPDATE service_orders
       SET status = $1,
           problem_description = COALESCE($2, problem_description),
           issue_description   = COALESCE($3, issue_description),
           updated_at = NOW()
           ${tsExtra}
       WHERE id = $4
       RETURNING *`,
      [status, problem_description?.trim() || null, issue_description?.trim() || null, id]
    );

    // Notifica admin/gestor se houve problema ou ressalvas
    if (status === 'problem') {
      await push.notify(
        current.rows[0].created_by_id,
        'Problema reportado em serviço',
        `O funcionário reportou um problema no serviço "${current.rows[0].title}": ${problem_description || 'sem descrição'}.`,
        'service_problem'
      );
    } else if (status === 'done_with_issues') {
      await push.notify(
        current.rows[0].created_by_id,
        'Serviço concluído com ressalvas',
        `O serviço "${current.rows[0].title}" foi concluído com ressalvas: ${issue_description || 'sem descrição'}.`,
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
      `SELECT so.assigned_employee_id, so.status, u.contract_id
       FROM service_orders so
       JOIN units u ON u.id = so.unit_id
       WHERE so.id = $1`,
      [id]
    );
    if (!current.rows[0]) return res.status(404).json({ error: 'Serviço não encontrado.' });
    if (req.user.role === 'employee' && current.rows[0].assigned_employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    if (req.user.role === 'gestor' && current.rows[0].contract_id !== req.user.contractId) {
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

    // Foto "antes" → muda para in_progress (se ainda pendente) e marca started_at
    // Foto "depois" → muda para done (se in_progress) e marca finished_at
    const svc = current.rows[0];
    if (phase === 'before' && svc.status === 'pending') {
      await db.query(
        `UPDATE service_orders
         SET status = 'in_progress', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
         WHERE id = $1`,
        [id]
      );
    } else if (phase === 'after' && svc.status === 'in_progress') {
      await db.query(
        `UPDATE service_orders
         SET status = 'done', finished_at = COALESCE(finished_at, NOW()), updated_at = NOW()
         WHERE id = $1`,
        [id]
      );
    }

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
      `SELECT sp.photo_path, so.assigned_employee_id, u.contract_id
       FROM service_photos sp
       JOIN service_orders so ON so.id = sp.service_order_id
       JOIN units u ON u.id = so.unit_id
       WHERE sp.id = $1 AND sp.service_order_id = $2`,
      [photoId, id]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Foto não encontrada.' });
    if (req.user.role === 'employee' && result.rows[0].assigned_employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    if (req.user.role === 'gestor' && result.rows[0].contract_id !== req.user.contractId) {
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

// ----------------------------------------------------------------
// DELETE /api/services/:id/photos/:photoId
// Admin/gestor deleta foto de serviço (arquivo + registro)
// ----------------------------------------------------------------
async function deletePhoto(req, res, next) {
  try {
    const { id, photoId } = req.params;

    const result = await db.query(
      `SELECT sp.photo_path, u.contract_id FROM service_photos sp
       JOIN service_orders so ON so.id = sp.service_order_id
       JOIN units u ON u.id = so.unit_id
       WHERE sp.id = $1 AND sp.service_order_id = $2`,
      [photoId, id]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Foto não encontrada.' });
    if (req.user.role === 'gestor' && result.rows[0].contract_id !== req.user.contractId) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    const { photo_path } = result.rows[0];

    // Remove arquivo do storage
    await storage.delete(photo_path);

    // Remove registro do banco
    await db.query(`DELETE FROM service_photos WHERE id = $1`, [photoId]);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// PATCH /api/services/:id/reschedule
// Admin/gestor reagenda data e horário do serviço
// ----------------------------------------------------------------
async function reschedule(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const { scheduled_date, due_time } = req.body;

    const current = await db.query(
      `SELECT so.assigned_employee_id, so.title, u.contract_id
       FROM service_orders so
       JOIN units u ON u.id = so.unit_id
       WHERE so.id = $1`,
      [id]
    );
    if (!current.rows[0]) return res.status(404).json({ error: 'Serviço não encontrado.' });
    if (req.user.role === 'gestor' && current.rows[0].contract_id !== req.user.contractId) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    const result = await db.query(
      `UPDATE service_orders
       SET scheduled_date = $1, due_time = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [scheduled_date, due_time || null, id]
    );

    // Notifica o funcionário sobre o reagendamento
    await push.notify(
      current.rows[0].assigned_employee_id,
      'Serviço reagendado',
      `O serviço "${current.rows[0].title}" foi reagendado para ${new Date(scheduled_date).toLocaleDateString('pt-BR')}.`,
      'service_assigned'
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// DELETE /api/services/:id
// Admin/gestor deleta serviço (fotos + registro)
// ----------------------------------------------------------------
async function deleteService(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);

    const current = await db.query(
      `SELECT so.id, u.contract_id FROM service_orders so
       JOIN units u ON u.id = so.unit_id
       WHERE so.id = $1`,
      [id]
    );
    if (!current.rows[0]) return res.status(404).json({ error: 'Serviço não encontrado.' });
    if (req.user.role === 'gestor' && current.rows[0].contract_id !== req.user.contractId) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    // Remove arquivos de foto do storage
    const photos = await db.query(
      `SELECT photo_path FROM service_photos WHERE service_order_id = $1`,
      [id]
    );
    await Promise.allSettled(photos.rows.map((p) => storage.delete(p.photo_path)));

    // Deleta o serviço (cascade remove service_photos)
    await db.query(`DELETE FROM service_orders WHERE id = $1`, [id]);

    logger.info('Serviço deletado', { serviceId: id, deletedBy: req.user.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, getOne, updateStatus, addPhoto, getPhoto, deletePhoto, reschedule, deleteService };
