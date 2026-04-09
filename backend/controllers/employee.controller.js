// Controller de funcionários (CRUD + importação)
const bcrypt = require('bcrypt');
const XLSX   = require('xlsx');
const db     = require('../config/database');
const logger = require('../utils/logger');

// ----------------------------------------------------------------
// GET /api/employees
// ----------------------------------------------------------------
async function list(req, res, next) {
  try {
    const { unitId, active, search, page = 1, limit = 50 } = req.query;
    const offset  = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const params  = [];
    const filters = ['e.role = \'employee\''];

    if (unitId) {
      params.push(parseInt(unitId, 10));
      filters.push(`e.unit_id = $${params.length}`);
    }
    if (active !== undefined) {
      params.push(active === 'true');
      filters.push(`e.active = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      filters.push(`(e.full_name ILIKE $${params.length} OR e.badge_number ILIKE $${params.length} OR e.email ILIKE $${params.length})`);
    }

    const whereClause = `WHERE ${filters.join(' AND ')}`;
    const dataParams  = [...params, parseInt(limit, 10), offset];

    const result = await db.query(
      `SELECT e.id, e.badge_number, e.full_name, e.email, e.active, e.created_at,
              u.name AS unit_name, u.code AS unit_code
       FROM employees e
       JOIN units u ON u.id = e.unit_id
       ${whereClause}
       ORDER BY u.name, e.full_name
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    const countResult = await db.query(
      `SELECT COUNT(*) AS total FROM employees e ${whereClause}`,
      params
    );

    res.json({
      employees: result.rows,
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
// POST /api/employees
// ----------------------------------------------------------------
async function create(req, res, next) {
  try {
    const { unit_id, badge_number, full_name, email, password } = req.body;

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await db.query(
      `INSERT INTO employees (unit_id, badge_number, full_name, email, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, badge_number, full_name, email, active, created_at`,
      [unit_id, badge_number.trim(), full_name.trim(), email.toLowerCase().trim(), passwordHash]
    );

    logger.info('Funcionário criado', { badgeNumber: badge_number });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// GET /api/employees/:id
// ----------------------------------------------------------------
async function getById(req, res, next) {
  try {
    const result = await db.query(
      `SELECT e.id, e.badge_number, e.full_name, e.email, e.active, e.created_at, e.updated_at,
              e.unit_id, u.name AS unit_name, u.code AS unit_code
       FROM employees e
       JOIN units u ON u.id = e.unit_id
       WHERE e.id = $1`,
      [parseInt(req.params.id, 10)]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Funcionário não encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// PUT /api/employees/:id
// ----------------------------------------------------------------
async function update(req, res, next) {
  try {
    const { unit_id, badge_number, full_name, email, password } = req.body;
    const id = parseInt(req.params.id, 10);

    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 12);
    }

    const result = await db.query(
      `UPDATE employees SET
         unit_id      = COALESCE($1, unit_id),
         badge_number = COALESCE($2, badge_number),
         full_name    = COALESCE($3, full_name),
         email        = COALESCE($4, email),
         password_hash = COALESCE($5, password_hash)
       WHERE id = $6
       RETURNING id, badge_number, full_name, email, active`,
      [unit_id, badge_number, full_name, email ? email.toLowerCase() : null, passwordHash, id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Funcionário não encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// PATCH /api/employees/:id/active
// ----------------------------------------------------------------
async function toggleActive(req, res, next) {
  try {
    const { active } = req.body;
    const id = parseInt(req.params.id, 10);

    const result = await db.query(
      `UPDATE employees SET active = $1 WHERE id = $2
       RETURNING id, full_name, active`,
      [Boolean(active), id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Funcionário não encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// POST /api/employees/import
// Importação em massa via XLSX/CSV
// ----------------------------------------------------------------
async function importEmployees(req, res, next) {
  const client = await db.connect();
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo não enviado.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const rows     = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Planilha vazia ou sem dados.' });
    }

    const errors   = [];
    let imported   = 0;
    let updated    = 0;

    await client.query('BEGIN');

    for (let i = 0; i < rows.length; i++) {
      const row    = rows[i];
      const rowNum = i + 2; // linha 1 é cabeçalho

      // Valida campos obrigatórios
      const { matricula, nome_completo, email, senha_provisoria, unidade_codigo } = row;

      if (!matricula || !nome_completo || !email || !senha_provisoria || !unidade_codigo) {
        errors.push({ linha: rowNum, erro: 'Campos obrigatórios faltando.' });
        continue;
      }

      // Busca unidade pelo código
      const unitResult = await client.query(
        `SELECT id FROM units WHERE code = $1`,
        [String(unidade_codigo).trim()]
      );

      if (!unitResult.rows[0]) {
        errors.push({ linha: rowNum, erro: `Código de unidade inválido: ${unidade_codigo}` });
        continue;
      }

      const passwordHash = await bcrypt.hash(String(senha_provisoria), 12);

      const upsertResult = await client.query(
        `INSERT INTO employees (unit_id, badge_number, full_name, email, password_hash)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (badge_number) DO UPDATE SET
           unit_id      = EXCLUDED.unit_id,
           full_name    = EXCLUDED.full_name,
           email        = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash
         RETURNING (xmax = 0) AS inserted`,
        [
          unitResult.rows[0].id,
          String(matricula).trim(),
          String(nome_completo).trim(),
          String(email).toLowerCase().trim(),
          passwordHash,
        ]
      );

      if (upsertResult.rows[0].inserted) {
        imported++;
      } else {
        updated++;
      }
    }

    await client.query('COMMIT');

    logger.info('Importação de funcionários concluída', { imported, updated, errors: errors.length });

    res.json({
      message:  `Importação concluída: ${imported} criados, ${updated} atualizados.`,
      imported,
      updated,
      errors,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

// ----------------------------------------------------------------
// GET /api/employees/template
// Download do template XLSX de importação
// ----------------------------------------------------------------
async function downloadTemplate(req, res, next) {
  try {
    const workbook = XLSX.utils.book_new();
    const data = [
      // Cabeçalho
      ['matricula', 'nome_completo', 'email', 'senha_provisoria', 'unidade_codigo'],
      // Exemplos
      ['CEF10_001', 'João da Silva', 'joao.silva@cef10.gov.br', 'Senha@2025', 'CEF10'],
      ['CEF11_002', 'Maria Santos',  'maria.santos@cef11.gov.br', 'Senha@2025', 'CEF11'],
    ];

    const sheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Funcionários');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', 'attachment; filename="template_importacao_funcionarios.xlsx"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, getById, update, toggleActive, importEmployees, downloadTemplate };
