const express = require('express');
const vendasController = require('../controllers/vendasController');

const router = express.Router();

router.post('/', vendasController.criar); // nasce do funil (Venda Concluída)
router.get('/', vendasController.listar);
router.get('/:id', vendasController.obter); // venda + parcelas de comissão
router.patch('/:id/cancelar', vendasController.cancelar);

module.exports = router;
