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

module.exports = { listarPendentes, aprovar, recusar, relatorioClientes };
