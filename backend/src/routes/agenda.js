const express = require('express');
const agendaController = require('../controllers/agendaController');
const { requirePermissao } = require('../middlewares/permissoes');

const router = express.Router();

const escrever = requirePermissao('agenda', 'escrever');

router.post('/', escrever, agendaController.criar);
router.get('/', agendaController.listar); // ?de&ate&equipe&lead_id
router.get('/:id', agendaController.obter);
router.put('/:id', escrever, agendaController.atualizar);
router.delete('/:id', escrever, agendaController.remover);

module.exports = router;
