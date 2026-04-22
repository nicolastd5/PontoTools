const db     = require('../config/database');
const logger = require('../utils/logger');

// GET /api/contracts
// Retorna todos os contratos com seus postos
async function list(req, res, next) {
  try {
    const isGestor = req.user.role === 'gestor';
    const scoped   = isGestor && req.user.contractId;

    const contracts = await db.query(
      `SELECT id, name, code, description, active, created_at
       FROM contracts
       ${scoped ? 'WHERE id = $1' : ''}
       ORDER BY name`,
      scoped ? [req.user.contractId] : []
    );

    const units = await db.query(
      `SELECT id, contract_id, name, code, latitude, longitude, radius_meters, address, active
       FROM units
       ${scoped ? 'WHERE contract_id = $1' : ''}
       ORDER BY name`,
      scoped ? [req.user.contractId] : []
    );

    const result = contracts.rows.map((c) => ({
      ...c,
      units: units.rows.filter((u) => u.contract_id === c.id),
    }));

    // Postos sem contrato (apenas para admin)
    const unassigned = isGestor ? [] : units.rows.filter((u) => !u.contract_id);

    res.json({ contracts: result, unassigned });
  } catch (err) {
    next(err);
  }
}

// POST /api/contracts
async function create(req, res, next) {
  try {
    const { name, code, description } = req.body;

    const result = await db.query(
      `INSERT INTO contracts (name, code, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name.trim(), code.trim().toUpperCase(), description || null]
    );

    logger.info('Contrato criado', { code });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// PUT /api/contracts/:id
async function update(req, res, next) {
  try {
    const { name, code, description, active } = req.body;
    const id = parseInt(req.params.id, 10);

    const result = await db.query(
      `UPDATE contracts SET
         name        = COALESCE($1, name),
         code        = COALESCE($2, code),
         description = COALESCE($3, description),
         active      = COALESCE($4, active)
       WHERE id = $5
       RETURNING *`,
      [name || null, code ? code.toUpperCase() : null, description !== undefined ? description : null, active !== undefined ? active : null, id]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Contrato não encontrado.' });

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/contracts/:id
async function deactivate(req, res, next) {
  try {
    await db.query(`UPDATE contracts SET active = FALSE WHERE id = $1`, [parseInt(req.params.id, 10)]);
    res.json({ message: 'Contrato desativado.' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/contracts/:id/destroy — exclusão permanente
async function destroy(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.query(`DELETE FROM contracts WHERE id = $1 RETURNING id`, [id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Contrato não encontrado.' });
    logger.info('Contrato deletado permanentemente', { contractId: id, by: req.user.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, deactivate, destroy };
