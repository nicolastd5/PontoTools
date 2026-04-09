// Controller de unidades
const db     = require('../config/database');
const logger = require('../utils/logger');

async function list(req, res, next) {
  try {
    // Funcionários só veem sua própria unidade; admins veem todas
    const isAdmin = req.user.role === 'admin';
    const result  = await db.query(
      `SELECT id, name, code, latitude, longitude, radius_meters, address, active
       FROM units
       WHERE active = TRUE ${isAdmin ? '' : 'AND id = $1'}
       ORDER BY name`,
      isAdmin ? [] : [req.user.unitId]
    );
    res.json({ units: result.rows });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, code, latitude, longitude, radius_meters = 100, address, contract_id } = req.body;

    const result = await db.query(
      `INSERT INTO units (name, code, latitude, longitude, radius_meters, address, contract_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name.trim(), code.trim().toUpperCase(), parseFloat(latitude), parseFloat(longitude), parseInt(radius_meters, 10), address || null, contract_id ? parseInt(contract_id, 10) : null]
    );

    logger.info('Posto criado', { code });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { name, latitude, longitude, radius_meters, address, contract_id } = req.body;
    const id = parseInt(req.params.id, 10);

    const result = await db.query(
      `UPDATE units SET
         name          = COALESCE($1, name),
         latitude      = COALESCE($2, latitude),
         longitude     = COALESCE($3, longitude),
         radius_meters = COALESCE($4, radius_meters),
         address       = COALESCE($5, address),
         contract_id   = COALESCE($6, contract_id)
       WHERE id = $7
       RETURNING *`,
      [name, latitude ? parseFloat(latitude) : null, longitude ? parseFloat(longitude) : null, radius_meters ? parseInt(radius_meters, 10) : null, address, contract_id ? parseInt(contract_id, 10) : null, id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Unidade não encontrada.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function deactivate(req, res, next) {
  try {
    await db.query(
      `UPDATE units SET active = FALSE WHERE id = $1`,
      [parseInt(req.params.id, 10)]
    );
    res.json({ message: 'Unidade desativada com sucesso.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, deactivate };
