const adminService = require('../services/adminService');

// GET /api/admin/equipe/pendentes  (admin)
async function listarPendentes(req, res, next) {
  try {
    const pendentes = await adminService.listarPendentes();
    return res.json(pendentes);
  } catch (err) {
    return next(err);
  }
}

// POST /api/admin/equipe/:id/aprovar  (admin)
async function aprovar(req, res, next) {
  try {
    const atualizado = await adminService.aprovar(req.user.id, req.params.id);
    return res.json(atualizado);
  } catch (err) {
    return next(err);
  }
}

// POST /api/admin/equipe/:id/recusar  (admin)
async function recusar(req, res, next) {
  try {
    const atualizado = await adminService.recusar(req.user.id, req.params.id);
    return res.json(atualizado);
  } catch (err) {
    return next(err);
  }
}

// GET /api/admin/relatorio/clientes  (equipe interna — cross-tenant)
async function relatorioClientes(req, res, next) {
  try {
    const filters = {
      status: req.query.status || undefined,
      operadora: req.query.operadora || undefined,
      incompletos: req.query.incompletos === 'true' || undefined,
      tenantId: req.query.tenant_id || undefined,
    };
    const result = await adminService.relatorioClientes(filters);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = { listarPendentes, aprovar, recusar, relatorioClientes };
