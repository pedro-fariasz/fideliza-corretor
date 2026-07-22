const express = require('express');
const c = require('../controllers/desempenhoController');

const router = express.Router();

// Leitura (o gate 'desempenho','ler' é aplicado no mount em app.js).
router.get('/', c.painel);
router.get('/vendedores', c.vendedores);

module.exports = router;
