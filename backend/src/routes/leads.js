const express = require('express');
const leadsController = require('../controllers/leadsController');

const router = express.Router();

router.post('/', leadsController.criar);
router.get('/', leadsController.listar);
router.get('/:id', leadsController.obter);
router.put('/:id', leadsController.atualizar);

// Funil e timeline
router.patch('/:id/estagio', leadsController.mudarEstagio);
router.patch('/:id/status', leadsController.mudarStatus); // ativo | perdido
router.get('/:id/interacoes', leadsController.listarInteracoes);
router.post('/:id/interacoes', leadsController.registrarInteracao);

module.exports = router;
