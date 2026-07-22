// =============================================================================
// biCarteiraService — orquestra o BI de Carteira com o banco.
//   - recalcular(tenant): job noturno grava snapshots por corretor + conta,
//     em cada período, na carteira_agregados.
//   - obter(tenant, filtros, user): resolve o escopo do usuário, lê os
//     snapshots, mescla, finaliza e gera insights. Cache de 15 min + fallback
//     lazy (calcula na hora se o job ainda não rodou).
//
// Escopo hierárquico via recurso 'bi_carteira' (herda a Fase 0). Isolamento por
// tenant_id em toda query.
// =============================================================================
const apolicesRepository = require('../repositories/apolicesRepository');
const carteiraClientesRepository = require('../repositories/carteiraClientesRepository');
const produtosRepository = require('../repositories/produtosRepository');
const comissoesRepository = require('../repositories/comissoesRepository');
const interacoesRepository = require('../repositories/interacoesRepository');
const biRepo = require('../repositories/biCarteiraRepository');
const metrics = require('./biCarteiraMetrics');
const insights = require('./biInsightsService');
const { resolverDonoIds } = require('./escopoService');

const PERIODOS = ['30d', '90d', '6m', '1a', 'tudo'];
const PERIODO_PADRAO = '90d';
const CACHE_TTL_MS = 15 * 60 * 1000;

