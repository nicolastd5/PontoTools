// Controller de batida de ponto
const path    = require('path');
const db      = require('../config/database');
const storage = require('../config/storage');
const { validateZone } = require('../services/geoValidation.service');
const logger  = require('../utils/logger');

// ----------------------------------------------------------------
// POST /api/clock
// Recebe multipart/form-data: campos + foto
// ----------------------------------------------------------------
async function registerClock(req, res, next) {
  try {
    const { clock_type, latitude, longitude, accuracy, timezone } = req.body;
    const photoFile = req.file;

    // Busca a unidade do funcionário para validação de zona
    const unitResult = await db.query(
      `SELECT id, latitude, longitude, radius_meters FROM units WHERE id = $1`,
      [req.user.unitId]
    );
    const unit = unitResult.rows[0];

    if (!unit) {
      return res.status(400).json({ error: 'Unidade do funcionário não encontrada.' });
    }

    const { isInside, distanceMeters } = validateZone(
      { latitude, longitude },
      unit
    );

    // Se fora da zona: registra tentativa bloqueada e rejeita
    if (!isInside) {
      await db.query(
        `INSERT INTO blocked_attempts
           (employee_id, unit_id, attempted_at, block_reason, latitude, longitude, distance_meters, timezone, ip_address, device_info)
         VALUES ($1, $2, NOW(), 'outside_zone', $3, $4, $5, $6, $7, $8)`,
        [
          req.user.id,
          unit.id,
          parseFloat(latitude),
          parseFloat(longitude),
          distanceMeters,
          timezone,
          req.ip,
          JSON.stringify({ userAgent: req.headers['user-agent'] }),
        ]
      );

      logger.warn('Batida bloqueada: fora da zona', {
        employeeId: req.user.id,
        distanceMeters,
        unitRadius: unit.radius_meters,
      });

      return res.status(422).json({
        blocked: true,
        reason:  'outside_zone',
        message: `Você está a ${Math.round(distanceMeters)}m da unidade. Máximo permitido: ${unit.radius_meters}m.`,
        distanceMeters,
        radiusMeters: unit.radius_meters,
      });
    }

    // Salva a foto no storage configurado
    const filename = `${unit.id}/${new Date().toISOString().split('T')[0]}/${req.user.id}_${Date.now()}.jpg`;
    await storage.save(photoFile.buffer, filename);

    // Grava o registro de ponto aprovado
    const clockResult = await db.query(
      `INSERT INTO clock_records
         (employee_id, unit_id, clock_type, clocked_at_utc, timezone,
          latitude, longitude, accuracy_meters, distance_meters, is_inside_zone,
          photo_path, device_info, ip_address)
       VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, clocked_at_utc, clock_type, is_inside_zone, distance_meters`,
      [
        req.user.id,
        unit.id,
        clock_type,
        timezone,
        parseFloat(latitude),
        parseFloat(longitude),
        accuracy ? parseFloat(accuracy) : null,
        distanceMeters,
        isInside,
        filename,
        JSON.stringify({ userAgent: req.headers['user-agent'] }),
        req.ip,
      ]
    );

    const record = clockResult.rows[0];

    logger.info('Ponto registrado', {
      employeeId:  req.user.id,
      clockType:   clock_type,
      recordId:    record.id,
      distanceMeters,
    });

    res.status(201).json({
      id:            record.id,
      clockType:     record.clock_type,
      clockedAtUtc:  record.clocked_at_utc,
      isInsideZone:  record.is_inside_zone,
      distanceMeters: record.distance_meters,
      message:       'Ponto registrado com sucesso.',
    });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// GET /api/clock/history
// Histórico do funcionário autenticado (paginado, com filtro de data)
// ----------------------------------------------------------------
async function getHistory(req, res, next) {
  try {
    const { page = 1, limit = 20, startDate, endDate } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const params = [req.user.id, parseInt(limit, 10), offset];
    let dateFilter = '';

    if (startDate) {
      params.push(startDate);
      dateFilter += ` AND cr.clocked_at_utc::date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      dateFilter += ` AND cr.clocked_at_utc::date <= $${params.length}`;
    }

    const result = await db.query(
      `SELECT
         cr.id, cr.clock_type, cr.clocked_at_utc, cr.timezone,
         cr.latitude, cr.longitude, cr.distance_meters, cr.accuracy_meters,
         cr.is_inside_zone, cr.photo_path,
         u.name AS unit_name
       FROM clock_records cr
       JOIN units u ON u.id = cr.unit_id
       WHERE cr.employee_id = $1 ${dateFilter}
       ORDER BY cr.clocked_at_utc DESC
       LIMIT $2 OFFSET $3`,
      params
    );

    // Total para paginação
    const countResult = await db.query(
      `SELECT COUNT(*) AS total
       FROM clock_records cr
       WHERE cr.employee_id = $1 ${dateFilter}`,
      [req.user.id, ...params.slice(3)]
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
// GET /api/clock/today
// Registros de hoje do funcionário (para montar estado da UI)
// ----------------------------------------------------------------
async function getToday(req, res, next) {
  try {
    const result = await db.query(
      `SELECT id, clock_type, clocked_at_utc, timezone, is_inside_zone, distance_meters
       FROM clock_records
       WHERE employee_id = $1
         AND clocked_at_utc::date = CURRENT_DATE
       ORDER BY clocked_at_utc ASC`,
      [req.user.id]
    );

    res.json({ records: result.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { registerClock, getHistory, getToday };
