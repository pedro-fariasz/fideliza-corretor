const atividadesService = require('../services/atividadesService');

// GET /api/atividades — feed de atividades do tenant (aba Inteligência).
// tenant_id vem SEMPRE do JWT (req.tenantId), nunca da query/body.
async function listar(req, res, next) {
  try {
    const filtros = {
      limit: req.query.limit,
      entidade: req.query.entidade ? String(req.query.entidade) : undefined,
      entidade_id: req.query.entidade_id ? String(req.query.entidade_id) : undefined,
      de: req.query.de ? String(req.query.de) : undefined,
      ate: req.query.ate ? String(req.query.ate) : undefined,
    };
    const atividades = await atividadesService.listar(req.tenantId, filtros);
    return res.json(atividades);
  } catch (err) {
    return next(err);
  }
}

module.exports = { listar };
