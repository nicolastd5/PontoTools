const db     = require('../config/database');
const logger = require('../utils/logger');

// GET /api/job-roles
async function list(req, res, next) {
  try {
    const { active } = req.query;
    const params  = [];
    const filters = [];

    if (active !== undefined) {
      params.push(active === 'true');
      filters.push(`active = $${params.length}`);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT id, name, description, has_break, max_photos, active, created_at
       FROM job_roles
       ${where}
       ORDER BY name`,
      params
    );

    res.json({ jobRoles: result.rows });
  } catch (err) {
    next(err);
  }
}

// POST /api/job-roles
async function create(req, res, next) {
  try {
    const { name, description, has_break = true, max_photos = 1 } = req.body;

    const result = await db.query(
      `INSERT INTO job_roles (name, description, has_break, max_photos)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, has_break, max_photos, active, created_at`,
      [name.trim(), description?.trim() || null, Boolean(has_break), Math.max(1, parseInt(max_photos, 10) || 1)]
    );

    logger.info('Cargo criado', { name, has_break });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Já existe um cargo com esse nome.' });
    }
    next(err);
  }
}

// PUT /api/job-roles/:id
async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, description, has_break, max_photos } = req.body;

    const result = await db.query(
      `UPDATE job_roles SET
         name        = COALESCE($1, name),
         description = COALESCE($2, description),
         has_break   = COALESCE($3, has_break),
         max_photos  = COALESCE($4, max_photos)
       WHERE id = $5
       RETURNING id, name, description, has_break, max_photos, active`,
      [
        name?.trim() || null,
        description?.trim() ?? null,
        has_break != null ? Boolean(has_break) : null,
        max_photos != null ? Math.max(1, parseInt(max_photos, 10)) : null,
        id,
      ]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Cargo não encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Já existe um cargo com esse nome.' });
    }
    next(err);
  }
}

// PATCH /api/job-roles/:id/active
async function toggleActive(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const { active } = req.body;

    const result = await db.query(
      `UPDATE job_roles SET active = $1 WHERE id = $2
       RETURNING id, name, active`,
      [active === true || active === 'true', id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Cargo não encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, toggleActive };
