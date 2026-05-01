const db = require('../config/database');

function parsePositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 && String(parsed) === String(value).trim()
    ? parsed
    : null;
}

function parseFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

    const serviceOrderId = parsePositiveInt(req.body.service_order_id);
    if (!serviceOrderId) {
      return res.status(400).json({ error: 'Servico invalido.' });
    }

    const latitude = parseFiniteNumber(req.body.latitude);
    const longitude = parseFiniteNumber(req.body.longitude);
    if (
      latitude === null ||
      longitude === null ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({ error: 'Coordenadas invalidas.' });
    }

    const hasAccuracy = req.body.accuracy_meters !== null &&
      req.body.accuracy_meters !== undefined &&
      req.body.accuracy_meters !== '';
    const accuracyMeters = hasAccuracy ? parseFiniteNumber(req.body.accuracy_meters) : null;
    if (hasAccuracy && (accuracyMeters === null || accuracyMeters < 0 || accuracyMeters > 10000)) {
      return res.status(400).json({ error: 'Precisao invalida.' });
    }

    const serviceResult = await db.query(
      `SELECT id, unit_id, status
       FROM service_orders
       WHERE id = $1
         AND assigned_employee_id = $2
         AND status IN ('pending', 'in_progress')`,
      [serviceOrderId, req.user.id]
    );
    const service = serviceResult.rows[0];
    if (!service) {
      return res.status(403).json({ error: 'Servico nao elegivel para rastreamento.' });
    }

    const source = req.body.source === 'mobile' ? 'mobile' : 'web';
    const recordedAt = normalizeRecordedAt(req.body.recorded_at);
    const insertResult = await db.query(
      `INSERT INTO service_location_updates
         (employee_id, service_order_id, unit_id, latitude, longitude, accuracy_meters, source, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, NOW()))
       RETURNING *`,
      [
        req.user.id,
        service.id,
        service.unit_id,
        latitude,
        longitude,
        accuracyMeters,
        source,
        recordedAt,
      ]
    );

    res.status(201).json(insertResult.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function listLive(req, res, next) {
  try {
    const params = [];
    const filters = [
      "so.status IN ('pending', 'in_progress')",
      'so.assigned_employee_id IS NOT NULL',
    ];

    if (req.user.role === 'gestor') {
      params.push(req.user.contractId);
      filters.push(`u.contract_id = $${params.length}`);
    }

    const unitId = parsePositiveInt(req.query.unitId);
    if (unitId) {
      params.push(unitId);
      filters.push(`so.unit_id = $${params.length}`);
    }

    if (['pending', 'in_progress'].includes(req.query.status)) {
      params.push(req.query.status);
      filters.push(`so.status = $${params.length}`);
    }

    const result = await db.query(
      `WITH ranked_services AS (
         SELECT
           so.id AS service_order_id,
           so.title,
           so.status,
           so.unit_id,
           so.assigned_employee_id,
           e.full_name AS employee_name,
           u.name AS unit_name,
           u.code AS unit_code,
           u.contract_id,
           ROW_NUMBER() OVER (
             PARTITION BY so.assigned_employee_id
             ORDER BY
               CASE so.status WHEN 'in_progress' THEN 0 ELSE 1 END,
               so.scheduled_date ASC NULLS LAST,
               so.due_time ASC NULLS LAST,
               so.created_at DESC,
               so.id ASC
           ) AS employee_service_rank
         FROM service_orders so
         JOIN units u ON u.id = so.unit_id
         LEFT JOIN employees e ON e.id = so.assigned_employee_id
         WHERE ${filters.join(' AND ')}
       ),
       eligible_services AS (
         SELECT *
         FROM ranked_services
         WHERE employee_service_rank = 1
       ),
       latest_locations AS (
         SELECT DISTINCT ON (slu.service_order_id)
           slu.id,
           slu.service_order_id,
           slu.employee_id,
           slu.latitude,
           slu.longitude,
           slu.accuracy_meters,
           slu.source,
           slu.recorded_at,
           slu.created_at,
           EXTRACT(EPOCH FROM (NOW() - slu.created_at)) AS signal_age_seconds
         FROM service_location_updates slu
         JOIN eligible_services es ON es.service_order_id = slu.service_order_id
         ORDER BY slu.service_order_id, slu.created_at DESC
       )
       SELECT
         es.service_order_id,
         es.title AS service_title,
         es.status AS service_status,
         es.unit_id,
         es.assigned_employee_id,
         es.employee_name,
         es.unit_name,
         es.unit_code,
         ll.id AS location_id,
         ll.employee_id,
         ll.latitude,
         ll.longitude,
         ll.accuracy_meters,
         ll.source,
         ll.recorded_at,
         ll.created_at AS last_seen_at,
         ll.signal_age_seconds
       FROM eligible_services es
       LEFT JOIN latest_locations ll ON ll.service_order_id = es.service_order_id
       ORDER BY ll.created_at DESC NULLS LAST, es.service_order_id ASC`,
      params
    );

    const locations = result.rows.map((row) => ({
      ...row,
      signal_age_seconds: row.signal_age_seconds === null || row.signal_age_seconds === undefined
        ? null
        : Number(row.signal_age_seconds),
    }));

    res.json({ locations });
  } catch (err) {
    next(err);
  }
}

module.exports = { postLocation, listLive };
