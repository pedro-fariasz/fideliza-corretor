// =============================================================================
// Middlewares de autorização por papel/status.
// Rodam SEMPRE depois do authMiddleware (que popula req.user).
// =============================================================================

// Bloqueia funcionário ainda 'pendente' (ou 'recusado'/'suspenso').
function requireAtivo(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
  if (req.user.status !== 'ativo') {
    return res.status(403).json({
      error: 'Seu cadastro está pendente de aprovação de um administrador.',
      status: req.user.status,
    });
  }
  return next();
}

// Equipe interna ativa (funcionário ou admin) — acesso ao painel interno.
function requireInternal(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
  if (req.user.status !== 'ativo') {
    return res.status(403).json({
      error: 'Seu cadastro está pendente de aprovação de um administrador.',
      status: req.user.status,
    });
  }
  if (!['funcionario', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Acesso restrito à equipe interna.' });
  }
  return next();
}

// Admin interno — aprovar/recusar funcionários.
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
  if (req.user.role !== 'admin' || req.user.status !== 'ativo') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  return next();
}

module.exports = { requireAtivo, requireInternal, requireAdmin };
