// Controller de exportação: PDF (cartão de ponto) e Excel (auditoria)
const PDFDocument = require('pdfkit');
const ExcelJS     = require('exceljs');
const db          = require('../config/database');
const { formatLocalTime, monthName } = require('../utils/timeUtils');

// ----------------------------------------------------------------
// GET /api/admin/export/pdf
// Cartão de ponto mensal em PDF — sem fotos
// ----------------------------------------------------------------
async function exportPdf(req, res, next) {
  try {
    const { employeeId, month, year } = req.query;

    if (!employeeId || !month || !year) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: employeeId, month, year.' });
    }

    // Dados do funcionário
    const empResult = await db.query(
      `SELECT e.full_name, e.badge_number, u.name AS unit_name
       FROM employees e JOIN units u ON u.id = e.unit_id
       WHERE e.id = $1`,
      [parseInt(employeeId, 10)]
    );

    if (!empResult.rows[0]) {
      return res.status(404).json({ error: 'Funcionário não encontrado.' });
    }

    const emp = empResult.rows[0];

    // Registros do mês
    const recordsResult = await db.query(
      `SELECT clock_type, clocked_at_utc, timezone, is_inside_zone
       FROM clock_records
       WHERE employee_id = $1
         AND EXTRACT(MONTH FROM clocked_at_utc AT TIME ZONE timezone) = $2
         AND EXTRACT(YEAR  FROM clocked_at_utc AT TIME ZONE timezone) = $3
       ORDER BY clocked_at_utc ASC`,
      [parseInt(employeeId, 10), parseInt(month, 10), parseInt(year, 10)]
    );

    // Organiza por dia
    const byDay = {};
    recordsResult.rows.forEach((r) => {
      const localDate = formatLocalTime(r.clocked_at_utc, r.timezone, 'dd');
      if (!byDay[localDate]) byDay[localDate] = {};
      byDay[localDate][r.clock_type] = {
        time:     formatLocalTime(r.clocked_at_utc, r.timezone, 'HH:mm'),
        inside:   r.is_inside_zone,
      };
    });

    // Gera PDF com pdfkit
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="cartao_ponto_${emp.badge_number}_${month}_${year}.pdf"`);
    doc.pipe(res);

    // Cabeçalho
    doc.fontSize(16).font('Helvetica-Bold').text('CARTÃO DE PONTO', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(12).font('Helvetica').text(`Referência: ${monthName(parseInt(month, 10)).toUpperCase()} / ${year}`, { align: 'center' });
    doc.moveDown(0.8);

    doc.font('Helvetica-Bold').text(`Funcionário: `, { continued: true }).font('Helvetica').text(emp.full_name);
    doc.font('Helvetica-Bold').text(`Matrícula: `,   { continued: true }).font('Helvetica').text(emp.badge_number);
    doc.font('Helvetica-Bold').text(`Unidade: `,     { continued: true }).font('Helvetica').text(emp.unit_name);
    doc.moveDown(1);

    // Cabeçalho da tabela
    const COL_X   = [40, 100, 185, 270, 355, 440];
    const ROW_H   = 20;
    const HEADERS = ['Data', 'Entrada', 'Saída', 'Ini.Int', 'Fim.Int', 'Status'];

    doc.font('Helvetica-Bold').fontSize(9);
    HEADERS.forEach((h, i) => doc.text(h, COL_X[i], doc.y, { width: 80 }));
    doc.moveDown(0.2);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.3);

    // Linhas por dia
    const daysInMonth = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
    doc.font('Helvetica').fontSize(9);

    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = String(d).padStart(2, '0');
      const day    = byDay[dayStr];

      const rowY   = doc.y;
      const values = [
        `${dayStr}/${month}`,
        day?.entry?.time        || '—',
        day?.exit?.time         || '—',
        day?.break_start?.time  || '—',
        day?.break_end?.time    || '—',
        !day ? '' : (day.entry?.inside !== false && day.exit?.inside !== false ? '✓' : '✗'),
      ];

      values.forEach((v, i) => doc.text(v, COL_X[i], rowY, { width: 80 }));
      doc.y = rowY + ROW_H;

      // Quebra de página se necessário
      if (doc.y > 750) doc.addPage();
    }

    doc.moveDown(1);
    doc.fontSize(8).fillColor('#666')
      .text('✓ Dentro da zona  |  ✗ Fora da zona (pelo menos uma batida fora do raio configurado)', { align: 'center' });

    doc.end();
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// GET /api/admin/export/excel
// Dados brutos de auditoria em Excel
// ----------------------------------------------------------------
async function exportExcel(req, res, next) {
  try {
    const { unitId, startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: startDate, endDate.' });
    }

    const params  = [startDate, endDate];
    const filters = unitId ? `AND cr.unit_id = $${params.push(parseInt(unitId, 10))}` : '';

    const result = await db.query(
      `SELECT
         cr.id,
         e.full_name, e.badge_number,
         u.name AS unit_name, u.code AS unit_code,
         cr.clock_type,
         cr.clocked_at_utc,
         cr.timezone,
         cr.latitude, cr.longitude, cr.accuracy_meters,
         cr.distance_meters, cr.is_inside_zone,
         cr.ip_address,
         cr.created_at
       FROM clock_records cr
       JOIN employees e ON e.id = cr.employee_id
       JOIN units     u ON u.id = cr.unit_id
       WHERE cr.clocked_at_utc::date BETWEEN $1 AND $2
       ${filters}
       ORDER BY cr.clocked_at_utc ASC`,
      params
    );

    const workbook  = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Registros de Ponto');

    worksheet.columns = [
      { header: 'ID',             key: 'id',               width: 8  },
      { header: 'Funcionário',    key: 'full_name',        width: 28 },
      { header: 'Matrícula',      key: 'badge_number',     width: 14 },
      { header: 'Unidade',        key: 'unit_name',        width: 22 },
      { header: 'Código Unidade', key: 'unit_code',        width: 14 },
      { header: 'Tipo Batida',    key: 'clock_type',       width: 16 },
      { header: 'Horário UTC',    key: 'clocked_at_utc',  width: 22 },
      { header: 'Fuso Horário',   key: 'timezone',         width: 20 },
      { header: 'Horário Local',  key: 'local_time',       width: 22 },
      { header: 'Latitude',       key: 'latitude',         width: 14 },
      { header: 'Longitude',      key: 'longitude',        width: 14 },
      { header: 'Precisão GPS (m)', key: 'accuracy_meters', width: 16 },
      { header: 'Distância (m)',  key: 'distance_meters',  width: 14 },
      { header: 'Dentro da Zona',key: 'is_inside_zone',   width: 14 },
      { header: 'IP',             key: 'ip_address',       width: 16 },
    ];

    // Cabeçalho em negrito
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' },
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    result.rows.forEach((r) => {
      worksheet.addRow({
        ...r,
        local_time:    formatLocalTime(r.clocked_at_utc, r.timezone),
        is_inside_zone: r.is_inside_zone ? 'Sim' : 'Não',
        latitude:       parseFloat(r.latitude),
        longitude:      parseFloat(r.longitude),
      });
    });

    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="auditoria_${startDate}_${endDate}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

module.exports = { exportPdf, exportExcel };
