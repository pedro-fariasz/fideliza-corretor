const usersRepository = require('../repositories/usersRepository');
const internalRepository = require('../repositories/internalRepository');

// =============================================================================
// adminService — aprovação de funcionários e painel interno cross-tenant.
// Todas as chamadas aqui presumem que o middleware de role já validou o acesso.
// =============================================================================

async function listarPendentes() {
  return usersRepository.listPendentes();
}

async function aprovar(adminId, userId) {
  const atualizado = await usersRepository.setStatusInterno(userId, 'ativo', adminId);
  if (!atualizado) {
    const err = new Error('Funcionário não encontrado.');
    err.statusCode = 404;
    throw err;
  }
  return atualizado;
}

async function recusar(adminId, userId) {
  const atualizado = await usersRepository.setStatusInterno(userId, 'recusado', adminId);
  if (!atualizado) {
    const err = new Error('Funcionário não encontrado.');
    err.statusCode = 404;
    throw err;
  }
  return atualizado;
}

// Painel interno: leitura cross-tenant (exceção autorizada — ver
// internalRepository e CLAUDE.md).
async function relatorioClientes(filters) {
  const [clientes, resumo] = await Promise.all([
    internalRepository.listAllClientes(filters),
    internalRepository.resumoPorTenant(),
  ]);
  return { clientes, resumo };
}

// --- Painel interno v2 — endpoints /api/interno/* ---------------------------
// Reaproveitam internalRepository (não recriam a leitura cross-tenant).

// GET /api/interno/resumo → resumo agregado por corretor (tenant).
async function resumoInterno() {
  return internalRepository.resumoPorTenant();
}

// GET /api/interno/clientes → clientes cross-tenant + contagem de disparos por
// canal embutida em cada card. Filtros: status, operadora, incompletos, tenantId.
async function clientesInterno(filters = {}) {
  const [clientes, disparos] = await Promise.all([
    internalRepository.listAllClientes(filters),
    internalRepository.contagemDisparos({ tenantId: filters.tenantId }),
  ]);
  return clientes.map((c) => ({
    ...c,
    disparos: disparos[c.id] || { whatsapp: 0, email: 0 },
  }));
}

module.exports = {
  listarPendentes,
  aprovar,
  recusar,
  relatorioClientes,
  resumoInterno,
  clientesInterno,
};
