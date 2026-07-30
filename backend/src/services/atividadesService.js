const atividadesRepository = require('../repositories/atividadesRepository');

// Valores do CHECK da coluna atividades.entidade (migration 013).
const ENTIDADES = ['lead', 'cliente', 'venda', 'apolice', 'plataforma', 'tag', 'sistema'];

const LIMIT_PADRAO = 20;
const LIMIT_MAX = 100;
// Aceita 'YYYY-MM-DD' ou ISO completo — filtro aplicado sobre criado_em.
const DATA_RE = /^\d{4}-\d{2}-\d{2}/;

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

function clampLimit(raw) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return LIMIT_PADRAO;
  return Math.min(n, LIMIT_MAX);
}

// Feed cronológico do tenant (aba Inteligência). tenantId SEMPRE vem do JWT
// (controller) — nunca do body/query. Filtros opcionais são sanitizados aqui.
async function listar(tenantId, filtros = {}) {
  const limit = clampLimit(filtros.limit);
  const entidade =
    filtros.entidade && ENTIDADES.includes(filtros.entidade) ? filtros.entidade : undefined;
  const entidadeId = filtros.entidade_id ? String(filtros.entidade_id) : undefined;
  const de = DATA_RE.test(filtros.de || '') ? filtros.de : undefined;
  const ate = DATA_RE.test(filtros.ate || '') ? filtros.ate : undefined;

  return atividadesRepository.list(tenantId, { limit, entidade, entidadeId, de, ate });
}

module.exports = { registrar, listar, ENTIDADES };
