const express = require('express');
const vendasController = require('../controllers/vendasController');
const { requirePermissao } = require('../middlewares/permissoes');

const router = express.Router();

const escrever = requirePermissao('vendas', 'escrever');

router.post('/', escrever, vendasController.criar); // nasce do funil (Venda Concluída)
router.get('/', vendasController.listar);
router.get('/:id', vendasController.obter); // venda + parcelas de comissão
router.patch('/:id/cancelar', escrever, vendasController.cancelar);

module.exports = router;
