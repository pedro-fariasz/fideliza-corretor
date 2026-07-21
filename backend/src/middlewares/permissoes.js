// =============================================================================
// requirePermissao — gate de acesso por (recurso, acao), checado no servidor.
// Roda sempre depois de authMiddleware (que popula req.user). Retorna 403
// (não redirect silencioso) quando o usuário não tem o recurso.
// =============================================================================
const { pode } = require('../config/permissoes');

function requirePermissao(recurso, acao = 'ler') {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
    if (!pode(req.user, recurso, acao)) {
      return res.status(403).json({ error: 'Você não tem permissão para acessar este recurso.' });
    }
    return next();
  };
}

module.exports = { requirePermissao };
