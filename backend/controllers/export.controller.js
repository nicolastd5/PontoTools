// Controller de exportação: PDF (cartão de ponto) e Excel (auditoria)
const PDFDocument = require('pdfkit');
const ExcelJS     = require('exceljs');
const https       = require('https');
const db          = require('../config/database');
const { formatLocalTime, monthName } = require('../utils/timeUtils');
const storage     = require('../config/storage');

// Geocoding reverso via Nominatim (OpenStreetMap) — gratuito, sem chave.
// Nominatim exige User-Agent identificável e limita a ~1 req/s.
const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const geocodeCache = new Map(); // key: "lat4,lon4" → { value, expiresAt }

function reverseGeocode(lat, lon) {
  const latNum = Number(lat);
  const lonNum = Number(lon);
  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return Promise.resolve(null);
  if (Math.abs(latNum) > 90 || Math.abs(lonNum) > 180)      return Promise.resolve(null);

  // Arredonda a ~11m de precisão para coalescer requisições no mesmo local
  const key = `${latNum.toFixed(4)},${lonNum.toFixed(4)}`;
  const now = Date.now();
  const hit = geocodeCache.get(key);
  if (hit && hit.expiresAt > now) return Promise.resolve(hit.value);

  return new Promise((resolve) => {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latNum}&lon=${lonNum}&format=json&addressdetails=1`;
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'PontoTools/1.0 (https://pontotools.shop)' } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json  = JSON.parse(data);
            const a     = json.address || {};
            const parts = [
              a.road || a.pedestrian || a.path,
              a.house_number,
              a.suburb || a.neighbourhood || a.quarter,
              a.city || a.town || a.village || a.municipality,
              a.state,
            ].filter(Boolean);
            const value = parts.length ? parts.join(', ') : (json.display_name || null);
            geocodeCache.set(key, { value, expiresAt: now + GEOCODE_CACHE_TTL_MS });
            resolve(value);
          } catch { resolve(null); }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
  });
}

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

    // Sanitiza parâmetros que irão para o header Content-Disposition
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    const safeMonth = String(parseInt(month, 10)).padStart(2, '0');
    const safeYear  = String(parseInt(year,  10));

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
    const safeBadge = emp.badge_number.replace(/[^a-zA-Z0-9_-]/g, '_');

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
    res.set('Content-Disposition', `attachment; filename="cartao_ponto_${safeBadge}_${safeMonth}_${safeYear}.pdf"`);
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

    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRe.test(startDate) || !dateRe.test(endDate)) {
      return res.status(400).json({ error: 'Formato de data inválido. Use YYYY-MM-DD.' });
    }

    const params  = [startDate, endDate];
    const filters = unitId ? `AND cr.unit_id = $${params.push(parseInt(unitId, 10))}` : '';

    const result = await db.query(
      `SELECT
         cr.id,
         e.id AS employee_id,
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
// Relatório de ordens de serviço com fotos before/after
// Filtros: employeeId + startDate + endDate  OU  unitId + startDate + endDate
// ----------------------------------------------------------------
async function exportServicesPdf(req, res, next) {
  try {
    const { employeeId, unitId, startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: startDate, endDate.' });
    }

    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRe.test(startDate) || !dateRe.test(endDate)) {
      return res.status(400).json({ error: 'Formato de data inválido. Use YYYY-MM-DD.' });
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

    if (employeeId) filters.push(`so.assigned_employee_id = $${params.push(parseInt(employeeId, 10))}`);
    if (unitId)     filters.push(`so.unit_id = $${params.push(parseInt(unitId, 10))}`);

    const result = await db.query(
      `SELECT
         so.id, so.title, so.description, so.status,
         so.scheduled_date, so.due_time,
         so.started_at, so.finished_at,
         so.problem_description, so.issue_description,
         so.employee_posto,
         e.full_name, e.badge_number,
         u.name AS unit_name, u.address AS unit_address
       FROM service_orders so
       LEFT JOIN employees e ON e.id = so.assigned_employee_id
       JOIN units     u ON u.id = so.unit_id
       WHERE so.scheduled_date BETWEEN $1 AND $2
         ${filters.length ? 'AND ' + filters.join(' AND ') : ''}
       ORDER BY so.scheduled_date ASC, so.id ASC`,
      params
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Nenhum serviço encontrado para o período.' });
    }

    // Busca fotos de todos os serviços encontrados
    const serviceIds = result.rows.map((r) => r.id);
    const photosResult = await db.query(
      `SELECT service_order_id, id AS photo_id, phase, photo_path, latitude, longitude
       FROM service_photos
       WHERE service_order_id = ANY($1)
       ORDER BY service_order_id, created_at ASC`,
      [serviceIds]
    );

    // Agrupa fotos por serviço
    const photosByService = {};
    photosResult.rows.forEach((p) => {
      if (!photosByService[p.service_order_id]) photosByService[p.service_order_id] = [];
      photosByService[p.service_order_id].push(p);
    });

    // Pré-geocodifica todas as coordenadas únicas respeitando o limite do Nominatim (1 req/s).
    // Agrupa por chave arredondada para evitar requisições duplicadas ao mesmo local.
    const gpsPhotosByService = {};
    for (const svc of result.rows) {
      const photos = photosByService[svc.id] || [];
      const gpsPhoto = photos.find((p) => p.phase === 'before' && p.latitude != null && p.longitude != null)
                    || photos.find((p) => p.latitude != null && p.longitude != null);
      if (gpsPhoto) gpsPhotosByService[svc.id] = gpsPhoto;
    }
    const uniqueGpsPhotos = Object.values(gpsPhotosByService).filter((p, i, arr) => {
      const key = `${Number(p.latitude).toFixed(4)},${Number(p.longitude).toFixed(4)}`;
      return arr.findIndex((q) => `${Number(q.latitude).toFixed(4)},${Number(q.longitude).toFixed(4)}` === key) === i;
    });
    // Throttle: 1 req/s conforme política do Nominatim
    const geocodeMap = {};
    for (let i = 0; i < uniqueGpsPhotos.length; i++) {
      const p = uniqueGpsPhotos[i];
      const key = `${Number(p.latitude).toFixed(4)},${Number(p.longitude).toFixed(4)}`;
      if (geocodeMap[key] === undefined) {
        if (i > 0) await new Promise((r) => setTimeout(r, 1050));
        geocodeMap[key] = await reverseGeocode(p.latitude, p.longitude);
      }
    }

    // Pré-carrega buffers de fotos com concorrência limitada para não sobrecarregar o S3
    const photoBufferCache = {};
    const photoQueue = [];
    for (const svc of result.rows) {
      const photos = photosByService[svc.id] || [];
      const toLoad = [
        ...photos.filter((p) => p.phase === 'before').slice(0, 2),
        ...photos.filter((p) => p.phase === 'after').slice(0, 2),
      ];
      for (const p of toLoad) {
        if (photoBufferCache[p.photo_path] === undefined) {
          photoBufferCache[p.photo_path] = null;
          photoQueue.push(p.photo_path);
        }
      }
    }

    // Processa em lotes de 8 paralelos
    const CONCURRENCY = 8;
    for (let i = 0; i < photoQueue.length; i += CONCURRENCY) {
      const batch = photoQueue.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map((key) =>
        storage.getBuffer(key)
          .then((buf) => { photoBufferCache[key] = buf; })
          .catch(() => { photoBufferCache[key] = null; })
      ));
    }

    const STATUS_LABEL = {
      pending:          'Pendente',
      in_progress:      'Em andamento',
      done:             'Concluído',
      done_with_issues: 'Concluído c/ ressalvas',
      problem:          'Problema',
    };

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="servicos_${startDate}_${endDate}.pdf"`);
    doc.pipe(res);

    try {
      // Cabeçalho
      doc.fontSize(16).font('Helvetica-Bold').text('RELATÓRIO DE ORDENS DE SERVIÇO', { align: 'center' });
      doc.moveDown(0.3);
      const fmtQueryDate = (s) => { const [y,m,d] = s.split('-'); return `${d}/${m}/${y}`; };
      doc.fontSize(11).font('Helvetica')
         .text(`Período: ${fmtQueryDate(startDate)} a ${fmtQueryDate(endDate)}`, { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#64748b')
         .text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
      doc.fillColor('#000');
      doc.moveDown(1);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.8);

      for (const svc of result.rows) {
        if (doc.y > 580) doc.addPage();

        // scheduled_date vem como objeto Date do pg — formata direto sem re-parsear
        const sd = new Date(svc.scheduled_date);
        const scheduledDate = `${String(sd.getUTCDate()).padStart(2,'0')}/${String(sd.getUTCMonth()+1).padStart(2,'0')}/${sd.getUTCFullYear()}`;
        const fmtTs = (ts) => ts ? new Date(ts).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';
        const startedAt  = fmtTs(svc.started_at);
        const finishedAt = fmtTs(svc.finished_at);

        // Título do serviço
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a')
           .text(svc.title);
        doc.fillColor('#000');
        doc.moveDown(0.2);

        // Linha de metadados
        const assignedName = svc.full_name || 'Sem responsável';
        const postoLabel   = svc.employee_posto || svc.unit_name;
        doc.fontSize(9).font('Helvetica').fillColor('#64748b')
           .text(`${assignedName}  ·  ${postoLabel}  ·  Agendado: ${scheduledDate}${svc.due_time ? ' às ' + svc.due_time.slice(0,5) : ''}  ·  Status: ${STATUS_LABEL[svc.status] || svc.status}`);
        doc.fillColor('#000');
        doc.moveDown(0.2);

        // Endereço GPS da foto de início (before) — já pré-geocodificado
        const photos = photosByService[svc.id] || [];
        const gpsPhoto = gpsPhotosByService[svc.id];
        if (gpsPhoto) {
          const gpsKey = `${Number(gpsPhoto.latitude).toFixed(4)},${Number(gpsPhoto.longitude).toFixed(4)}`;
          const gpsAddress = geocodeMap[gpsKey];
          if (gpsAddress) {
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#374151')
               .text('Endereço: ', { continued: true })
               .font('Helvetica').text(gpsAddress);
            doc.fontSize(8).fillColor('#94a3b8')
               .text('* Endereço aproximado obtido via GPS do colaborador');
            doc.fillColor('#000');
          }
        }
        doc.moveDown(0.3);

        // Timestamps de execução
        doc.fontSize(9).font('Helvetica')
           .text(`Iniciado em: ${startedAt}    Concluído em: ${finishedAt}`);
        doc.moveDown(0.3);

        // Descrição
        if (svc.description) {
          doc.fontSize(9).fillColor('#374151').text(`Descrição: ${svc.description}`);
          doc.fillColor('#000');
          doc.moveDown(0.3);
        }

        // Problema / Ressalvas
        if (svc.problem_description) {
          doc.fontSize(9).fillColor('#991b1b').text(`Problema: ${svc.problem_description}`);
          doc.fillColor('#000');
          doc.moveDown(0.3);
        }
        if (svc.issue_description) {
          doc.fontSize(9).fillColor('#c2410c').text(`Ressalvas: ${svc.issue_description}`);
          doc.fillColor('#000');
          doc.moveDown(0.3);
        }

        // Fotos
        const beforePhotos = photos.filter((p) => p.phase === 'before');
        const afterPhotos  = photos.filter((p) => p.phase === 'after');

        const imgSize  = 220;
        const imgGap   = 15;
        const maxPerRow = 2;

        function renderPhotoRow(label, photoList) {
          if (!photoList.length) return;
          if (doc.y > 650) doc.addPage();

          doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b')
             .text(label);
          doc.fillColor('#000');
          doc.moveDown(0.2);

          // Usa buffers pré-carregados
          const buffers = photoList.slice(0, maxPerRow).map((p) => photoBufferCache[p.photo_path] || null);

          const rowY = doc.y;
          let maxBottom = rowY;

          buffers.forEach((buf, i) => {
            if (!buf) return;
            const x = 40 + i * (imgSize + imgGap);
            if (x + imgSize > 555) return; // não sai da página
            doc.image(buf, x, rowY, { width: imgSize, height: imgSize });
            maxBottom = Math.max(maxBottom, rowY + imgSize + 14);
          });

          doc.y = maxBottom;
          doc.moveDown(0.3);
        }

        renderPhotoRow('Fotos — Antes:', beforePhotos);
        renderPhotoRow('Fotos — Depois:', afterPhotos);

        doc.moveDown(0.4);
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

// ----------------------------------------------------------------
// GET /api/admin/export/services/excel
// Ordens de serviço em Excel — sem fotos
// ----------------------------------------------------------------
async function exportServicesExcel(req, res, next) {
  try {
    const { employeeId, unitId, startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: startDate, endDate.' });
    }
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRe.test(startDate) || !dateRe.test(endDate)) {
      return res.status(400).json({ error: 'Formato de data inválido. Use YYYY-MM-DD.' });
    }
    if (!employeeId && !unitId) {
      return res.status(400).json({ error: 'Informe employeeId ou unitId.' });
    }

    const params  = [startDate, endDate];
    const filters = [];
    if (req.user.role === 'gestor' && req.user.contractId) {
      filters.push(`u.contract_id = $${params.push(req.user.contractId)}`);
    }
    if (employeeId) filters.push(`so.assigned_employee_id = $${params.push(parseInt(employeeId, 10))}`);
    if (unitId)     filters.push(`so.unit_id = $${params.push(parseInt(unitId, 10))}`);

    const result = await db.query(
      `SELECT
         so.id, so.title, so.description, so.status,
         so.scheduled_date, so.due_time,
         so.started_at, so.finished_at,
         so.problem_description, so.issue_description,
         so.employee_posto,
         e.full_name, e.badge_number,
         u.name AS unit_name, u.address AS unit_address,
         (SELECT COUNT(*) FROM service_photos sp WHERE sp.service_order_id = so.id) AS total_photos
       FROM service_orders so
       LEFT JOIN employees e ON e.id = so.assigned_employee_id
       JOIN units u ON u.id = so.unit_id
       WHERE so.scheduled_date BETWEEN $1 AND $2
         ${filters.length ? 'AND ' + filters.join(' AND ') : ''}
       ORDER BY so.scheduled_date ASC, so.id ASC`,
      params
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Nenhum serviço encontrado para o período.' });
    }

    // Busca coordenadas GPS da foto "before" de cada serviço
    const serviceIds = result.rows.map((r) => r.id);
    const gpsResult  = await db.query(
      `SELECT DISTINCT ON (service_order_id) service_order_id, latitude, longitude
       FROM service_photos
       WHERE service_order_id = ANY($1) AND phase = 'before'
         AND latitude IS NOT NULL AND longitude IS NOT NULL
       ORDER BY service_order_id, created_at ASC`,
      [serviceIds]
    );
    const gpsByService = {};
    gpsResult.rows.forEach((r) => { gpsByService[r.service_order_id] = r; });

    // Geocoding reverso com throttle 1 req/s (mesmo cache da função reverseGeocode)
    const geocodeMap = {};
    const uniqueGps  = Object.values(gpsByService).filter((p, i, arr) => {
      const key = `${Number(p.latitude).toFixed(4)},${Number(p.longitude).toFixed(4)}`;
      return arr.findIndex((q) => `${Number(q.latitude).toFixed(4)},${Number(q.longitude).toFixed(4)}` === key) === i;
    });
    for (let i = 0; i < uniqueGps.length; i++) {
      const p   = uniqueGps[i];
      const key = `${Number(p.latitude).toFixed(4)},${Number(p.longitude).toFixed(4)}`;
      if (geocodeMap[key] === undefined) {
        if (i > 0) await new Promise((r) => setTimeout(r, 1050));
        geocodeMap[key] = await reverseGeocode(p.latitude, p.longitude);
      }
    }

    const STATUS_LABEL = {
      pending:          'Pendente',
      in_progress:      'Em andamento',
      done:             'Concluído',
      done_with_issues: 'Concluído c/ ressalvas',
      problem:          'Problema',
    };

    const fmtTs = (ts) => ts ? new Date(ts).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';
    const fmtDate = (d) => {
      const dt = new Date(d);
      return `${String(dt.getUTCDate()).padStart(2,'0')}/${String(dt.getUTCMonth()+1).padStart(2,'0')}/${dt.getUTCFullYear()}`;
    };

    const workbook = new ExcelJS.Workbook();
    const sheet    = workbook.addWorksheet('Ordens de Serviço');

    sheet.columns = [
      { header: 'ID',              key: 'id',                  width: 8  },
      { header: 'Título',          key: 'title',               width: 36 },
      { header: 'Status',          key: 'status',              width: 22 },
      { header: 'Funcionário',     key: 'full_name',           width: 28 },
      { header: 'Matrícula',       key: 'badge_number',        width: 14 },
      { header: 'Posto',           key: 'employee_posto',      width: 28 },
      { header: 'Endereço GPS',    key: 'gps_address',         width: 44 },
      { header: 'Data Agendada',   key: 'scheduled_date',      width: 16 },
      { header: 'Hora Prevista',   key: 'due_time',            width: 14 },
      { header: 'Início',          key: 'started_at',          width: 22 },
      { header: 'Conclusão',       key: 'finished_at',         width: 22 },
      { header: 'Descrição',       key: 'description',         width: 40 },
      { header: 'Problema',        key: 'problem_description', width: 40 },
      { header: 'Ressalvas',       key: 'issue_description',   width: 40 },
      { header: 'Qtd. Fotos',      key: 'total_photos',        width: 12 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };

    result.rows.forEach((r) => {
      const gps        = gpsByService[r.id];
      const gpsKey     = gps ? `${Number(gps.latitude).toFixed(4)},${Number(gps.longitude).toFixed(4)}` : null;
      const gpsAddress = gpsKey ? (geocodeMap[gpsKey] || '—') : '—';

      sheet.addRow({
        id:                  r.id,
        title:               r.title,
        status:              STATUS_LABEL[r.status] || r.status,
        full_name:           r.full_name || '—',
        badge_number:        r.badge_number || '—',
        employee_posto:      r.employee_posto || '—',
        gps_address:         gpsAddress,
        scheduled_date:      fmtDate(r.scheduled_date),
        due_time:            r.due_time ? r.due_time.slice(0, 5) : '—',
        started_at:          fmtTs(r.started_at),
        finished_at:         fmtTs(r.finished_at),
        description:         r.description || '—',
        problem_description: r.problem_description || '—',
        issue_description:   r.issue_description || '—',
        total_photos:        parseInt(r.total_photos, 10),
      });
    });

    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="servicos_${startDate}_${endDate}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------------
// GET /api/admin/export/services/docx
// Ordens de serviço em Word (.docx) com fotos before/after
// ----------------------------------------------------------------
async function exportServicesDocx(req, res, next) {
  try {
    const { employeeId, unitId, startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: startDate, endDate.' });
    }
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRe.test(startDate) || !dateRe.test(endDate)) {
      return res.status(400).json({ error: 'Formato de data inválido. Use YYYY-MM-DD.' });
    }
    if (!employeeId && !unitId) {
      return res.status(400).json({ error: 'Informe employeeId ou unitId.' });
    }

    const {
      Document, Packer, Paragraph, TextRun, ImageRun,
      HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell,
      WidthType, ShadingType,
    } = require('docx');

    const params  = [startDate, endDate];
    const filters = [];
    if (req.user.role === 'gestor' && req.user.contractId) {
      filters.push(`u.contract_id = $${params.push(req.user.contractId)}`);
    }
    if (employeeId) filters.push(`so.assigned_employee_id = $${params.push(parseInt(employeeId, 10))}`);
    if (unitId)     filters.push(`so.unit_id = $${params.push(parseInt(unitId, 10))}`);

    const result = await db.query(
      `SELECT
         so.id, so.title, so.description, so.status,
         so.scheduled_date, so.due_time,
         so.started_at, so.finished_at,
         so.problem_description, so.issue_description,
         so.employee_posto,
         e.full_name, e.badge_number,
         u.name AS unit_name, u.address AS unit_address
       FROM service_orders so
       LEFT JOIN employees e ON e.id = so.assigned_employee_id
       JOIN units u ON u.id = so.unit_id
       WHERE so.scheduled_date BETWEEN $1 AND $2
         ${filters.length ? 'AND ' + filters.join(' AND ') : ''}
       ORDER BY so.scheduled_date ASC, so.id ASC`,
      params
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Nenhum serviço encontrado para o período.' });
    }

    // Fotos
    const serviceIds  = result.rows.map((r) => r.id);
    const photosResult = await db.query(
      `SELECT service_order_id, phase, photo_path, latitude, longitude
       FROM service_photos
       WHERE service_order_id = ANY($1)
       ORDER BY service_order_id, created_at ASC`,
      [serviceIds]
    );
    const photosByService = {};
    photosResult.rows.forEach((p) => {
      if (!photosByService[p.service_order_id]) photosByService[p.service_order_id] = [];
      photosByService[p.service_order_id].push(p);
    });

    // Pré-carrega buffers com concorrência limitada
    const photoQueue = [];
    const photoBufferCache = {};
    for (const svc of result.rows) {
      const photos = photosByService[svc.id] || [];
      const toLoad = [
        ...photos.filter((p) => p.phase === 'before').slice(0, 2),
        ...photos.filter((p) => p.phase === 'after').slice(0, 2),
      ];
      for (const p of toLoad) {
        if (photoBufferCache[p.photo_path] === undefined) {
          photoBufferCache[p.photo_path] = null;
          photoQueue.push(p.photo_path);
        }
      }
    }
    const CONCURRENCY = 8;
    for (let i = 0; i < photoQueue.length; i += CONCURRENCY) {
      const batch = photoQueue.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map((key) =>
        storage.getBuffer(key)
          .then((buf) => { photoBufferCache[key] = buf; })
          .catch(() => { photoBufferCache[key] = null; })
      ));
    }

    const STATUS_LABEL = {
      pending:          'Pendente',
      in_progress:      'Em andamento',
      done:             'Concluído',
      done_with_issues: 'Concluído c/ ressalvas',
      problem:          'Problema',
    };

    const fmtDate = (d) => {
      const dt = new Date(d);
      return `${String(dt.getUTCDate()).padStart(2,'0')}/${String(dt.getUTCMonth()+1).padStart(2,'0')}/${dt.getUTCFullYear()}`;
    };
    const fmtTs = (ts) => ts ? new Date(ts).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';

    // Monta seções do documento
    const children = [];

    // Título do relatório
    children.push(
      new Paragraph({
        text: 'RELATÓRIO DE ORDENS DE SERVIÇO',
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        children: [new TextRun({ text: `Período: ${startDate.split('-').reverse().join('/')} a ${endDate.split('-').reverse().join('/')}`, color: '444444', size: 22 })],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        children: [new TextRun({ text: `Gerado em: ${new Date().toLocaleString('pt-BR')}`, color: '888888', size: 18 })],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({ text: '' }),
    );

    for (const svc of result.rows) {
      const photos      = photosByService[svc.id] || [];
      const beforePhotos = photos.filter((p) => p.phase === 'before').slice(0, 2);
      const afterPhotos  = photos.filter((p) => p.phase === 'after').slice(0, 2);

      // Título do serviço
      children.push(
        new Paragraph({
          children: [new TextRun({ text: svc.title, bold: true, size: 26, color: '0f172a' })],
          spacing: { before: 300, after: 60 },
        }),
      );

      // Metadados em tabela 2 colunas
      const metaRows = [
        ['Funcionário',  svc.full_name || '—'],
        ['Matrícula',    svc.badge_number || '—'],
        ['Unidade',      svc.unit_name],
        ['Posto',        svc.employee_posto || svc.unit_name],
        ['Status',       STATUS_LABEL[svc.status] || svc.status],
        ['Agendado',     fmtDate(svc.scheduled_date) + (svc.due_time ? ' às ' + svc.due_time.slice(0,5) : '')],
        ['Início',       fmtTs(svc.started_at)],
        ['Conclusão',    fmtTs(svc.finished_at)],
      ];
      if (svc.description)         metaRows.push(['Descrição',  svc.description]);
      if (svc.problem_description) metaRows.push(['Problema',   svc.problem_description]);
      if (svc.issue_description)   metaRows.push(['Ressalvas',  svc.issue_description]);

      const metaTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: metaRows.map(([label, value]) => new TableRow({
          children: [
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.SOLID, color: 'f1f5f9' },
              children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20, color: '334155' })] })],
            }),
            new TableCell({
              width: { size: 80, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ children: [new TextRun({ text: String(value || '—'), size: 20 })] })],
            }),
          ],
        })),
      });

      children.push(metaTable, new Paragraph({ text: '' }));

      // Fotos — Antes
      if (beforePhotos.length) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'Fotos — Antes:', bold: true, size: 20, color: '64748b' })] }));
        for (const p of beforePhotos) {
          const buf = photoBufferCache[p.photo_path];
          if (buf) {
            children.push(new Paragraph({
              children: [new ImageRun({ data: buf, transformation: { width: 400, height: 300 }, type: 'jpg' })],
              spacing: { after: 120 },
            }));
          }
        }
      }

      // Fotos — Depois
      if (afterPhotos.length) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'Fotos — Depois:', bold: true, size: 20, color: '64748b' })] }));
        for (const p of afterPhotos) {
          const buf = photoBufferCache[p.photo_path];
          if (buf) {
            children.push(new Paragraph({
              children: [new ImageRun({ data: buf, transformation: { width: 400, height: 300 }, type: 'jpg' })],
              spacing: { after: 120 },
            }));
          }
        }
      }

      // Separador
      children.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' } },
        spacing: { before: 200, after: 200 },
        text: '',
      }));
    }

    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);

    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.set('Content-Disposition', `attachment; filename="servicos_${startDate}_${endDate}.docx"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

module.exports = { exportPdf, exportExcel, exportServicesPdf, exportServicesExcel, exportServicesDocx };
