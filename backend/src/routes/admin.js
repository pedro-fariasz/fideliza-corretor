const express = require('express');
const adminController = require('../controllers/adminController');
const { requireInternal, requireAdmin } = require('../middlewares/roles');

// Montado depois do authMiddleware global de /api (req.user já existe).
const router = express.Router();

// Aprovação de funcionários — só admin.
router.get('/equipe/pendentes', requireAdmin, adminController.listarPendentes);
router.post('/equipe/:id/aprovar', requireAdmin, adminController.aprovar);
router.post('/equipe/:id/recusar', requireAdmin, adminController.recusar);

// Painel interno cross-tenant — funcionário ou admin (ativos).
router.get('/relatorio/clientes', requireInternal, adminController.relatorioClientes);

module.exports = router;
