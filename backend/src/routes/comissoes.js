const express = require('express');
const comissoesController = require('../controllers/comissoesController');

const router = express.Router();

router.get('/', comissoesController.listar); // "a receber por mês" (filtros de data/status)
router.patch('/:id/receber', comissoesController.receber);
router.patch('/:id/estornar', comissoesController.estornar);

module.exports = router;
