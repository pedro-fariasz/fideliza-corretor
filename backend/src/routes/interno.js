const express = require('express');
const internoController = require('../controllers/internoController');
const { requireInternal } = require('../middlewares/roles');

// =============================================================================
// Rotas /api/interno/* — painel interno cross-tenant da equipe Fideliza.
// Montado depois do authMiddleware global de /api (req.user já existe).
// requireInternal já EXISTE em middlewares/roles.js (role funcionario/admin +
// status ativo) — reaproveitado aqui, NÃO duplicado, para o gate de segurança
// viver num único lugar.
// =============================================================================
const router = express.Router();

router.get('/resumo', requireInternal, internoController.resumo);
router.get('/clientes', requireInternal, internoController.clientes);

module.exports = router;
