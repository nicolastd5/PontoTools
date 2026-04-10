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

    const [summary, recentClocks, clocksByUnit, blockedByReason] = await Promise.all([
      dashboardSvc.getDailySummary(unitId),
      dashboardSvc.getRecentClocks(10, unitId),
      dashboardSvc.getClocksByUnit(),
      dashboardSvc.getBlockedByReason(7),
    ]);

    res.json({ summary, recentClocks, clocksByUnit, blockedByReason });
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
    const result = await db.query(
      `SELECT photo_path FROM clock_records WHERE id = $1`,
      [parseInt(req.params.id, 10)]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Registro não encontrado.' });
    }

    const { photo_path } = result.rows[0];

    // Placeholder retorna imagem genérica
    if (photo_path.startsWith('placeholder/')) {
      return res.status(200).json({ placeholder: true, message: 'Foto de teste — sem arquivo real.' });
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

module.exports = { getDashboard, getAbsences, getClocks, getClockPhoto, getBlocked, getAuditLogs };
