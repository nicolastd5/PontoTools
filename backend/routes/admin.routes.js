const express  = require('express');
const router   = express.Router();

const controller        = require('../controllers/admin.controller');
const exportController  = require('../controllers/export.controller');
const auth              = require('../middleware/auth');
const { requireAdmin, requireAdminOrGestor } = require('../middleware/roleGuard');

router.use(auth);

// Dashboard — apenas admin
router.get('/dashboard',           requireAdmin, controller.getDashboard);
router.get('/dashboard/absences',  requireAdmin, controller.getAbsences);

// Registros de ponto — admin e gestor (gestor filtrado por contrato)
router.get('/clocks',              requireAdminOrGestor, controller.getClocks);
router.get('/clocks/:id/photo',         requireAdminOrGestor, controller.getClockPhoto);
router.get('/clocks/:id/photos',        requireAdminOrGestor, controller.getClockPhotos);
router.get('/clocks/:id/photos/:photoId', requireAdminOrGestor, controller.getClockExtraPhoto);

// Tentativas bloqueadas — apenas admin
router.get('/blocked',             requireAdmin, controller.getBlocked);

// Logs de auditoria — apenas admin
router.get('/audit-logs',          requireAdmin, controller.getAuditLogs);

// Exportações — apenas admin
router.get('/export/pdf',          requireAdmin, exportController.exportPdf);
router.get('/export/excel',        requireAdmin, exportController.exportExcel);

module.exports = router;