const hojeISO = () => new Date().toISOString().slice(0, 10);
function addDays(dataISO, dias) {
  const d = new Date(`${String(dataISO).slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
function periodoParaDe(periodo, hoje) {
  switch (periodo) {
    case '30d': return addDays(hoje, -30);
    case '90d': return addDays(hoje, -90);
    case '6m': return addDays(hoje, -180);
    case '1a': return addDays(hoje, -365);
    default: return '2000-01-01';
  }
}

// --- Cache simples em memória (15 min por combinação de filtro) ---------------
const cache = new Map();
function cacheGet(chave) {
  const e = cache.get(chave);
  if (!e || e.expira < Date.now()) { cache.delete(chave); return null; }
  return e.valor;
}
function cacheSet(chave, valor) {
  cache.set(chave, { valor, expira: Date.now() + CACHE_TTL_MS });
}

// --- Carrega os dados crus do tenant (uma passada) ---------------------------
async function carregarDados(tenantId) {
  const [apolices, clientes, produtos, comissoes, interacoesMap] = await Promise.all([
    apolicesRepository.list(tenantId, {}),
    carteiraClientesRepository.list(tenantId, {}),
    produtosRepository.list(tenantId, {}),
    comissoesRepository.list(tenantId, {}),
    interacoesRepository.latestPorLead(tenantId),
  ]);
  // interação recente por CLIENTE (via lead_id do cliente)
  const interacaoRecentePorCliente = {};
  for (const c of clientes) {
    if (c.lead_id && interacoesMap[c.lead_id]) interacaoRecentePorCliente[c.id] = interacoesMap[c.lead_id];
  }
  return { apolices, clientes, produtos, comissoes, interacaoRecentePorCliente };
}

// --- Constrói um snapshot (corretorId nulo = conta inteira) -------------------
function construirSnapshot(dados, corretorId, periodo, hoje) {
  const apsCorretor = corretorId ? dados.apolices.filter((a) => a.corretor_id === corretorId) : dados.apolices;
  const vendaIds = new Set(apsCorretor.map((a) => a.venda_id).filter(Boolean));
  const clienteIds = new Set(apsCorretor.map((a) => a.cliente_id));
  return metrics.snapshotDeCorretor({
    apolices: apsCorretor,
    clientes: dados.clientes.filter((c) => clienteIds.has(c.id)),
    comissoes: dados.comissoes.filter((c) => vendaIds.has(c.venda_id)),
    produtos: dados.produtos,
    interacaoRecentePorCliente: dados.interacaoRecentePorCliente,
    de: periodoParaDe(periodo, hoje),
    ate: hoje,
    hoje,
  });
}

// --- JOB: recalcula e grava todos os snapshots do tenant ---------------------
async function recalcular(tenantId) {
  const dados = await carregarDados(tenantId);
  const hoje = hojeISO();
  const corretorIds = Array.from(new Set(dados.apolices.map((a) => a.corretor_id).filter(Boolean)));
  const referencia_mes = hoje.slice(0, 7);

  const linhas = [];
  for (const periodo of PERIODOS) {
    // conta inteira
    const contaSnap = construirSnapshot(dados, null, periodo, hoje);
    const contaFinal = metrics.finalizar(metrics.mergeSnapshots([contaSnap]), hoje);
    linhas.push({ corretor_id: null, periodo, referencia_mes, metricas: contaFinal.metricas, dados_json: contaSnap });
    // por corretor
    for (const cid of corretorIds) {
      const snap = construirSnapshot(dados, cid, periodo, hoje);
      const fin = metrics.finalizar(metrics.mergeSnapshots([snap]), hoje);
      linhas.push({ corretor_id: cid, periodo, referencia_mes, metricas: fin.metricas, dados_json: snap });
    }
  }

  await biRepo.deleteSnapshots(tenantId);
  await biRepo.insertMany(tenantId, linhas);
  return { snapshots: linhas.length, corretores: corretorIds.length, periodos: PERIODOS.length };
}

// --- Resolve o alvo (corretorIds) conforme escopo pedido + permissão ---------
async function resolverAlvo(user, escopoReq, corretorIdReq) {
  const perm = user ? await resolverDonoIds(user, 'bi_carteira', 'ler') : null; // null|[]|[ids]
  if (Array.isArray(perm) && perm.length === 0) return { corretorIds: [], escopo: 'nenhum' };

  if (corretorIdReq) {
    if (perm === null || perm.includes(corretorIdReq)) return { corretorIds: [corretorIdReq], escopo: 'corretor' };
    return { corretorIds: [], escopo: 'nenhum' };
  }

  const escopo = escopoReq || (perm === null ? 'empresa' : 'meus');
  if (escopo === 'meus') return { corretorIds: [user.id], escopo };
  if (escopo === 'empresa' || escopo === 'equipe') {
    if (perm === null) return { corretorIds: null, escopo }; // conta inteira (snapshot da conta)
    return { corretorIds: perm, escopo };
  }
  return { corretorIds: perm === null ? null : perm, escopo: 'empresa' };
}

// --- Leitura (com cache + fallback lazy) -------------------------------------
async function obter(tenantId, filtros, user) {
  const periodo = PERIODOS.includes(filtros.periodo) ? filtros.periodo : PERIODO_PADRAO;
  const { corretorIds, escopo } = await resolverAlvo(user, filtros.escopo, filtros.corretor_id);

  if (escopo === 'nenhum') {
    return { escopo: 'nenhum', periodo, ...vazio() };
  }

  const scopeKey = corretorIds === null ? 'CONTA' : [...corretorIds].sort().join(',') || 'VAZIO';
  const chaveCache = `${tenantId}|${periodo}|${scopeKey}`;
  const cacheado = cacheGet(chaveCache);
  if (cacheado) return cacheado;

  // Lê snapshots gravados pelo job.
  let snaps = (await biRepo.list(tenantId, { periodo, corretorIds })).map((r) => r.dados_json).filter(Boolean);

  // Fallback lazy: job ainda não rodou -> calcula na hora (sem gravar).
  if (snaps.length === 0) {
    const dados = await carregarDados(tenantId);
    const hoje = hojeISO();
    if (corretorIds === null) snaps = [construirSnapshot(dados, null, periodo, hoje)];
    else snaps = corretorIds.map((cid) => construirSnapshot(dados, cid, periodo, hoje));
  }

  const payload = metrics.finalizar(metrics.mergeSnapshots(snaps), hojeISO());
  const resultado = {
    escopo,
    periodo,
    ...payload,
    insights: insights.gerar(payload),
  };
  cacheSet(chaveCache, resultado);
  return resultado;
}

function vazio() {
  const p = metrics.finalizar(metrics.mergeSnapshots([]), hojeISO());
  return { ...p, insights: [] };
}

// Invalida o cache do tenant (usado após o job). Best-effort.
function invalidarCache(tenantId) {
  for (const k of cache.keys()) if (k.startsWith(`${tenantId}|`)) cache.delete(k);
}

module.exports = { recalcular, obter, invalidarCache, PERIODOS };
