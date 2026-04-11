// Controller de autenticação: login, refresh, logout e perfil atual
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const db      = require('../config/database');
const logger  = require('../utils/logger');
const { sendPasswordResetEmail } = require('../services/email.service');

// Gera o hash SHA-256 de um token para armazenar no banco
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ----------------------------------------------------------------
// POST /api/auth/login
// ----------------------------------------------------------------
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Busca funcionário pelo email
    const result = await db.query(
      `SELECT e.*, u.name AS unit_name, u.code AS unit_code
       FROM employees e
       JOIN units u ON u.id = e.unit_id
       WHERE e.email = $1 AND e.active = TRUE`,
      [email.toLowerCase().trim()]
    );


    const employee = result.rows[0];

    // Verifica senha (mesmo se o usuário não existir, para evitar timing attack)
    // Hash dummy gerado com bcrypt.hashSync('dummy', 12) — precisa ser válido
    const DUMMY_HASH = '$2b$12$LJ3m4ys3Lf0j0vSOfikVxuVHR6MfCpN9FnBiKaLueaKBqwLhLaGiC';
    const passwordValid = employee
      ? await bcrypt.compare(password, employee.password_hash)
      : await bcrypt.compare(password, DUMMY_HASH);

    if (!employee || !passwordValid) {
      return res.status(401).json({ error: 'Email ou senha incorretos.' });
    }

    // Gera access token (curta duração)
    const accessToken = jwt.sign(
      {
        sub:        employee.id,
        role:       employee.role,
        unitId:     employee.unit_id,
        contractId: employee.contract_id || null,
        email:      employee.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    // Gera refresh token (longa duração) e armazena hash no banco
    const refreshTokenRaw  = crypto.randomBytes(48).toString('hex');
    const refreshTokenHash = hashToken(refreshTokenRaw);
    const expiresAt        = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

    await db.query(
      `INSERT INTO refresh_tokens (employee_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [employee.id, refreshTokenHash, expiresAt]
    );

    // Refresh token em cookie HttpOnly (não acessível via JS)
    res.cookie('refreshToken', refreshTokenRaw, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires:  expiresAt,
    });

    logger.info('Login realizado', { employeeId: employee.id, email: employee.email });

    // Só retorna refreshToken no body para clientes não-browser (mobile)
    // Browsers usam o cookie HttpOnly definido acima
    const isBrowser = !!req.headers.origin;

    const responseBody = {
      accessToken,
      user: {
        id:          employee.id,
        name:        employee.full_name,
        email:       employee.email,
        role:        employee.role,
        badgeNumber: employee.badge_number,
        unitId:      employee.unit_id,
        unitName:    employee.unit_name,
        unitCode:    employee.unit_code,
        contractId:  employee.contract_id || null,
      },
    };

    if (!isBrowser) {
      responseBody.refreshToken = refreshTokenRaw;
    }

    res.json(responseBody);
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// POST /api/auth/refresh
// ----------------------------------------------------------------
async function refresh(req, res, next) {
  try {
    const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!rawToken) {
      return res.status(401).json({ error: 'Refresh token não encontrado.' });
    }

    const tokenHash = hashToken(rawToken);

    const result = await db.query(
      `SELECT rt.*, e.role, e.unit_id, e.contract_id, e.email, e.active
       FROM refresh_tokens rt
       JOIN employees e ON e.id = rt.employee_id
       WHERE rt.token_hash = $1`,
      [tokenHash]
    );

    const tokenRecord = result.rows[0];

    if (!tokenRecord || tokenRecord.revoked || new Date(tokenRecord.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Refresh token inválido ou expirado.' });
    }

    if (!tokenRecord.active) {
      return res.status(401).json({ error: 'Conta desativada.' });
    }

    // Revoga o refresh token usado
    await db.query(
      `UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`,
      [tokenHash]
    );

    // Emite novo access token
    const accessToken = jwt.sign(
      {
        sub:        tokenRecord.employee_id,
        role:       tokenRecord.role,
        unitId:     tokenRecord.unit_id,
        contractId: tokenRecord.contract_id || null,
        email:      tokenRecord.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    // Emite novo refresh token (rotação)
    const newRefreshRaw  = crypto.randomBytes(48).toString('hex');
    const newRefreshHash = hashToken(newRefreshRaw);
    const expiresAt      = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.query(
      `INSERT INTO refresh_tokens (employee_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [tokenRecord.employee_id, newRefreshHash, expiresAt]
    );

    // Cookie HttpOnly para browsers
    res.cookie('refreshToken', newRefreshRaw, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires:  expiresAt,
    });

    const isBrowser = !!req.headers.origin;
    const responseBody = { accessToken };
    if (!isBrowser) {
      responseBody.refreshToken = newRefreshRaw;
    }

    res.json(responseBody);
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// POST /api/auth/logout
// ----------------------------------------------------------------
async function logout(req, res, next) {
  try {
    // Aceita refresh token via cookie (web) ou body (mobile)
    const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      await db.query(
        `UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`,
        [tokenHash]
      );
    }

    res.clearCookie('refreshToken');
    res.json({ message: 'Logout realizado com sucesso.' });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// GET /api/auth/me
// ----------------------------------------------------------------
async function me(req, res, next) {
  try {
    const result = await db.query(
      `SELECT e.id, e.full_name, e.email, e.role, e.badge_number,
              e.unit_id, u.name AS unit_name, u.code AS unit_code,
              u.latitude, u.longitude, u.radius_meters
       FROM employees e
       JOIN units u ON u.id = e.unit_id
       WHERE e.id = $1 AND e.active = TRUE`,
      [req.user.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const emp = result.rows[0];
    res.json({
      id:          emp.id,
      name:        emp.full_name,
      email:       emp.email,
      role:        emp.role,
      badgeNumber: emp.badge_number,
      unit: {
        id:           emp.unit_id,
        name:         emp.unit_name,
        code:         emp.unit_code,
        latitude:     parseFloat(emp.latitude),
        longitude:    parseFloat(emp.longitude),
        radiusMeters: emp.radius_meters,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// PUT /api/auth/profile
// Atualiza email e/ou senha do próprio usuário
// ----------------------------------------------------------------
async function updateProfile(req, res, next) {
  try {
    const { email, currentPassword, newPassword } = req.body;
    const id = req.user.id;

    // Busca usuário atual para verificar senha
    const result = await db.query(
      `SELECT password_hash, email FROM employees WHERE id = $1`,
      [id]
    );
    const emp = result.rows[0];
    if (!emp) return res.status(404).json({ error: 'Usuário não encontrado.' });

    // Valida senha atual
    const valid = await bcrypt.compare(currentPassword, emp.password_hash);
    if (!valid) return res.status(401).json({ error: 'Senha atual incorreta.' });

    // Monta campos a atualizar
    const updates = [];
    const params  = [];

    if (email && email.toLowerCase().trim() !== emp.email) {
      params.push(email.toLowerCase().trim());
      updates.push(`email = $${params.length}`);
    }

    if (newPassword) {
      if (newPassword.length < 6) return res.status(400).json({ error: 'Nova senha mínima de 6 caracteres.' });
      const hash = await bcrypt.hash(newPassword, 12);
      params.push(hash);
      updates.push(`password_hash = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhuma alteração informada.' });
    }

    params.push(id);
    await db.query(
      `UPDATE employees SET ${updates.join(', ')} WHERE id = $${params.length}`,
      params
    );

    logger.info('Perfil atualizado', { employeeId: id });
    res.json({ message: 'Perfil atualizado com sucesso.' });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// POST /api/auth/forgot-password
// ----------------------------------------------------------------
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;

    // Sempre retorna 200 para não revelar se o email existe (anti-enumeração)
    const result = await db.query(
      `SELECT id FROM employees WHERE email = $1 AND active = TRUE`,
      [email.toLowerCase().trim()]
    );

    if (result.rows[0]) {
      const employeeId = result.rows[0].id;

      // Invalida tokens anteriores não usados deste funcionário
      await db.query(
        `UPDATE password_reset_tokens SET used = TRUE
         WHERE employee_id = $1 AND used = FALSE`,
        [employeeId]
      );

      const rawToken   = crypto.randomBytes(32).toString('hex');
      const tokenHash  = hashToken(rawToken);
      const expiresAt  = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      await db.query(
        `INSERT INTO password_reset_tokens (employee_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [employeeId, tokenHash, expiresAt]
      );

      const appUrl  = process.env.APP_URL || 'https://pontotools.shop';
      const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

      await sendPasswordResetEmail(email.toLowerCase().trim(), resetUrl);

      logger.info('Solicitação de reset de senha', { employeeId });
    }

    res.json({ message: 'Se o email estiver cadastrado, você receberá as instruções em breve.' });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// POST /api/auth/reset-password
// ----------------------------------------------------------------
async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token e nova senha são obrigatórios.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
    }

    const tokenHash = hashToken(token);

    const result = await db.query(
      `SELECT prt.id, prt.employee_id, prt.expires_at, prt.used
       FROM password_reset_tokens prt
       WHERE prt.token_hash = $1`,
      [tokenHash]
    );

    const record = result.rows[0];

    if (!record || record.used || new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Link de recuperação inválido ou expirado.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Atualiza senha e marca token como usado em transação com cliente dedicado
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE employees SET password_hash = $1 WHERE id = $2`,
        [passwordHash, record.employee_id]
      );
      await client.query(
        `UPDATE password_reset_tokens SET used = TRUE WHERE id = $1`,
        [record.id]
      );
      // Revoga todos os refresh tokens ativos do usuário
      await client.query(
        `UPDATE refresh_tokens SET revoked = TRUE WHERE employee_id = $1 AND revoked = FALSE`,
        [record.employee_id]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    logger.info('Senha redefinida via token', { employeeId: record.employee_id });
    res.json({ message: 'Senha redefinida com sucesso. Faça login com a nova senha.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, refresh, logout, me, updateProfile, forgotPassword, resetPassword };
