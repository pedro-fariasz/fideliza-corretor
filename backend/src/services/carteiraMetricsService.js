// =============================================================================
// carteiraMetricsService — funções PURAS de cálculo da carteira.
// As 7 métricas + Score Geral (PRD Fase 1) e o health score individual.
// Recebem dados já buscados; não tocam o banco (fáceis de testar).
//
// Metas (brief): TRC ≥85% · NPS ≥50 · PPC ≥1,8 · TCC ≤10%/ano · TMR ≤0 dias.
// LTV e RPC têm meta "por vertical" — usamos alvos padrão AJUSTÁVEIS abaixo.
// Pesos do score: TRC 25 · TCC 20 · NPS 15 · LTV 15 · PPC 10 · RPC 10 · TMR 5.
// =============================================================================

const METAS = {
  trc: 85, // %
  nps: 50,
  ppc: 1.8,
  tcc: 10, // %/ano
  tmr: 0, // dias (negativo = renovou antes)
  ltv: 2000, // R$ — alvo padrão, ajustar por vertical
  rpc: 500, // R$ — alvo padrão, ajustar por vertical
};

const PESOS = { trc: 25, tcc: 20, nps: 15, ltv: 15, ppc: 10, rpc: 10, tmr: 5 };
const TMR_JANELA_DIAS = 30; // TMR de +30 dias => nota 0

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function round1(n) {
  return Math.round(n * 10) / 10;
}

function diasEntre(deISO, ateISO) {
  const de = new Date(String(deISO).slice(0, 10));
  const ate = new Date(String(ateISO).slice(0, 10));
  return Math.round((ate.getTime() - de.getTime()) / 86400000);
}

// --- Pipeline por situação de vencimento -------------------------------------
// Retorna a "coluna" da apólice ativa conforme a distância até o vencimento.
function classificarVencimento(apolice, hoje = new Date().toISOString().slice(0, 10)) {
  if (apolice.status === 'cancelada') return 'cancelada';
  const dias = diasEntre(hoje, apolice.data_vencimento);
  if (dias < 0) return 'vencida';
  if (dias <= 15) return 'urgente';
  if (dias <= 45) return 'atencao';
  return 'em_dia';
}

function pipelineContadores(apolices, hoje) {
  const c = { vencidas: 0, urgentes: 0, em_atencao: 0, em_dia: 0, canceladas: 0, total: 0 };
  for (const a of apolices) {
    c.total += 1;
    const col = classificarVencimento(a, hoje);
    if (col === 'cancelada') c.canceladas += 1;
    else if (col === 'vencida') c.vencidas += 1;
    else if (col === 'urgente') c.urgentes += 1;
    else if (col === 'atencao') c.em_atencao += 1;
    else c.em_dia += 1;
  }
  return c;
}

// --- Normalizadores (0..100 contra a meta) -----------------------------------
const maiorMelhor = (v, meta) => clamp((v / meta) * 100, 0, 100);
const menorMelhor = (v, meta) => (v <= meta ? 100 : clamp((meta / v) * 100, 0, 100));
function normNps(nps) {
  return clamp((nps / METAS.nps) * 100, 0, 100); // nps 50 => 100; <=0 => 0
}
function normTmr(tmr) {
  if (tmr <= METAS.tmr) return 100;
  return clamp(100 - (tmr / TMR_JANELA_DIAS) * 100, 0, 100);
}

/**
 * Calcula as 7 métricas + score geral.
 * Entrada (tudo já filtrado por escopo/período):
 *   apolices: [{status, data_inicio, data_vencimento, valor, cliente_id, apolice_mae_id, renovada_em?}]
 *   vencidasNoPeriodo, renovadasNoPeriodo: contagens do período
 *   clientesAtivos: nº de clientes com apólice ativa
 *   clientesAtivosInicioPeriodo, clientesCanceladosNoPeriodo: p/ TCC
 *   npsList: [0..10] dos clientes que responderam
 *   comissaoTotal: Σ comissões (recebidas+previstas) de todas as apólices
 *   apolicesAtivas: nº de apólices ativas (p/ PPC)
 *   tmrDias: média de dias (vencimento -> renovação); null se não houver
 */
