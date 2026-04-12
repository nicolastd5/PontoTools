// Controller de batida de ponto
const path    = require('path');
const db      = require('../config/database');
const storage = require('../config/storage');
const { validateZone } = require('../services/geoValidation.service');
const logger  = require('../utils/logger');

// ----------------------------------------------------------------
// POST /api/clock
// Recebe multipart/form-data: campos + foto(s)
// ----------------------------------------------------------------
async function registerClock(req, res, next) {
  try {
    const { clock_type, latitude, longitude, accuracy, timezone, observation } = req.body;
    const photoFiles = req.files || (req.file ? [req.file] : []);

    // Busca a unidade e cargo do funcionário autenticado (filtra pelo employee específico)
    const unitResult = await db.query(
      `SELECT u.id, u.latitude, u.longitude, u.radius_meters,
              jr.max_photos, COALESCE(jr.require_location, TRUE) AS require_location
       FROM units u
       JOIN employees e ON e.unit_id = u.id AND e.id = $2
       LEFT JOIN job_roles jr ON jr.id = e.job_role_id
       WHERE u.id = $1`,
      [req.user.unitId, req.user.id]
    );
    const unit = unitResult.rows[0];

    if (!unit) {
      return res.status(400).json({ error: 'Unidade do funcionário não encontrada.' });
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const hasValidCoords = !isNaN(lat) && !isNaN(lon) && !(lat === 0 && lon === 0);

    const { isInside, distanceMeters } = hasValidCoords
      ? validateZone({ latitude: lat, longitude: lon }, unit)
      : { isInside: false, distanceMeters: null };

    // Se fora da zona e o cargo exige localização: bloqueia e registra tentativa
    if (!isInside && unit.require_location) {
      await db.query(
        `INSERT INTO blocked_attempts
           (employee_id, unit_id, attempted_at, block_reason, latitude, longitude, distance_meters, timezone, ip_address, device_info)
         VALUES ($1, $2, NOW(), 'outside_zone', $3, $4, $5, $6, $7, $8)`,
        [
          req.user.id,
          unit.id,
          hasValidCoords ? lat : null,
          hasValidCoords ? lon : null,
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

    // Salva a primeira foto (obrigatória)
    const firstPhoto = photoFiles[0];
    if (!firstPhoto) {
      return res.status(400).json({ error: 'Foto obrigatória.' });
    }
    const dateStr  = new Date().toISOString().split('T')[0];
    const filename = `${unit.id}/${dateStr}/${req.user.id}_${Date.now()}.jpg`;
    await storage.save(firstPhoto.buffer, filename);

    // Grava o registro de ponto
    const clockResult = await db.query(
      `INSERT INTO clock_records
         (employee_id, unit_id, clock_type, clocked_at_utc, timezone,
          latitude, longitude, accuracy_meters, distance_meters, is_inside_zone,
          photo_path, observation, device_info, ip_address)
       VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, clocked_at_utc, clock_type, is_inside_zone, distance_meters`,
      [
        req.user.id,
        unit.id,
        clock_type,
        timezone,
        hasValidCoords ? lat : null,
        hasValidCoords ? lon : null,
        accuracy ? parseFloat(accuracy) : null,
        distanceMeters,
        isInside,
        filename,
        observation?.trim() || null,
        JSON.stringify({ userAgent: req.headers['user-agent'] }),
        req.ip,
      ]
    );

    const record = clockResult.rows[0];

    // Salva fotos extras (se houver e o cargo permitir)
    const maxPhotos = unit.max_photos || 1;
    if (photoFiles.length > 1 && maxPhotos > 1) {
      for (let i = 1; i < Math.min(photoFiles.length, maxPhotos); i++) {
        const extraFilename = `${unit.id}/${dateStr}/${req.user.id}_${Date.now()}_${i}.jpg`;
        await storage.save(photoFiles[i].buffer, extraFilename);
        await db.query(
          `INSERT INTO clock_photos (clock_record_id, photo_path, photo_index) VALUES ($1, $2, $3)`,
          [record.id, extraFilename, i + 1]
        );
      }
    }

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
// ----------------------------------------------------------------
async function getHistory(req, res, next) {
  try {
    const { startDate, endDate } = req.query;
    const page   = parseInt(req.query.page, 10) || 1;
    const limit  = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const params = [req.user.id, limit, offset];
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
         cr.is_inside_zone, cr.photo_path, cr.observation,
         u.name AS unit_name
       FROM clock_records cr
       JOIN units u ON u.id = cr.unit_id
       WHERE cr.employee_id = $1 ${dateFilter}
       ORDER BY cr.clocked_at_utc DESC
       LIMIT $2 OFFSET $3`,
      params
    );

    const countResult = await db.query(
      `SELECT COUNT(*) AS total
       FROM clock_records cr
       WHERE cr.employee_id = $1 ${dateFilter}`,
      [req.user.id, ...params.slice(3)]
    );

    const total = parseInt(countResult.rows[0].total, 10);
    res.json({
      records: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// GET /api/clock/today
// Registros de hoje + estado dos botões
// ----------------------------------------------------------------
async function getToday(req, res, next) {
  try {
    const tz = req.query.timezone || 'America/Sao_Paulo';

    const result = await db.query(
      `SELECT id, clock_type, clocked_at_utc, timezone, is_inside_zone, distance_meters
       FROM clock_records
       WHERE employee_id = $1
         AND (clocked_at_utc AT TIME ZONE $2)::date = (NOW() AT TIME ZONE $2)::date
       ORDER BY clocked_at_utc ASC`,
      [req.user.id, tz]
    );

    // Busca configurações do cargo do funcionário
    const jobResult = await db.query(
      `SELECT COALESCE(jr.max_photos, 1)        AS max_photos,
              COALESCE(jr.has_break, TRUE)       AS has_break,
              COALESCE(jr.require_location, TRUE) AS require_location
       FROM employees e
       LEFT JOIN job_roles jr ON jr.id = e.job_role_id
       WHERE e.id = $1`,
      [req.user.id]
    );
    const maxPhotos       = jobResult.rows[0]?.max_photos ?? 1;
    const hasBreak        = jobResult.rows[0]?.has_break ?? true;
    const requireLocation = jobResult.rows[0]?.require_location ?? true;

    const records = result.rows;
    const types = records.map((r) => r.clock_type);
    const lastType = types[types.length - 1] || null;

    const available = {
      entry:       !lastType || lastType === 'exit',
      break_start: hasBreak && (lastType === 'entry' || lastType === 'break_end'),
      break_end:   hasBreak && lastType === 'break_start',
      exit:        hasBreak
        ? (lastType === 'entry' || lastType === 'break_end')
        : lastType === 'entry',
    };

    res.json({ records, available, maxPhotos, requireLocation });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// GET /api/clock/:id/photo
// Funcionário vê a foto do próprio registro de ponto
// ----------------------------------------------------------------
async function getMyClockPhoto(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);

    const result = await db.query(
      `SELECT photo_path FROM clock_records WHERE id = $1 AND employee_id = $2`,
      [id, req.user.id]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Registro não encontrado.' });

    const { photo_path } = result.rows[0];
    const buffer = await storage.getBuffer(photo_path);

    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

module.exports = { registerClock, getHistory, getToday, getMyClockPhoto };
