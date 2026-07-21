const express = require('express');
const comissoesController = require('../controllers/comissoesController');
const { requirePermissao } = require('../middlewares/permissoes');

const router = express.Router();

const escrever = requirePermissao('comissoes', 'escrever');

router.get('/', comissoesController.listar); // "a receber por mês" (filtros de data/status)
router.patch('/:id/receber', escrever, comissoesController.receber);
router.patch('/:id/estornar', escrever, comissoesController.estornar);

module.exports = router;
