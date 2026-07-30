const express = require('express');
const atividadesController = require('../controllers/atividadesController');

const router = express.Router();

router.get('/', atividadesController.listar);

module.exports = router;
