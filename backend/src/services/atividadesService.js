const atividadesRepository = require('../repositories/atividadesRepository');

// Audit log de negócio (migration 013) — nunca deve derrubar o fluxo principal
// que a chamou. Falha loga com contexto e segue.
async function registrar(tenantId, payload) {
  try {
    return await atividadesRepository.create(tenantId, payload);
  } catch (err) {
    console.error('[atividadesService] falha ao registrar atividade', {
      tenant_id: tenantId,
      entidade: payload && payload.entidade,
      acao: payload && payload.acao,
      error: err.message,
    });
    return null;
  }
}

module.exports = { registrar };
