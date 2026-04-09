// Utilitários de fuso horário e formatação de datas
const { formatInTimeZone, toZonedTime } = require('date-fns-tz');
const { format }                        = require('date-fns');
const { ptBR }                          = require('date-fns/locale');

/**
 * Formata uma data UTC no fuso horário informado.
 * @param {Date|string} utcDate  - data em UTC
 * @param {string} timezone      - ex: 'America/Sao_Paulo'
 * @param {string} fmt           - formato date-fns (default: 'dd/MM/yyyy HH:mm:ss')
 */
function formatLocalTime(utcDate, timezone, fmt = 'dd/MM/yyyy HH:mm:ss') {
  return formatInTimeZone(new Date(utcDate), timezone, fmt, { locale: ptBR });
}

/**
 * Retorna o nome do mês em português.
 * @param {number} month - 1-12
 */
function monthName(month) {
  const date = new Date(2000, month - 1, 1);
  return format(date, 'MMMM', { locale: ptBR });
}

/**
 * Gera um objeto Date representando o início e fim de um dia
 * no fuso horário informado, em UTC.
 */
function dayRangeUtc(dateStr, timezone = 'America/Sao_Paulo') {
  const zonedStart = toZonedTime(new Date(`${dateStr}T00:00:00`), timezone);
  const zonedEnd   = toZonedTime(new Date(`${dateStr}T23:59:59`), timezone);
  return { start: zonedStart, end: zonedEnd };
}

module.exports = { formatLocalTime, monthName, dayRangeUtc };
