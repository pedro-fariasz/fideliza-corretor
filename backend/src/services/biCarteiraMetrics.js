// =============================================================================
// biCarteiraMetrics — núcleo PURO do BI de Carteira (sem banco), testável.
//
// Fluxo:
//   1) snapshotDeCorretor(...)  -> agrega os dados de UM corretor num período
//      (guarda os "inputs base" das 7 métricas + os agregados de exibição).
//   2) mergeSnapshots([...])    -> soma snapshots (para o escopo do usuário:
//      meus dados / minha equipe / empresa) — poucas linhas, rápido.
//   3) finalizar(merged)        -> recalcula as 7 métricas sobre a base somada
//      (via carteiraMetricsService) e monta o payload final da tela.
//
// Recalcular as métricas na base SOMADA (e não a média das médias) mantém as
// taxas corretas em qualquer escopo.
// =============================================================================
const carteira = require('./carteiraMetricsService');

const ISO = (d) => String(d).slice(0, 10);
const hojeISO = () => new Date().toISOString().slice(0, 10);
const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const mesDe = (dataISO) => ISO(dataISO).slice(0, 7); // 'YYYY-MM'

// Últimos N meses (inclui o corrente), como ['YYYY-MM', ...] em ordem crescente.
function mesesRecentes(hojeISO_, n) {
  const [a, m] = ISO(hojeISO_).slice(0, 7).split('-').map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const total = (a * 12 + (m - 1)) - i;
    const ano = Math.floor(total / 12);
    const mes = (total % 12) + 1;
    out.push(`${ano}-${String(mes).padStart(2, '0')}`);
  }
  return out;
}

function noPeriodo(dataISO, de, ate) {
  if (!dataISO) return false;
  const d = ISO(dataISO);
  return d >= de && d <= ate;
}

// Faixa de health do cliente/apólice (brief: Saudável ≥70 · Atenção 40-69 · Risco <40).
function faixaHealth(h) {
  if (h == null) return 'atencao'; // sem score => neutro (não infla garantido nem risco)
  if (h >= 70) return 'saudavel';
  if (h >= 40) return 'atencao';
  return 'risco';
}

// Probabilidade de churn (0..1): inverso do health ponderado pela proximidade do
// vencimento. Health baixo + vencimento próximo => risco alto.
function probabilidadeChurn(healthScore, diasAteVencimento) {
  const inversoHealth = (100 - (healthScore == null ? 60 : healthScore)) / 100; // 0..1
  let proximidade;
  if (diasAteVencimento <= 0) proximidade = 1;
  else if (diasAteVencimento >= 90) proximidade = 0.3;
  else proximidade = 1 - (diasAteVencimento / 90) * 0.7; // 0d=>1 .. 90d=>0.3
  const p = inversoHealth * 0.7 + proximidade * 0.3;
  return Math.max(0, Math.min(1, Math.round(p * 100) / 100));
}

function segmentoChurn(prob) {
  if (prob > 0.7) return 'alto';
  if (prob >= 0.4) return 'medio';
  return 'baixo';
}

