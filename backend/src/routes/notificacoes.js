const express = require('express');
const notificacoesController = require('../controllers/notificacoesController');

const router = express.Router();

router.get('/', notificacoesController.listar);
router.get('/pendentes', notificacoesController.pendentes);
router.get('/badge', notificacoesController.badge);
router.post('/:id/marcar-enviada', notificacoesController.marcarEnviada);
router.post('/:id/marcar-visualizada', notificacoesController.marcarVisualizada);
router.post('/:id/descartar', notificacoesController.descartar);

module.exports = router;
