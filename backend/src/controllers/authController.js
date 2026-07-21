const authService = require('../services/authService');
const usersRepository = require('../repositories/usersRepository');
const { FEATURE_FLAGS } = require('../config/constants');
const { perfilEfetivo, podeVerValores } = require('../config/permissoes');

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
  // Registra o último acesso (fire-and-forget: não trava o /me).
  usersRepository.setUltimoAcesso(req.user.id).catch((e) =>
    console.error('[auth.me] falha ao gravar ultimo_acesso', { id: req.user.id, error: e.message })
  );

  return res.json({
    id: req.user.id,
    email: req.user.email,
    nome: req.user.nome,
    role: req.user.role,
    status: req.user.status,
    tenant_id: req.user.tenantId,
    papel_conta: req.user.papel_conta,
    cargo: req.user.cargo,
    perfil_efetivo: perfilEfetivo(req.user),
    pode_ver_valores: podeVerValores(req.user),
    flags: {
      equipe: FEATURE_FLAGS.equipe,
      carteira: FEATURE_FLAGS.carteira,
      posvendas: FEATURE_FLAGS.posvendas,
      bi_carteira: FEATURE_FLAGS.bi_carteira,
      desempenho: FEATURE_FLAGS.desempenho,
    },
  });
}

module.exports = { signupCorretor, signupEquipe, me };
