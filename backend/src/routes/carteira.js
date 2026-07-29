const express = require('express');
const carteiraController = require('../controllers/carteiraController');
const { requirePermissao } = require('../middlewares/permissoes');

const router = express.Router();

const escrever = requirePermissao('carteira', 'escrever');

// Leitura (o gate 'carteira','ler' é aplicado no mount em app.js).
router.get('/pipeline', carteiraController.pipeline);
router.get('/metricas', carteiraController.metricas);
router.get('/apolices', carteiraController.listar);
router.get('/apolices/:id', carteiraController.obter);

// Escrita.
router.post('/negocio-avulso', escrever, carteiraController.negocioAvulso);
router.post('/apolices/:id/renovar', escrever, carteiraController.renovar);
router.patch('/apolices/:id/cancelar', escrever, carteiraController.cancelar);
router.post('/:id/cancelar', escrever, carteiraController.cancelarCliente);

module.exports = router;
