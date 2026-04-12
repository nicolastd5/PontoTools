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

    // Gestor só cria unidade no próprio contrato
    const finalContractId = req.user.role === 'gestor'
      ? req.user.contractId
      : (contract_id ? parseInt(contract_id, 10) : null);

    const result = await db.query(
      `INSERT INTO units (name, code, latitude, longitude, radius_meters, address, contract_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name.trim(), code.trim().toUpperCase(), parseFloat(latitude), parseFloat(longitude), parseInt(radius_meters, 10), address || null, finalContractId]
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

    // Gestor só edita unidades do seu contrato (e não pode trocar o contract_id)
    if (req.user.role === 'gestor' && req.user.contractId) {
      const check = await db.query(
        `SELECT id FROM units WHERE id = $1 AND contract_id = $2`,
        [id, req.user.contractId]
      );
      if (!check.rows[0]) {
        return res.status(403).json({ error: 'Sem permissão para esta unidade.' });
      }
    }

    // Gestor não pode alterar contract_id
    const finalContractId = req.user.role === 'gestor'
      ? null  // COALESCE mantém o valor atual
      : (contract_id ? parseInt(contract_id, 10) : null);

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
      [name, latitude ? parseFloat(latitude) : null, longitude ? parseFloat(longitude) : null, radius_meters ? parseInt(radius_meters, 10) : null, address, finalContractId, id]
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

async function getOne(req, res, next) {
  try {
    const params = [parseInt(req.params.id, 10)];
    let scopeFilter = '';

    if (req.user.role === 'gestor' && req.user.contractId) {
      params.push(req.user.contractId);
      scopeFilter = `AND contract_id = $${params.length}`;
    }

    const result = await db.query(
      `SELECT id, name, code, latitude, longitude, radius_meters, address, active
       FROM units WHERE id = $1 ${scopeFilter}`,
      params
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Unidade não encontrada.' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
}

async function destroy(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.query(`DELETE FROM units WHERE id = $1 RETURNING id`, [id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Unidade não encontrada.' });
    logger.info('Posto deletado permanentemente', { unitId: id, by: req.user.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, deactivate, getOne, destroy };
