const express = require('express');
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middlewares/auth');

const router = express.Router();

// Cadastro — públicos (o usuário ainda não tem token).
router.post('/signup/corretor', authController.signupCorretor);
router.post('/signup/equipe', authController.signupEquipe);

// Perfil do usuário logado — autenticado (responde mesmo se pendente, para o
// frontend saber que precisa mostrar a tela de "aguardando aprovação").
router.get('/me', authMiddleware, authController.me);

module.exports = router;
