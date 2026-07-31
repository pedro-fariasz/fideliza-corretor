const express = require('express');
const tenantsController = require('../controllers/tenantsController');

const router = express.Router();

router.get('/me', tenantsController.me);

module.exports = router;
