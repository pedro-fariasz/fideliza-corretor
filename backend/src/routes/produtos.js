const express = require('express');
const produtosController = require('../controllers/produtosController');
const { requirePermissao } = require('../middlewares/permissoes');

const router = express.Router();

// GET aberto a qualquer usuário ativo (necessário pro formulário de venda).
// Escrita restrita a quem pode gerir produtos (administrador/gerente).
const escrever = requirePermissao('produtos', 'escrever');

router.post('/', escrever, produtosController.criar);
router.get('/', produtosController.listar);
router.get('/:id', produtosController.obter);
router.put('/:id', escrever, produtosController.atualizar);
router.delete('/:id', escrever, produtosController.remover); // desativa (soft)

module.exports = router;