// --- Snapshot de UM corretor num período ------------------------------------
// Entradas já filtradas ao corretor (as apólices são dele). Estruturas cruas:
//   apolices: {id,cliente_id,produto_id,corretor_id,venda_id,valor,status,
//              data_inicio,data_vencimento,atualizado_em,health_score,apolice_mae_id}
//   clientes: {id,nome,nps,health_score}
//   comissoes:{venda_id,valor_parcela,status}
//   produtos: {id,categoria,percentual,ativo}
//   interacaoRecentePorCliente: { [cliente_id]: 'YYYY-MM-DD' | null }
function snapshotDeCorretor(dados) {
  const {
    apolices = [], clientes = [], comissoes = [], produtos = [],
    interacaoRecentePorCliente = {}, de = '2000-01-01', ate = hojeISO(), hoje = hojeISO(),
  } = dados;

  const clienteById = {};
  for (const c of clientes) clienteById[c.id] = c;
  const produtoById = {};
  for (const p of produtos) produtoById[p.id] = p;

  const ativas = apolices.filter((a) => a.status === 'ativa');
  const apolicesAtivas = ativas.length;
  const clientesAtivosSet = new Set(ativas.map((a) => a.cliente_id));
  const clientesAtivos = clientesAtivosSet.size;

  const vencidasNoPeriodo = apolices.filter((a) => noPeriodo(a.data_vencimento, de, ate)).length;
  const renovadasNoPeriodo = apolices.filter(
    (a) => a.status === 'renovada' && noPeriodo(a.data_vencimento, de, ate)
  ).length;
  const canceladasPeriodo = apolices.filter(
    (a) => a.status === 'cancelada' && noPeriodo(a.atualizado_em || a.data_vencimento, de, ate)
  );
  const clientesCanceladosNoPeriodo = new Set(canceladasPeriodo.map((a) => a.cliente_id)).size;
  const clientesAtivosInicioPeriodo = clientesAtivos + clientesCanceladosNoPeriodo;

  const npsList = clientes.map((c) => c.nps).filter((n) => n != null);

  // Comissões (não canceladas) por venda -> total + LTV por cliente.
  const comissaoPorVenda = {};
  for (const c of comissoes) {
    if (c.status === 'cancelada') continue;
    comissaoPorVenda[c.venda_id] = (comissaoPorVenda[c.venda_id] || 0) + Number(c.valor_parcela || 0);
  }
  // Comissões PREVISTAS (projetadas) por venda -> receita garantida/risco.
  const previstaPorVenda = {};
  for (const c of comissoes) {
    if (c.status !== 'projetada') continue;
    previstaPorVenda[c.venda_id] = (previstaPorVenda[c.venda_id] || 0) + Number(c.valor_parcela || 0);
  }

  const vendaToCliente = {};
  for (const a of apolices) if (a.venda_id) vendaToCliente[a.venda_id] = a.cliente_id;

  const ltvMap = {};
  let comissaoTotal = 0;
  for (const [vendaId, v] of Object.entries(comissaoPorVenda)) {
    comissaoTotal += v;
    const cli = vendaToCliente[vendaId];
    if (cli) ltvMap[cli] = (ltvMap[cli] || 0) + v;
  }
  const ltvPorCliente = Object.values(ltvMap);

  // TMR: dias entre vencimento da mãe e início da renovação (filha).
  const byId = {};
  for (const a of apolices) byId[a.id] = a;
  let tmrSoma = 0;
  let tmrN = 0;
  for (const a of apolices) {
    if (a.apolice_mae_id && byId[a.apolice_mae_id]) {
      tmrSoma += carteira.diasEntre(byId[a.apolice_mae_id].data_vencimento, a.data_inicio);
      tmrN += 1;
    }
  }

  // --- Agregados de exibição -------------------------------------------------
  const health_distribuicao = { saudavel: 0, atencao: 0, risco: 0 };
  const receita_por_categoria = {};
  const projecao_renovacoes = { j0_30: { qtd: 0, valor: 0 }, j31_60: { qtd: 0, valor: 0 }, j61_90: { qtd: 0, valor: 0 } };
  let vencimentos_30d = 0;
  let receita_garantida = 0;
  let receita_risco = 0;
  const churn = [];

  for (const a of ativas) {
    const dias = carteira.diasEntre(hoje, a.data_vencimento);
    const prevista = previstaPorVenda[a.venda_id] || 0;
    const cli = clienteById[a.cliente_id] || {};
    const health = a.health_score != null ? a.health_score : cli.health_score;

    // distribuição por health
    health_distribuicao[faixaHealth(health)] += 1;

    // receita por categoria (faturamento do negócio ativo)
    const cat = (produtoById[a.produto_id] || {}).categoria || 'outro';
    receita_por_categoria[cat] = round2((receita_por_categoria[cat] || 0) + Number(a.valor || 0));

    // vencimentos e projeção de renovações
    if (dias >= 0 && dias <= 30) { vencimentos_30d += 1; projecao_renovacoes.j0_30.qtd += 1; projecao_renovacoes.j0_30.valor = round2(projecao_renovacoes.j0_30.valor + prevista); }
    else if (dias <= 60) { projecao_renovacoes.j31_60.qtd += 1; projecao_renovacoes.j31_60.valor = round2(projecao_renovacoes.j31_60.valor + prevista); }
    else if (dias <= 90) { projecao_renovacoes.j61_90.qtd += 1; projecao_renovacoes.j61_90.valor = round2(projecao_renovacoes.j61_90.valor + prevista); }

    // receita garantida vs em risco
    const semInteracao15d = (() => {
      const ult = interacaoRecentePorCliente[a.cliente_id];
      if (!ult) return true;
      return carteira.diasEntre(ult, hoje) > 15;
    })();
    const emRisco = (health != null && health < 40) || (dias >= 0 && dias <= 30 && semInteracao15d);
    if (health != null && health >= 70) receita_garantida = round2(receita_garantida + prevista);
    if (emRisco) receita_risco = round2(receita_risco + prevista);

    // candidato a churn
    const prob = probabilidadeChurn(health, dias);
    churn.push({
      cliente_id: a.cliente_id,
      cliente_nome: cli.nome || 'Cliente',
      corretor_id: a.corretor_id,
      apolice_id: a.id,
      prob,
      valor_risco: prevista,
    });
  }
  churn.sort((x, y) => y.prob - x.prob || y.valor_risco - x.valor_risco);

  // Cross-sell por cliente ativo: (produtos que faltam × comissão média) × health norm.
  const produtosAtivosConta = produtos.filter((p) => p.ativo !== false);
  const produtosDoCliente = {};
  for (const a of ativas) {
    produtosDoCliente[a.cliente_id] = produtosDoCliente[a.cliente_id] || new Set();
    produtosDoCliente[a.cliente_id].add(a.produto_id);
  }
  const crosssell = [];
  for (const clienteId of clientesAtivosSet) {
    const tem = produtosDoCliente[clienteId] || new Set();
    const faltantes = produtosAtivosConta.filter((p) => !tem.has(p.id));
    if (faltantes.length === 0) continue;
    const comissaoMedia = faltantes.reduce((s, p) => s + Number(p.percentual || 0), 0) / faltantes.length;
    const cli = clienteById[clienteId] || {};
    const healthNorm = (cli.health_score == null ? 60 : cli.health_score) / 100;
    const score = round2(faltantes.length * comissaoMedia * healthNorm);
    crosssell.push({
      cliente_id: clienteId,
      cliente_nome: cli.nome || 'Cliente',
      corretor_id: [...ativas].find((a) => a.cliente_id === clienteId)?.corretor_id || null,
      score,
      faltam: faltantes.length,
      comissao_media: round2(comissaoMedia),
    });
  }
  crosssell.sort((x, y) => y.score - x.score);

  // Receita mensal (últimos 6 meses): faturamento (venda) + comissão (prevista/recebida).
  const meses = mesesRecentes(hoje, 6);
  const mensalMap = {};
  for (const mes of meses) mensalMap[mes] = { mes, faturamento: 0, comissao: 0 };
  for (const a of apolices) {
    if (!a.venda_id) continue;
    const mes = mesDe(a.data_inicio);
    if (mensalMap[mes]) mensalMap[mes].faturamento = round2(mensalMap[mes].faturamento + Number(a.valor || 0));
  }
  for (const c of comissoes) {
    if (c.status === 'cancelada') continue;
    const mes = mesDe(c.data_prevista);
    if (mensalMap[mes]) mensalMap[mes].comissao = round2(mensalMap[mes].comissao + Number(c.valor_parcela || 0));
  }
  const receita_mensal = meses.map((mes) => mensalMap[mes]);

  return {
    base: {
      vencidasNoPeriodo, renovadasNoPeriodo, clientesAtivos, clientesAtivosInicioPeriodo,
      clientesCanceladosNoPeriodo, npsList, comissaoTotal: round2(comissaoTotal),
      apolicesAtivas, ltvPorCliente, tmrSoma, tmrN,
    },
    cards: { receita_garantida, receita_risco, vencimentos_30d },
    health_distribuicao,
    receita_por_categoria,
    receita_mensal,
    projecao_renovacoes,
    churn: churn.slice(0, 50),
    crosssell: crosssell.slice(0, 50),
  };
}

