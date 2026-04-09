// Serviço de dashboard — queries de analytics para o painel administrativo
const db = require('../config/database');

/**
 * Retorna totais do dia atual por unidade (ou todas as unidades).
 * @param {number|null} unitId - filtrar por unidade específica, ou null para todas
 */
async function getDailySummary(unitId = null) {
  const unitFilter = unitId ? 'AND cr.unit_id = $1' : '';
  const params     = unitId ? [unitId] : [];

  // Total de batidas hoje
  const totalClocksResult = await db.query(
    `SELECT COUNT(*) AS total
     FROM clock_records cr
     WHERE cr.clocked_at_utc::date = CURRENT_DATE ${unitFilter}`,
    params
  );

  // Total de bloqueios hoje
  const totalBlockedResult = await db.query(
    `SELECT COUNT(*) AS total
     FROM blocked_attempts ba
     WHERE ba.attempted_at::date = CURRENT_DATE
     ${unitId ? 'AND ba.unit_id = $1' : ''}`,
    params
  );

  // Funcionários que bateram ponto hoje (pelo menos uma batida)
  const activeTodayResult = await db.query(
    `SELECT COUNT(DISTINCT cr.employee_id) AS total
     FROM clock_records cr
     WHERE cr.clocked_at_utc::date = CURRENT_DATE ${unitFilter}`,
    params
  );

  // Total de funcionários ativos na(s) unidade(s)
  const totalEmployeesResult = await db.query(
    `SELECT COUNT(*) AS total
     FROM employees e
     WHERE e.active = TRUE AND e.role = 'employee'
     ${unitId ? 'AND e.unit_id = $1' : ''}`,
    params
  );

  const totalClocks     = parseInt(totalClocksResult.rows[0].total, 10);
  const totalBlocked    = parseInt(totalBlockedResult.rows[0].total, 10);
  const activeToday     = parseInt(activeTodayResult.rows[0].total, 10);
  const totalEmployees  = parseInt(totalEmployeesResult.rows[0].total, 10);

  return {
    totalClocks,
    totalBlocked,
    activeToday,
    absentToday:    totalEmployees - activeToday,
    totalEmployees,
  };
}

/**
 * Retorna os últimos N registros de ponto para exibir no dashboard.
 * @param {number} limit
 * @param {number|null} unitId
 */
async function getRecentClocks(limit = 10, unitId = null) {
  const unitFilter = unitId ? 'AND cr.unit_id = $2' : '';
  const params     = unitId ? [limit, unitId] : [limit];

  const result = await db.query(
    `SELECT
       cr.id,
       cr.clock_type,
       cr.clocked_at_utc,
       cr.timezone,
       cr.is_inside_zone,
       cr.distance_meters,
       cr.photo_path,
       e.full_name    AS employee_name,
       e.badge_number,
       u.name         AS unit_name,
       u.code         AS unit_code
     FROM clock_records cr
     JOIN employees e ON e.id = cr.employee_id
     JOIN units     u ON u.id = cr.unit_id
     WHERE 1=1 ${unitFilter}
     ORDER BY cr.clocked_at_utc DESC
     LIMIT $1`,
    params
  );

  return result.rows;
}

/**
 * Retorna contagem de batidas por unidade no dia atual.
 * Útil para o gráfico de barras do dashboard.
 */
async function getClocksByUnit() {
  const result = await db.query(
    `SELECT
       u.id,
       u.name,
       u.code,
       COUNT(cr.id)               AS total_clocks,
       COUNT(CASE WHEN cr.is_inside_zone = FALSE THEN 1 END) AS outside_zone,
       COUNT(DISTINCT cr.employee_id)                        AS unique_employees
     FROM units u
     LEFT JOIN clock_records cr
       ON cr.unit_id = u.id
       AND cr.clocked_at_utc::date = CURRENT_DATE
     WHERE u.active = TRUE
     GROUP BY u.id, u.name, u.code
     ORDER BY u.name`
  );

  return result.rows;
}

/**
 * Retorna funcionários sem nenhum registro no dia atual.
 * @param {number|null} unitId
 */
async function getAbsentEmployees(unitId = null) {
  const unitFilter = unitId ? 'AND e.unit_id = $1' : '';
  const params     = unitId ? [unitId] : [];

  const result = await db.query(
    `SELECT
       e.id,
       e.full_name,
       e.badge_number,
       u.name AS unit_name,
       u.code AS unit_code
     FROM employees e
     JOIN units u ON u.id = e.unit_id
     WHERE e.active = TRUE
       AND e.role = 'employee'
       ${unitFilter}
       AND e.id NOT IN (
         SELECT DISTINCT employee_id
         FROM clock_records
         WHERE clocked_at_utc::date = CURRENT_DATE
       )
     ORDER BY u.name, e.full_name`,
    params
  );

  return result.rows;
}

/**
 * Retorna contagem de bloqueios por motivo nos últimos N dias.
 * @param {number} days
 */
async function getBlockedByReason(days = 7) {
  const result = await db.query(
    `SELECT
       block_reason,
       COUNT(*) AS total
     FROM blocked_attempts
     WHERE attempted_at >= NOW() - ($1 || ' days')::INTERVAL
     GROUP BY block_reason
     ORDER BY total DESC`,
    [days]
  );

  return result.rows;
}

module.exports = {
  getDailySummary,
  getRecentClocks,
  getClocksByUnit,
  getAbsentEmployees,
  getBlockedByReason,
};
