const dashboardService = require('../services/dashboardService');

async function obter(req, res, next) {
  try {
    const filtros = {
      de: req.query.de ? String(req.query.de) : undefined,
      ate: req.query.ate ? String(req.query.ate) : undefined,
    };
    // "meus" números = do usuário logado (senão, a conta inteira).
    if (req.query.meus === 'true' || req.query.meus === '1') filtros.donoId = req.user.id;

    const dashboard = await dashboardService.obter(req.tenantId, filtros, req.user);
    return res.json(dashboard);
  } catch (err) {
    return next(err);
  }
}

module.exports = { obter };