function calcularMetricas(entrada) {
  const {
    vencidasNoPeriodo = 0,
    renovadasNoPeriodo = 0,
    clientesAtivos = 0,
    clientesAtivosInicioPeriodo = 0,
    clientesCanceladosNoPeriodo = 0,
    npsList = [],
    comissaoTotal = 0,
    apolicesAtivas = 0,
    ltvPorCliente = [],
    tmrDias = null,
  } = entrada;

  // TRC — taxa de renovação
  const trc = vencidasNoPeriodo > 0 ? (renovadasNoPeriodo / vencidasNoPeriodo) * 100 : null;

  // NPS — % promotores (9-10) − % detratores (0-6)
  let nps = null;
  if (npsList.length > 0) {
    const prom = npsList.filter((n) => n >= 9).length;
    const detr = npsList.filter((n) => n <= 6).length;
    nps = ((prom - detr) / npsList.length) * 100;
  }

  // PPC — produtos (apólices ativas) por cliente ativo
  const ppc = clientesAtivos > 0 ? apolicesAtivas / clientesAtivos : null;

  // TCC — taxa de cancelamento
  const tcc =
    clientesAtivosInicioPeriodo > 0
      ? (clientesCanceladosNoPeriodo / clientesAtivosInicioPeriodo) * 100
      : null;

  // RPC — receita (comissão) por cliente ativo
  const rpc = clientesAtivos > 0 ? comissaoTotal / clientesAtivos : null;

  // LTV médio
  const ltv = ltvPorCliente.length > 0 ? ltvPorCliente.reduce((a, b) => a + b, 0) / ltvPorCliente.length : null;

  // TMR — tempo médio de renovação (dias)
  const tmr = tmrDias;

  // --- Score geral: média ponderada das disponíveis, re-normalizando pesos ---
  const normas = {
    trc: trc == null ? null : maiorMelhor(trc, METAS.trc),
    tcc: tcc == null ? null : menorMelhor(tcc, METAS.tcc),
    nps: nps == null ? null : normNps(nps),
    ltv: ltv == null ? null : maiorMelhor(ltv, METAS.ltv),
    ppc: ppc == null ? null : maiorMelhor(ppc, METAS.ppc),
    rpc: rpc == null ? null : maiorMelhor(rpc, METAS.rpc),
    tmr: tmr == null ? null : normTmr(tmr),
  };

  let somaPeso = 0;
  let somaNota = 0;
  for (const k of Object.keys(PESOS)) {
    if (normas[k] != null) {
      somaPeso += PESOS[k];
      somaNota += normas[k] * PESOS[k];
    }
  }
  const scoreGeral = somaPeso > 0 ? somaNota / somaPeso : null;

  return {
    trc: trc == null ? null : round1(trc),
    ltv: ltv == null ? null : round1(ltv),
    nps: nps == null ? null : round1(nps),
    ppc: ppc == null ? null : round1(ppc),
    tcc: tcc == null ? null : round1(tcc),
    rpc: rpc == null ? null : round1(rpc),
    tmr: tmr == null ? null : round1(tmr),
    score_geral: scoreGeral == null ? null : Math.round(scoreGeral),
    metas: METAS,
  };
}

function faixaScore(score) {
  if (score == null) return 'sem_dados';
  if (score >= 75) return 'verde';
  if (score >= 50) return 'amarelo';
  return 'vermelho';
}

// --- Health score individual do cliente/apólice ------------------------------
// Componentes (pesos do brief): vencimento 30 · renovações 25 · produtos 15 ·
// NPS 15 · interações 90d 15. Faixas: >=70 saudável · 40-69 atenção · <40 risco.
function calcularHealthScore({ diasAteVencimento, numRenovacoes = 0, numProdutos = 1, nps = null, interacoes90d = 0 }) {
  const venc = clamp((diasAteVencimento / 45) * 100, 0, 100);
  const renov = clamp((Math.min(numRenovacoes, 3) / 3) * 100, 0, 100);
  const prod = clamp((Math.min(numProdutos, 2) / 2) * 100, 0, 100);
  const npsN = nps == null ? 50 : clamp((nps / 10) * 100, 0, 100); // sem NPS => neutro
  const inter = clamp((Math.min(interacoes90d, 5) / 5) * 100, 0, 100);

  const score = Math.round(venc * 0.3 + renov * 0.25 + prod * 0.15 + npsN * 0.15 + inter * 0.15);
  const faixa = score >= 70 ? 'saudavel' : score >= 40 ? 'atencao' : 'risco';
  return { score, faixa };
}

module.exports = {
  METAS,
  PESOS,
  classificarVencimento,
  pipelineContadores,
  calcularMetricas,
  faixaScore,
  calcularHealthScore,
  diasEntre,
};