// --- Merge de snapshots (para o escopo do usuário) ---------------------------
function snapshotVazio() {
  return {
    base: {
      vencidasNoPeriodo: 0, renovadasNoPeriodo: 0, clientesAtivos: 0, clientesAtivosInicioPeriodo: 0,
      clientesCanceladosNoPeriodo: 0, npsList: [], comissaoTotal: 0, apolicesAtivas: 0,
      ltvPorCliente: [], tmrSoma: 0, tmrN: 0,
    },
    cards: { receita_garantida: 0, receita_risco: 0, vencimentos_30d: 0 },
    health_distribuicao: { saudavel: 0, atencao: 0, risco: 0 },
    receita_por_categoria: {},
    receita_mensal: [],
    projecao_renovacoes: { j0_30: { qtd: 0, valor: 0 }, j31_60: { qtd: 0, valor: 0 }, j61_90: { qtd: 0, valor: 0 } },
    churn: [],
    crosssell: [],
  };
}

function mergeSnapshots(snaps) {
  const out = snapshotVazio();
  for (const s of snaps || []) {
    if (!s) continue;
    const b = s.base || {};
    out.base.vencidasNoPeriodo += b.vencidasNoPeriodo || 0;
    out.base.renovadasNoPeriodo += b.renovadasNoPeriodo || 0;
    out.base.clientesAtivos += b.clientesAtivos || 0;
    out.base.clientesAtivosInicioPeriodo += b.clientesAtivosInicioPeriodo || 0;
    out.base.clientesCanceladosNoPeriodo += b.clientesCanceladosNoPeriodo || 0;
    out.base.npsList = out.base.npsList.concat(b.npsList || []);
    out.base.comissaoTotal = round2(out.base.comissaoTotal + (b.comissaoTotal || 0));
    out.base.apolicesAtivas += b.apolicesAtivas || 0;
    out.base.ltvPorCliente = out.base.ltvPorCliente.concat(b.ltvPorCliente || []);
    out.base.tmrSoma += b.tmrSoma || 0;
    out.base.tmrN += b.tmrN || 0;

    out.cards.receita_garantida = round2(out.cards.receita_garantida + (s.cards?.receita_garantida || 0));
    out.cards.receita_risco = round2(out.cards.receita_risco + (s.cards?.receita_risco || 0));
    out.cards.vencimentos_30d += s.cards?.vencimentos_30d || 0;

    for (const k of ['saudavel', 'atencao', 'risco']) out.health_distribuicao[k] += s.health_distribuicao?.[k] || 0;
    for (const [cat, v] of Object.entries(s.receita_por_categoria || {})) {
      out.receita_por_categoria[cat] = round2((out.receita_por_categoria[cat] || 0) + v);
    }
    for (const j of ['j0_30', 'j31_60', 'j61_90']) {
      out.projecao_renovacoes[j].qtd += s.projecao_renovacoes?.[j]?.qtd || 0;
      out.projecao_renovacoes[j].valor = round2(out.projecao_renovacoes[j].valor + (s.projecao_renovacoes?.[j]?.valor || 0));
    }
    // receita_mensal: soma por mês (mesma janela de 6 meses em todos os snapshots)
    for (const linha of s.receita_mensal || []) {
      const alvo = out.receita_mensal.find((r) => r.mes === linha.mes);
      if (alvo) {
        alvo.faturamento = round2(alvo.faturamento + (linha.faturamento || 0));
        alvo.comissao = round2(alvo.comissao + (linha.comissao || 0));
      } else {
        out.receita_mensal.push({ mes: linha.mes, faturamento: linha.faturamento || 0, comissao: linha.comissao || 0 });
      }
    }

    out.churn = out.churn.concat(s.churn || []);
    out.crosssell = out.crosssell.concat(s.crosssell || []);
  }
  out.receita_mensal.sort((x, y) => (x.mes < y.mes ? -1 : 1));
  out.churn.sort((x, y) => y.prob - x.prob || y.valor_risco - x.valor_risco);
  out.crosssell.sort((x, y) => y.score - x.score);
  return out;
}

