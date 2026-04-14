// Controller de exportação: PDF (cartão de ponto) e Excel (auditoria)
const PDFDocument = require('pdfkit');
const ExcelJS     = require('exceljs');
const db          = require('../config/database');
const { formatLocalTime, monthName } = require('../utils/timeUtils');
const storage     = require('../config/storage');

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

    const workbook = new ExcelJS.Workbook();

    // ---- Aba 1: Serviços (turnos agrupados) ----
    const svcSheet = workbook.addWorksheet('Serviços');
    svcSheet.columns = [
      { header: 'Funcionário',    key: 'full_name',      width: 28 },
      { header: 'Matrícula',      key: 'badge_number',   width: 14 },
      { header: 'Unidade',        key: 'unit_name',      width: 22 },
      { header: 'Data',           key: 'date',           width: 12 },
      { header: 'Hora Entrada',   key: 'entry_time',     width: 14 },
      { header: 'Hora Saída',     key: 'exit_time',      width: 14 },
      { header: 'Total Horas',    key: 'total_hours',    width: 14 },
      { header: 'Dentro da Zona', key: 'inside_zone',    width: 14 },
    ];
    svcSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    svcSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } };

    // Agrupa batidas em serviços (entry/exit por funcionário por dia)
    const svcMap = {};
    result.rows.forEach((r) => {
      const localDate = formatLocalTime(r.clocked_at_utc, r.timezone, 'yyyy-MM-dd');
      const key       = `${r.employee_id}_${localDate}`;
      if (!svcMap[key]) {
        svcMap[key] = {
          full_name:    r.full_name,
          badge_number: r.badge_number,
          unit_name:    r.unit_name,
          date:         formatLocalTime(r.clocked_at_utc, r.timezone, 'dd/MM/yyyy'),
          entry:        null,
          exit:         null,
        };
      }
      if (r.clock_type === 'entry' && !svcMap[key].entry) svcMap[key].entry = r;
      if (r.clock_type === 'exit'  && !svcMap[key].exit)  svcMap[key].exit  = r;
    });

    Object.values(svcMap).forEach((svc) => {
      const entryTime = svc.entry
        ? formatLocalTime(svc.entry.clocked_at_utc, svc.entry.timezone, 'HH:mm')
        : '—';
      const exitTime  = svc.exit
        ? formatLocalTime(svc.exit.clocked_at_utc,  svc.exit.timezone,  'HH:mm')
        : '—';

      let totalHours = '—';
      if (svc.entry && svc.exit) {
        const diffSec = Math.floor(
          (new Date(svc.exit.clocked_at_utc) - new Date(svc.entry.clocked_at_utc)) / 1000
        );
        const h = Math.floor(diffSec / 3600);
        const m = Math.floor((diffSec % 3600) / 60);
        totalHours = `${h}h${String(m).padStart(2, '0')}m`;
      }

      const inside = svc.entry?.is_inside_zone !== false && svc.exit?.is_inside_zone !== false;

      svcSheet.addRow({
        full_name:    svc.full_name,
        badge_number: svc.badge_number,
        unit_name:    svc.unit_name,
        date:         svc.date,
        entry_time:   entryTime,
        exit_time:    exitTime,
        total_hours:  totalHours,
        inside_zone:  inside ? 'Sim' : 'Não',
      });
    });

    // ---- Aba 2: Auditoria (batidas individuais) ----
    const worksheet = workbook.addWorksheet('Auditoria');
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
      { header: 'Dentro da Zona', key: 'is_inside_zone',  width: 14 },
      { header: 'IP',             key: 'ip_address',       width: 16 },
    ];
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    result.rows.forEach((r) => {
      worksheet.addRow({
        ...r,
        local_time:     formatLocalTime(r.clocked_at_utc, r.timezone),
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

// ----------------------------------------------------------------
// GET /api/admin/export/services/pdf
// Relatório de serviços com fotos (entrada + saída)
// Filtros: employeeId + startDate + endDate  OU  unitId + startDate + endDate
// ----------------------------------------------------------------
async function exportServicesPdf(req, res, next) {
  try {
    const { employeeId, unitId, startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: startDate, endDate.' });
    }
    if (!employeeId && !unitId) {
      return res.status(400).json({ error: 'Informe employeeId ou unitId.' });
    }

    const params  = [startDate, endDate];
    const filters = [];

    // Gestor só vê registros do seu contrato
    if (req.user.role === 'gestor' && req.user.contractId) {
      filters.push(`u.contract_id = $${params.push(req.user.contractId)}`);
    }

    if (employeeId) filters.push(`cr.employee_id = $${params.push(parseInt(employeeId, 10))}`);
    if (unitId)     filters.push(`cr.unit_id     = $${params.push(parseInt(unitId,     10))}`);

    const result = await db.query(
      `SELECT
         cr.employee_id,
         e.full_name, e.badge_number,
         u.name AS unit_name,
         cr.clock_type,
         cr.clocked_at_utc,
         cr.timezone,
         cr.is_inside_zone,
         cr.photo_path
       FROM clock_records cr
       JOIN employees e ON e.id = cr.employee_id
       JOIN units     u ON u.id = cr.unit_id
       WHERE cr.clocked_at_utc::date BETWEEN $1 AND $2
         AND cr.clock_type IN ('entry', 'exit')
         ${filters.length ? 'AND ' + filters.join(' AND ') : ''}
       ORDER BY cr.employee_id, cr.clocked_at_utc ASC`,
      params
    );

    // Agrupa em serviços por funcionário + dia
    const servicesMap = {};
    result.rows.forEach((r) => {
      const localDate = formatLocalTime(r.clocked_at_utc, r.timezone, 'yyyy-MM-dd');
      const key       = `${r.employee_id}_${localDate}`;
      if (!servicesMap[key]) {
        servicesMap[key] = {
          employee_id:  r.employee_id,
          full_name:    r.full_name,
          badge_number: r.badge_number,
          unit_name:    r.unit_name,
          date:         formatLocalTime(r.clocked_at_utc, r.timezone, 'dd/MM/yyyy'),
          entry:        null,
          exit:         null,
        };
      }
      if (r.clock_type === 'entry' && !servicesMap[key].entry) servicesMap[key].entry = r;
      if (r.clock_type === 'exit'  && !servicesMap[key].exit)  servicesMap[key].exit  = r;
    });

    const services = Object.values(servicesMap);

    if (!services.length) {
      return res.status(404).json({ error: 'Nenhum serviço encontrado para o período.' });
    }

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="servicos_${startDate}_${endDate}.pdf"`);
    doc.pipe(res);

    try {
      // Cabeçalho
      doc.fontSize(16).font('Helvetica-Bold').text('RELATÓRIO DE SERVIÇOS', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica').text(`Período: ${startDate} a ${endDate}`, { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#64748b').text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
      doc.fillColor('#000');
      doc.moveDown(1);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.8);

      for (const svc of services) {
        if (doc.y > 600) doc.addPage();

        doc.fontSize(12).font('Helvetica-Bold')
           .text(`${svc.full_name}  ·  ${svc.unit_name}  ·  ${svc.date}`);
        doc.moveDown(0.3);

        const entryTime = svc.entry
          ? formatLocalTime(svc.entry.clocked_at_utc, svc.entry.timezone, 'HH:mm')
          : '—';
        const exitTime  = svc.exit
          ? formatLocalTime(svc.exit.clocked_at_utc,  svc.exit.timezone,  'HH:mm')
          : '—';

        let totalStr = '—';
        if (svc.entry && svc.exit) {
          const diffSec = Math.floor(
            (new Date(svc.exit.clocked_at_utc) - new Date(svc.entry.clocked_at_utc)) / 1000
          );
          const h = Math.floor(diffSec / 3600);
          const m = Math.floor((diffSec % 3600) / 60);
          totalStr = `${h}h${String(m).padStart(2, '0')}m`;
        }

        const inside = svc.entry?.is_inside_zone !== false && svc.exit?.is_inside_zone !== false;

        doc.fontSize(10).font('Helvetica')
           .text(`Entrada: ${entryTime}   →   Saída: ${exitTime}   |   Total: ${totalStr}   |   Zona: ${inside ? '✓ Dentro' : '✗ Fora'}`);
        doc.moveDown(0.5);

        // Fotos
        const photoY  = doc.y;
        const imgSize = 150;

        const [entryBuf, exitBuf] = await Promise.all([
          svc.entry?.photo_path ? storage.getBuffer(svc.entry.photo_path).catch(() => null) : Promise.resolve(null),
          svc.exit?.photo_path  ? storage.getBuffer(svc.exit.photo_path).catch(() => null)  : Promise.resolve(null),
        ]);

        if (entryBuf) {
          doc.image(entryBuf, 40, photoY, { width: imgSize, height: imgSize });
          doc.fontSize(9).fillColor('#64748b')
             .text(`Entrada ${entryTime}`, 40, photoY + imgSize + 2, { width: imgSize, align: 'center' });
          doc.fillColor('#000');
        }
        if (exitBuf) {
          doc.image(exitBuf, 210, photoY, { width: imgSize, height: imgSize });
          doc.fontSize(9).fillColor('#64748b')
             .text(`Saída ${exitTime}`, 210, photoY + imgSize + 2, { width: imgSize, align: 'center' });
          doc.fillColor('#000');
        }

        if (entryBuf || exitBuf) {
          doc.y = photoY + imgSize + 20;
        }
        doc.moveDown(0.5);
        doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#e2e8f0').stroke();
        doc.strokeColor('#000');
        doc.moveDown(0.8);
      }

      doc.end();
    } catch (pdfErr) {
      doc.end();
      throw pdfErr;
    }
  } catch (err) {
    next(err);
  }
}

module.exports = { exportPdf, exportExcel, exportServicesPdf };
