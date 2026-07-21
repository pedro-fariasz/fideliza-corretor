const express = require('express');
const equipeController = require('../controllers/equipeController');
const { requirePermissao } = require('../middlewares/permissoes');

const router = express.Router();

// Todo o módulo de equipe exige permissão de 'usuarios' (só administrador).
router.get('/', requirePermissao('usuarios', 'ler'), equipeController.listar);
router.post('/corretor', requirePermissao('usuarios', 'escrever'), equipeController.criarCorretor);
router.post('/secretaria', requirePermissao('usuarios', 'escrever'), equipeController.criarSecretaria);
router.put('/:id', requirePermissao('usuarios', 'escrever'), equipeController.editar);
router.patch('/:id/desativar', requirePermissao('usuarios', 'escrever'), equipeController.desativar);

module.exports = router;
