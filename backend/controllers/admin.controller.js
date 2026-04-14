// Controller do portal administrativo
const db             = require('../config/database');
const storage        = require('../config/storage');
const dashboardSvc   = require('../services/dashboard.service');
const logger         = require('../utils/logger');

// ----------------------------------------------------------------
// GET /api/admin/dashboard
// Stats gerais do dia
// ----------------------------------------------------------------
async function getDashboard(req, res, next) {
  try {
    const unitId = req.query.unitId ? parseInt(req.query.unitId, 10) : null;

    const [summary, recentClocks, clocksByUnit, blockedByReason, services] = await Promise.all([
      dashboardSvc.getDailySummary(unitId),
      dashboardSvc.getRecentClocks(10, unitId),
      dashboardSvc.getClocksByUnit(),
      dashboardSvc.getBlockedByReason(7),
      dashboardSvc.getServicesSummary(),
    ]);

    res.json({ summary, recentClocks, clocksByUnit, blockedByReason, services });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// GET /api/admin/dashboard/absences
// Funcionários sem registro no dia
// ----------------------------------------------------------------
async function getAbsences(req, res, next) {
  try {
    const unitId = req.query.unitId ? parseInt(req.query.unitId, 10) : null;
    const absent = await dashboardSvc.getAbsentEmployees(unitId);
    res.json({ employees: absent });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// GET /api/admin/services/today
// ServiÃ§os do dia (entrada/saÃ­da) para admin e gestor
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

// ----------------------------------------------------------------
// GET /api/admin/clocks
// Todos os registros com filtros e paginação
// ----------------------------------------------------------------
async function getClocks(req, res, next) {
  try {
    const {
      page = 1, limit = 25,
      unitId, employeeId,
      clockType, startDate, endDate,
      insideZoneOnly,
    } = req.query;

    const offset  = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const params  = [];
    const filters = [];

    // Gestor só vê registros do seu contrato
    if (req.user.role === 'gestor' && req.user.contractId) {
      params.push(req.user.contractId);
      filters.push(`u.contract_id = $${params.length}`);
    }

    if (unitId) {
      params.push(parseInt(unitId, 10));
      filters.push(`cr.unit_id = $${params.length}`);
    }
    if (employeeId) {
      params.push(parseInt(employeeId, 10));
      filters.push(`cr.employee_id = $${params.length}`);
    }
    if (clockType) {
      params.push(clockType);
      filters.push(`cr.clock_type = $${params.length}`);
    }
    if (startDate) {
      params.push(startDate);
      filters.push(`cr.clocked_at_utc::date >= $${params.length}`);
    }
    if (endDate) {
      params.push(endDate);
      filters.push(`cr.clocked_at_utc::date <= $${params.length}`);
    }
    if (insideZoneOnly === 'false') {
      filters.push(`cr.is_inside_zone = FALSE`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const dataParams  = [...params, parseInt(limit, 10), offset];
    const countParams = [...params];

    const result = await db.query(
      `SELECT
         cr.id, cr.clock_type, cr.clocked_at_utc, cr.timezone,
         cr.latitude, cr.longitude, cr.distance_meters, cr.accuracy_meters,
         cr.is_inside_zone, cr.photo_path,
         e.full_name AS employee_name, e.badge_number,
         u.name AS unit_name, u.code AS unit_code
       FROM clock_records cr
       JOIN employees e ON e.id = cr.employee_id
       JOIN units     u ON u.id = cr.unit_id
       ${whereClause}
       ORDER BY cr.clocked_at_utc DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    const countResult = await db.query(
      `SELECT COUNT(*) AS total
       FROM clock_records cr
       JOIN employees e ON e.id = cr.employee_id
       JOIN units     u ON u.id = cr.unit_id
       ${whereClause}`,
      countParams
    );

    res.json({
      records: result.rows,
      pagination: {
        page:       parseInt(page, 10),
        limit:      parseInt(limit, 10),
        total:      parseInt(countResult.rows[0].total, 10),
        totalPages: Math.ceil(countResult.rows[0].total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// GET /api/admin/clocks/:id/photo
// Stream autenticado da foto — NUNCA servida estaticamente
// ----------------------------------------------------------------
async function getClockPhoto(req, res, next) {
  try {
    const params = [parseInt(req.params.id, 10)];
    let scopeFilter = '';

    // Gestor só acessa fotos de registros do seu contrato
    if (req.user.role === 'gestor' && req.user.contractId) {
      params.push(req.user.contractId);
      scopeFilter = `AND u.contract_id = $${params.length}`;
    }

    const result = await db.query(
      `SELECT cr.photo_path
       FROM clock_records cr
       JOIN units u ON u.id = cr.unit_id
       ${scopeFilter ? 'WHERE cr.id = $1 ' + scopeFilter : 'WHERE cr.id = $1'}`,
      params
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Registro não encontrado.' });
    }

    const { photo_path } = result.rows[0];

    // Placeholder: retorna imagem 1px transparente
    if (photo_path.startsWith('placeholder/')) {
      const placeholder = Buffer.from(
        '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=',
        'base64'
      );
      res.set('Content-Type', 'image/jpeg');
      res.set('Cache-Control', 'private, max-age=3600');
      res.set('X-Photo-Placeholder', 'true');
      return res.send(placeholder);
    }

    const buffer = await storage.getBuffer(photo_path);

    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// DELETE /api/admin/clocks/:id/photo
// Deleta foto principal do registro (arquivo + substitui por placeholder)
// ----------------------------------------------------------------
async function deleteClockPhoto(req, res, next) {
  try {
    const recordId = parseInt(req.params.id, 10);
    const params   = [recordId];
    let scopeFilter = '';

    if (req.user.role === 'gestor' && req.user.contractId) {
      params.push(req.user.contractId);
      scopeFilter = `AND u.contract_id = $${params.length}`;
    }

    const result = await db.query(
      `SELECT cr.photo_path FROM clock_records cr
       JOIN units u ON u.id = cr.unit_id
       WHERE cr.id = $1 ${scopeFilter}`,
      params
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Registro não encontrado.' });

    const { photo_path } = result.rows[0];

    // Não deleta se já é placeholder
    if (!photo_path.startsWith('placeholder/')) {
      await storage.delete(photo_path);
    }

    // Substitui por placeholder no banco
    await db.query(
      `UPDATE clock_records SET photo_path = 'placeholder/deleted.jpg' WHERE id = $1`,
      [recordId]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// DELETE /api/admin/clocks/:id/photos/:photoId
// Deleta foto extra (clock_photos)
// ----------------------------------------------------------------
async function deleteClockExtraPhoto(req, res, next) {
  try {
    const recordId = parseInt(req.params.id, 10);
    const photoId  = parseInt(req.params.photoId, 10);
    const params   = [recordId];
    let scopeFilter = '';

    if (req.user.role === 'gestor' && req.user.contractId) {
      params.push(req.user.contractId);
      scopeFilter = `AND u.contract_id = $${params.length}`;
    }

    // Verifica acesso ao registro
    const check = await db.query(
      `SELECT cr.id FROM clock_records cr JOIN units u ON u.id = cr.unit_id
       WHERE cr.id = $1 ${scopeFilter}`,
      params
    );
    if (!check.rows[0]) return res.status(404).json({ error: 'Registro não encontrado.' });

    const photo = await db.query(
      `SELECT photo_path FROM clock_photos WHERE id = $1 AND clock_record_id = $2`,
      [photoId, recordId]
    );
    if (!photo.rows[0]) return res.status(404).json({ error: 'Foto não encontrada.' });

    await storage.delete(photo.rows[0].photo_path);
    await db.query(`DELETE FROM clock_photos WHERE id = $1`, [photoId]);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// GET /api/admin/blocked
// Tentativas bloqueadas com filtros
// ----------------------------------------------------------------
async function getBlocked(req, res, next) {
  try {
    const { page = 1, limit = 25, unitId, employeeId, reason, startDate, endDate } = req.query;
    const offset  = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const params  = [];
    const filters = [];

    if (unitId) {
      params.push(parseInt(unitId, 10));
      filters.push(`ba.unit_id = $${params.length}`);
    }
    if (employeeId) {
      params.push(parseInt(employeeId, 10));
      filters.push(`ba.employee_id = $${params.length}`);
    }
    if (reason) {
      params.push(reason);
      filters.push(`ba.block_reason = $${params.length}`);
    }
    if (startDate) {
      params.push(startDate);
      filters.push(`ba.attempted_at::date >= $${params.length}`);
    }
    if (endDate) {
      params.push(endDate);
      filters.push(`ba.attempted_at::date <= $${params.length}`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const dataParams  = [...params, parseInt(limit, 10), offset];

    const result = await db.query(
      `SELECT
         ba.id, ba.attempted_at, ba.block_reason,
         ba.latitude, ba.longitude, ba.distance_meters, ba.timezone,
         ba.ip_address, ba.device_info,
         e.full_name AS employee_name, e.badge_number,
         u.name AS unit_name, u.code AS unit_code
       FROM blocked_attempts ba
       LEFT JOIN employees e ON e.id = ba.employee_id
       LEFT JOIN units     u ON u.id = ba.unit_id
       ${whereClause}
       ORDER BY ba.attempted_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    const countResult = await db.query(
      `SELECT COUNT(*) AS total
       FROM blocked_attempts ba
       LEFT JOIN employees e ON e.id = ba.employee_id
       LEFT JOIN units     u ON u.id = ba.unit_id
       ${whereClause}`,
      params
    );

    res.json({
      records: result.rows,
      pagination: {
        page:       parseInt(page, 10),
        limit:      parseInt(limit, 10),
        total:      parseInt(countResult.rows[0].total, 10),
        totalPages: Math.ceil(countResult.rows[0].total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// GET /api/admin/audit-logs
// ----------------------------------------------------------------
async function getAuditLogs(req, res, next) {
  try {
    const { page = 1, limit = 25 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const result = await db.query(
      `SELECT
         al.id, al.action, al.target_type, al.target_id,
         al.new_value, al.ip_address, al.performed_at,
         e.full_name AS admin_name, e.email AS admin_email
       FROM audit_logs al
       JOIN employees e ON e.id = al.admin_id
       ORDER BY al.performed_at DESC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit, 10), offset]
    );

    res.json({ logs: result.rows });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// GET /api/admin/clocks/:id/photos
// Lista fotos extras (clock_photos) de um registro
// ----------------------------------------------------------------
async function getClockPhotos(req, res, next) {
  try {
    const recordId = parseInt(req.params.id, 10);
    const params   = [recordId];
    let scopeFilter = '';

    if (req.user.role === 'gestor' && req.user.contractId) {
      params.push(req.user.contractId);
      scopeFilter = `AND u.contract_id = $${params.length}`;
    }

    // Verify access
    const check = await db.query(
      `SELECT cr.id FROM clock_records cr
       JOIN units u ON u.id = cr.unit_id
       WHERE cr.id = $1 ${scopeFilter}`,
      params
    );
    if (!check.rows[0]) return res.status(404).json({ error: 'Registro não encontrado.' });

    const result = await db.query(
      `SELECT id, photo_path, created_at FROM clock_photos WHERE clock_record_id = $1 ORDER BY id`,
      [recordId]
    );

    res.json({ photos: result.rows });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// GET /api/admin/clocks/:id/photos/:photoId
// Serve uma foto extra autenticada
// ----------------------------------------------------------------
async function getClockExtraPhoto(req, res, next) {
  try {
    const recordId = parseInt(req.params.id, 10);
    const photoId  = parseInt(req.params.photoId, 10);
    const params   = [recordId];
    let scopeFilter = '';

    if (req.user.role === 'gestor' && req.user.contractId) {
      params.push(req.user.contractId);
      scopeFilter = `AND u.contract_id = $${params.length}`;
    }

    // Verify access to record
    const check = await db.query(
      `SELECT cr.id FROM clock_records cr
       JOIN units u ON u.id = cr.unit_id
       WHERE cr.id = $1 ${scopeFilter}`,
      params
    );
    if (!check.rows[0]) return res.status(404).json({ error: 'Registro não encontrado.' });

    const result = await db.query(
      `SELECT photo_path FROM clock_photos WHERE id = $1 AND clock_record_id = $2`,
      [photoId, recordId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Foto não encontrada.' });

    const buffer = await storage.getBuffer(result.rows[0].photo_path);
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// DELETE /api/admin/clocks/:id
// Apaga registro de ponto completo (fotos físicas + clock_photos + clock_records)
// ----------------------------------------------------------------
async function deleteClockRecord(req, res, next) {
  try {
    const recordId = parseInt(req.params.id, 10);
    const params   = [recordId];
    let scopeFilter = '';

    if (req.user.role === 'gestor' && req.user.contractId) {
      params.push(req.user.contractId);
      scopeFilter = `AND u.contract_id = $${params.length}`;
    }

    const result = await db.query(
      `SELECT cr.photo_path FROM clock_records cr
       JOIN units u ON u.id = cr.unit_id
       WHERE cr.id = $1 ${scopeFilter}`,
      params
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Registro não encontrado.' });

    const { photo_path } = result.rows[0];

    // Apaga fotos extras físicas
    const extras = await db.query(
      `SELECT photo_path FROM clock_photos WHERE clock_record_id = $1`, [recordId]
    );
    await Promise.all(extras.rows.map((r) => storage.delete(r.photo_path)));

    // Apaga foto principal física (se não for placeholder)
    if (photo_path && !photo_path.startsWith('placeholder/')) {
      await storage.delete(photo_path);
    }

    // Apaga o registro (clock_photos cascateia via ON DELETE CASCADE)
    await db.query(`DELETE FROM clock_records WHERE id = $1`, [recordId]);

    logger.info('Registro de ponto deletado', { recordId, by: req.user.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { getDashboard, getAbsences, getTodayServices, getClocks, getClockPhoto, getClockPhotos, getClockExtraPhoto, deleteClockPhoto, deleteClockExtraPhoto, deleteClockRecord, getBlocked, getAuditLogs };
