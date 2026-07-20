const adminService = require('../services/adminService');

// =============================================================================
// internoController — endpoints do painel interno da equipe Fideliza.
// Sempre atrás de requireInternal (role funcionario/admin + status ativo).
// A leitura cross-tenant é a exceção autorizada (ver internalRepository + CLAUDE.md).
// =============================================================================

// GET /api/interno/resumo → resumoPorTenant()
async function resumo(req, res, next) {
  try {
    const data = await adminService.resumoInterno();
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

// GET /api/interno/clientes → listAllClientes(filters) + disparos por canal
// Filtros via query string: status, operadora, incompletos, tenantId.
function parseFiltros(query) {
  const filtros = {};
  if (query.status) filtros.status = String(query.status);
  if (query.operadora) filtros.operadora = String(query.operadora);
  if (query.incompletos === 'true' || query.incompletos === '1') {
    filtros.incompletos = true;
  }
  // aceita tanto tenantId quanto tenant_id (compatibilidade com o restante da API).
  const tenantId = query.tenantId || query.tenant_id;
  if (tenantId) filtros.tenantId = String(tenantId);
  return filtros;
}

async function clientes(req, res, next) {
  try {
    const filtros = parseFiltros(req.query);
    const data = await adminService.clientesInterno(filtros);
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

module.exports = { resumo, clientes };
