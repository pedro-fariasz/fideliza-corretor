const express = require('express');
const c = require('../controllers/biCarteiraController');

const router = express.Router();

// Leitura (o gate 'bi_carteira','ler' é aplicado no mount em app.js).
router.get('/', c.painel);
router.get('/corretores', c.corretores);

module.exports = router;
