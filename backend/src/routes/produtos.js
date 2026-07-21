const express = require('express');
const produtosController = require('../controllers/produtosController');

const router = express.Router();

router.post('/', produtosController.criar);
router.get('/', produtosController.listar);
router.get('/:id', produtosController.obter);
router.put('/:id', produtosController.atualizar);
router.delete('/:id', produtosController.remover); // desativa (soft)

module.exports = router;