// --- Finaliza o payload da tela (recalcula as 7 métricas na base somada) ------
function finalizar(merged, hoje = hojeISO()) {
  const b = merged.base;
  const metricas = carteira.calcularMetricas({
    vencidasNoPeriodo: b.vencidasNoPeriodo,
    renovadasNoPeriodo: b.renovadasNoPeriodo,
    clientesAtivos: b.clientesAtivos,
    clientesAtivosInicioPeriodo: b.clientesAtivosInicioPeriodo,
    clientesCanceladosNoPeriodo: b.clientesCanceladosNoPeriodo,
    npsList: b.npsList,
    comissaoTotal: b.comissaoTotal,
    apolicesAtivas: b.apolicesAtivas,
    ltvPorCliente: b.ltvPorCliente,
    tmrDias: b.tmrN > 0 ? b.tmrSoma / b.tmrN : null,
  });

  const churnSeg = { alto: 0, medio: 0, baixo: 0 };
  for (const c of merged.churn) churnSeg[segmentoChurn(c.prob)] += 1;

  return {
    cards: {
      score_saude: metricas.score_geral,
      faixa: carteira.faixaScore(metricas.score_geral),
      receita_garantida: merged.cards.receita_garantida,
      receita_risco: merged.cards.receita_risco,
      taxa_renovacao: metricas.trc,
      nps: metricas.nps,
      ltv_medio: metricas.ltv,
      produtos_por_cliente: metricas.ppc,
      taxa_cancelamento: metricas.tcc,
      vencimentos_30d: merged.cards.vencimentos_30d,
    },
    metricas,
    health_distribuicao: merged.health_distribuicao,
    receita_por_categoria: merged.receita_por_categoria,
    receita_mensal: merged.receita_mensal || [],
    projecao_renovacoes: merged.projecao_renovacoes,
    churn: {
      segmentos: churnSeg,
      top20: merged.churn.slice(0, 20),
    },
    crosssell: merged.crosssell.slice(0, 20),
    base: { clientes_ativos: b.clientesAtivos, apolices_ativas: b.apolicesAtivas },
  };
}

module.exports = {
  faixaHealth,
  probabilidadeChurn,
  segmentoChurn,
  snapshotDeCorretor,
  snapshotVazio,
  mergeSnapshots,
  finalizar,
};
