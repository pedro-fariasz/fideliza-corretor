const authService = require('../services/authService');

// POST /api/auth/signup/corretor  (público)
async function signupCorretor(req, res, next) {
  try {
    const { nome, email, senha } = req.body || {};
    const result = await authService.signupCorretor({ nome, email, senha });
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
}

// POST /api/auth/signup/equipe  (público)
async function signupEquipe(req, res, next) {
  try {
    const { nome, email, senha } = req.body || {};
    const result = await authService.signupEquipe({ nome, email, senha });
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
}

// GET /api/auth/me  (autenticado — responde mesmo se pendente)
async function me(req, res) {
  return res.json({
    id: req.user.id,
    email: req.user.email,
    nome: req.user.nome,
    role: req.user.role,
    status: req.user.status,
    tenant_id: req.user.tenantId,
  });
}

module.exports = { signupCorretor, signupEquipe, me };
