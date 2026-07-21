// =============================================================================
// carteiraService — reúne os dados da carteira e calcula as 7 métricas + score
// (via carteiraMetricsService, puro e testado) e recalcula o health score.
// Aproximações documentadas onde a reconstrução histórica exata não é viável.
// =============================================================================
const apolicesRepository = require('../repositories/apolicesRepository');
const carteiraClientesRepository = require('../repositories/carteiraClientesRepository');
const comissoesRepository = require('../repositories/comissoesRepository');
const metrics = require('./carteiraMetricsService');
const { resolverDonoIds } = require('./escopoService');

const hoje = () => new Date().toISOString().slice(0, 10);

function noPeriodo(dataISO, de, ate) {
  if (!dataISO) return false;
  const d = String(dataISO).slice(0, 10);
  return d >= de && d <= ate;
}

async function metricas(tenantId, filtros = {}, usuario) {
  const de = filtros.de || '2000-01-01';
  const ate = filtros.ate || hoje();
  const donoIds = usuario ? await resolverDonoIds(usuario, 'carteira', 'ler') : null;

  const apolices = await apolicesRepository.list(tenantId, { donoIds });
  const clientes = await carteiraClientesRepository.list(tenantId, {});

  // clientes que aparecem nas apólices em escopo (para NPS/LTV restritos ao escopo)
  const clienteIdsEmEscopo = new Set(apolices.map((a) => a.cliente_id));
  const clientesEscopo = clientes.filter((c) => clienteIdsEmEscopo.has(c.id));

  const ativas = apolices.filter((a) => a.status === 'ativa');
  const clientesAtivos = new Set(ativas.map((a) => a.cliente_id)).size;

  const vencidasNoPeriodo = apolices.filter((a) => noPeriodo(a.data_vencimento, de, ate)).length;
  const renovadasNoPeriodo = apolices.filter(
    (a) => a.status === 'renovada' && noPeriodo(a.data_vencimento, de, ate)
  ).length;

  const canceladasPeriodo = apolices.filter(
    (a) => a.status === 'cancelada' && noPeriodo(a.atualizado_em, de, ate)
  );
  const clientesCanceladosNoPeriodo = new Set(canceladasPeriodo.map((a) => a.cliente_id)).size;
  // Aproximação: base no início do período ≈ ativos atuais + cancelados no período.
  const clientesAtivosInicioPeriodo = clientesAtivos + clientesCanceladosNoPeriodo;

  const npsList = clientesEscopo.map((c) => c.nps).filter((n) => n != null);

  // Comissões (recebidas + previstas, exclui canceladas) das vendas das apólices.
  const vendaIds = apolices.map((a) => a.venda_id).filter(Boolean);
  let comissaoTotal = 0;
  const ltvPorClienteMap = {};
  if (vendaIds.length) {
    const comissoes = await comissoesRepository.list(tenantId, { vendaIds });
    const vendaToCliente = {};
    for (const a of apolices) if (a.venda_id) vendaToCliente[a.venda_id] = a.cliente_id;
    for (const c of comissoes) {
      if (c.status === 'cancelada') continue;
      const v = Number(c.valor_parcela || 0);
      comissaoTotal += v;
      const cli = vendaToCliente[c.venda_id];
      if (cli) ltvPorClienteMap[cli] = (ltvPorClienteMap[cli] || 0) + v;
    }
  }
  const ltvPorCliente = Object.values(ltvPorClienteMap);

  // TMR: média de dias entre o vencimento da mãe e o início da renovação (filha).
  const maeById = {};
  for (const a of apolices) maeById[a.id] = a;
  const difs = [];
  for (const a of apolices) {
    if (a.apolice_mae_id && maeById[a.apolice_mae_id]) {
      difs.push(metrics.diasEntre(maeById[a.apolice_mae_id].data_vencimento, a.data_inicio));
    }
  }
  const tmrDias = difs.length ? difs.reduce((x, y) => x + y, 0) / difs.length : null;

  const m = metrics.calcularMetricas({
    vencidasNoPeriodo,
    renovadasNoPeriodo,
    clientesAtivos,
    clientesAtivosInicioPeriodo,
    clientesCanceladosNoPeriodo,
    npsList,
    comissaoTotal: Math.round(comissaoTotal * 100) / 100,
    apolicesAtivas: ativas.length,
    ltvPorCliente,
    tmrDias,
  });

  return {
    periodo: { de, ate },
    metricas: m,
    faixa: metrics.faixaScore(m.score_geral),
    base: { apolices_ativas: ativas.length, clientes_ativos: clientesAtivos },
  };
}

// --- Recálculo de health score (job diário + lazy) ---------------------------
// Nota: interações nos últimos 90 dias ficam como 0 nesta fase (dependem do
// vínculo cliente->lead->interações; entram junto com o Pós-Vendas na Fase 2).
async function recalcularHealth(tenantId) {
  const apolices = await apolicesRepository.list(tenantId, {});
  const clientes = await carteiraClientesRepository.list(tenantId, {});
  const clienteById = {};
  for (const c of clientes) clienteById[c.id] = c;

  // pré-cálculos por cliente
  const renovadasPorCliente = {};
  const produtosPorCliente = {};
  for (const a of apolices) {
    if (a.status === 'renovada') renovadasPorCliente[a.cliente_id] = (renovadasPorCliente[a.cliente_id] || 0) + 1;
    if (a.status === 'ativa') {
      produtosPorCliente[a.cliente_id] = produtosPorCliente[a.cliente_id] || new Set();
      produtosPorCliente[a.cliente_id].add(a.produto_id);
    }
  }

  let atualizadas = 0;
  const healthPorCliente = {};
  for (const a of apolices.filter((x) => x.status === 'ativa')) {
    const cli = clienteById[a.cliente_id] || {};
    const { score } = metrics.calcularHealthScore({
      diasAteVencimento: metrics.diasEntre(hoje(), a.data_vencimento),
      numRenovacoes: renovadasPorCliente[a.cliente_id] || 0,
      numProdutos: (produtosPorCliente[a.cliente_id] || new Set()).size || 1,
      nps: cli.nps ?? null,
      interacoes90d: 0,
    });
    await apolicesRepository.update(tenantId, a.id, { health_score: score });
    healthPorCliente[a.cliente_id] = Math.max(healthPorCliente[a.cliente_id] || 0, score);
    atualizadas += 1;
  }
  for (const [clienteId, score] of Object.entries(healthPorCliente)) {
    await carteiraClientesRepository.update(tenantId, clienteId, { health_score: score });
  }
  return { apolices_atualizadas: atualizadas };
}

module.exports = { metricas, recalcularHealth };
