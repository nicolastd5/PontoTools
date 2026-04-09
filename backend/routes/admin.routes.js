const express  = require('express');
const router   = express.Router();

const controller        = require('../controllers/admin.controller');
const exportController  = require('../controllers/export.controller');
const auth              = require('../middleware/auth');
const { requireAdmin }  = require('../middleware/roleGuard');

router.use(auth, requireAdmin);

// Dashboard
router.get('/dashboard',           controller.getDashboard);
router.get('/dashboard/absences',  controller.getAbsences);

// Registros de ponto
router.get('/clocks',              controller.getClocks);
router.get('/clocks/:id/photo',    controller.getClockPhoto);

// Tentativas bloqueadas
router.get('/blocked',             controller.getBlocked);

// Logs de auditoria
router.get('/audit-logs',          controller.getAuditLogs);

// Exportações
router.get('/export/pdf',          exportController.exportPdf);
router.get('/export/excel',        exportController.exportExcel);

module.exports = router;
