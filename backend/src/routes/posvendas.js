const express = require('express');
const c = require('../controllers/posvendasController');
const { requirePermissao } = require('../middlewares/permissoes');

const router = express.Router();

const escrever = requirePermissao('posvendas', 'escrever');

// Leitura (o gate 'posvendas','ler' é aplicado no mount em app.js).
router.get('/categorias', c.categorias);
router.get('/pipeline', c.pipeline);
router.get('/lista', c.lista);
router.get('/apolices/:id/cross-sell', c.crossSell);
router.get('/apolices/:id/mensagem', c.mensagem);
router.get('/fluxos/:categoria', c.fluxo);
router.get('/mensagens/:categoria', c.mensagens);

// Escrita.
router.post('/apolices/:id/feito', escrever, c.marcarFeito);
router.post('/fluxos/:categoria/etapas', escrever, c.criarEtapa);
router.patch('/etapas/:id', escrever, c.atualizarEtapa);
router.post('/fluxos/:categoria/restaurar', escrever, c.restaurarFluxo);
router.put('/mensagens/:categoria/:etapa', escrever, c.salvarMensagem);
router.post('/mensagens/:categoria/:etapa/redefinir', escrever, c.redefinirMensagem);

module.exports = router;
