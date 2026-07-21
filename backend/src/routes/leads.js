const express = require('express');
const leadsController = require('../controllers/leadsController');
const { requirePermissao } = require('../middlewares/permissoes');

const router = express.Router();

const escrever = requirePermissao('leads', 'escrever');

router.post('/', escrever, leadsController.criar);
router.get('/', leadsController.listar);
router.get('/:id', leadsController.obter);
router.put('/:id', escrever, leadsController.atualizar);

// Funil e timeline
router.patch('/:id/estagio', escrever, leadsController.mudarEstagio);
router.patch('/:id/status', escrever, leadsController.mudarStatus); // ativo | perdido
router.get('/:id/interacoes', leadsController.listarInteracoes);
router.post('/:id/interacoes', escrever, leadsController.registrarInteracao);

module.exports = router;
