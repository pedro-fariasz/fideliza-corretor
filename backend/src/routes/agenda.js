const express = require('express');
const agendaController = require('../controllers/agendaController');

const router = express.Router();

router.post('/', agendaController.criar);
router.get('/', agendaController.listar); // ?de&ate&equipe&lead_id
router.get('/:id', agendaController.obter);
router.put('/:id', agendaController.atualizar);
router.delete('/:id', agendaController.remover);

module.exports = router;
