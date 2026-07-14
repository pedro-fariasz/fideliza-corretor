const express = require('express');
const clientesController = require('../controllers/clientesController');

const router = express.Router();

router.post('/', clientesController.criar);
router.get('/', clientesController.listar);
router.get('/:id', clientesController.obter);
router.put('/:id', clientesController.atualizar);
router.delete('/:id', clientesController.remover);

module.exports = router;
