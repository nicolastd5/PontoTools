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

    // Gestor só vê funcionários do seu contrato
    if (req.user.role === 'gestor' && req.user.contractId) {
      params.push(req.user.contractId);
      filters.push(`u.contract_id = $${params.length}`);
    }

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
              e.unit_id, u.name AS unit_name, u.code AS unit_code,
              e.job_role_id, jr.name AS job_role_name, jr.has_break AS job_role_has_break
       FROM employees e
       JOIN units u ON u.id = e.unit_id
       LEFT JOIN job_roles jr ON jr.id = e.job_role_id
       ${whereClause}
       ORDER BY u.name, e.full_name
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    const countResult = await db.query(
      `SELECT COUNT(*) AS total FROM employees e JOIN units u ON u.id = e.unit_id ${whereClause}`,
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
    const { unit_id, badge_number, full_name, email, password, role, contract_id, job_role_id } = req.body;

    // Apenas admin pode criar gestores
    const finalRole = (role === 'gestor' && req.user?.role === 'admin') ? 'gestor' : 'employee';

    // Gestor criando funcionário: força contract_id do próprio gestor
    const finalContractId = req.user?.role === 'gestor'
      ? req.user.contractId
      : (contract_id ? parseInt(contract_id, 10) : null);

    const finalJobRoleId = job_role_id ? parseInt(job_role_id, 10) : null;

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await db.query(
      `INSERT INTO employees (unit_id, badge_number, full_name, email, password_hash, role, contract_id, job_role_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, badge_number, full_name, email, role, active, created_at`,
      [unit_id, badge_number.trim(), full_name.trim(), email.toLowerCase().trim(), passwordHash, finalRole, finalContractId, finalJobRoleId]
    );

    logger.info('Funcionário/gestor criado', { badgeNumber: badge_number, role: finalRole });
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
    const params = [parseInt(req.params.id, 10)];
    let scopeFilter = '';

    if (req.user.role === 'gestor' && req.user.contractId) {
      params.push(req.user.contractId);
      scopeFilter = `AND u.contract_id = $${params.length}`;
    }

    const result = await db.query(
      `SELECT e.id, e.badge_number, e.full_name, e.email, e.active, e.created_at, e.updated_at,
              e.unit_id, u.name AS unit_name, u.code AS unit_code,
              e.job_role_id, jr.name AS job_role_name, jr.has_break AS job_role_has_break
       FROM employees e
       JOIN units u ON u.id = e.unit_id
       LEFT JOIN job_roles jr ON jr.id = e.job_role_id
       WHERE e.id = $1 ${scopeFilter}`,
      params
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
    const { unit_id, badge_number, full_name, email, password, job_role_id } = req.body;
    const id = parseInt(req.params.id, 10);

    // Gestor só atualiza funcionários do seu contrato
    if (req.user.role === 'gestor' && req.user.contractId) {
      const check = await db.query(
        `SELECT e.id FROM employees e JOIN units u ON u.id = e.unit_id
         WHERE e.id = $1 AND u.contract_id = $2`,
        [id, req.user.contractId]
      );
      if (!check.rows[0]) {
        return res.status(403).json({ error: 'Sem permissão para este funcionário.' });
      }
    }

    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 12);
    }

    const finalJobRoleId = job_role_id !== undefined
      ? (job_role_id ? parseInt(job_role_id, 10) : null)
      : undefined;

    const result = await db.query(
      `UPDATE employees SET
         unit_id       = COALESCE($1, unit_id),
         badge_number  = COALESCE($2, badge_number),
         full_name     = COALESCE($3, full_name),
         email         = COALESCE($4, email),
         password_hash = COALESCE($5, password_hash),
         job_role_id   = CASE WHEN $6::boolean THEN $7::integer ELSE job_role_id END
       WHERE id = $8
       RETURNING id, badge_number, full_name, email, active, job_role_id`,
      [unit_id, badge_number, full_name, email ? email.toLowerCase() : null, passwordHash,
       finalJobRoleId !== undefined, finalJobRoleId ?? null, id]
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

    // Gestor só altera funcionários do seu contrato
    if (req.user.role === 'gestor' && req.user.contractId) {
      const check = await db.query(
        `SELECT e.id FROM employees e JOIN units u ON u.id = e.unit_id
         WHERE e.id = $1 AND u.contract_id = $2`,
        [id, req.user.contractId]
      );
      if (!check.rows[0]) {
        return res.status(403).json({ error: 'Sem permissão para este funcionário.' });
      }
    }

    const result = await db.query(
      `UPDATE employees SET active = $1 WHERE id = $2
       RETURNING id, full_name, active`,
      [active === true || active === 'true', id]
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
      ['CEF10_001', 'João da Silva', 'joao.silva@empresa.com', 'Senha@2025', 'CEF10'],
      ['CEF11_002', 'Maria Santos',  'maria.santos@empresa.com', 'Senha@2025', 'CEF11'],
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

// ----------------------------------------------------------------
// PATCH /api/employees/:id/reset-password  (admin only)
// ----------------------------------------------------------------
async function resetPasswordByAdmin(req, res, next) {
  try {
    const { newPassword } = req.body;
    const id = parseInt(req.params.id, 10);

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres.' });
    }

    const hash = await bcrypt.hash(newPassword, 12);

    const result = await db.query(
      `UPDATE employees SET password_hash = $1 WHERE id = $2`,
      [hash, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Funcionário não encontrado.' });
    }

    // Revoga todos os refresh tokens ativos do usuário
    await db.query(
      `UPDATE refresh_tokens SET revoked = TRUE WHERE employee_id = $1 AND revoked = FALSE`,
      [id]
    );

    logger.info('Senha resetada pelo admin', { targetEmployeeId: id, adminId: req.user.id });
    res.json({ message: 'Senha redefinida com sucesso.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, getById, update, toggleActive, importEmployees, downloadTemplate, resetPasswordByAdmin };
