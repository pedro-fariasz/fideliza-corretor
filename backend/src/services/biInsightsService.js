// =============================================================================
// biInsightsService — motor de INSIGHTS determinísticos (sem IA nesta fase).
// Recebe o payload finalizado do BI e devolve alertas em linguagem natural.
// Regra do brief: "Insight sem ação é decoração" — TODO insight tem CTA.
//
// CTA:
//   { label, acao, link? }
//     - acao: chave que a tela usa para rolar até o bloco correspondente
//       ('vencimentos' | 'churn' | 'crosssell' | 'renovacoes' | 'nps')
//     - link: rota opcional p/ navegar a uma lista já filtrada (ex.: Carteira)
// =============================================================================

function brl(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
}

function gerar(payload) {
  if (!payload || !payload.cards) return [];
  const c = payload.cards;
  const m = payload.metricas || {};
  const churn = payload.churn || { segmentos: {}, top20: [] };
  const crosssell = payload.crosssell || [];
  const out = [];

  // 1) Vencimentos próximos com receita em risco
  if (c.vencimentos_30d > 0 && c.receita_risco > 0) {
    out.push({
      id: 'vencimentos_risco',
      severidade: 'alerta',
      texto: `${c.vencimentos_30d} apólice(s) vencem nos próximos 30 dias com ${brl(c.receita_risco)} em comissão em risco.`,
      cta: { label: 'Ver vencimentos', acao: 'vencimentos', link: '/carteira?situacao=urgente' },
    });
  }

  // 2) Risco alto de churn
  const alto = churn.segmentos?.alto || 0;
  if (alto > 0) {
    out.push({
      id: 'churn_alto',
      severidade: 'alerta',
      texto: `${alto} cliente(s) com risco alto de cancelamento. Priorize contato antes do vencimento.`,
      cta: { label: 'Ver clientes em risco', acao: 'churn' },
    });
  }

  // 3) Renovação abaixo da meta (85%)
  if (m.trc != null && m.trc < 85) {
    out.push({
      id: 'trc_baixo',
      severidade: 'alerta',
      texto: `Taxa de renovação em ${m.trc}%, abaixo da meta de 85%.`,
      cta: { label: 'Ver renovações', acao: 'renovacoes' },
    });
  }

  // 4) Cancelamento acima do teto (10%)
  if (m.tcc != null && m.tcc > 10) {
    out.push({
      id: 'tcc_alto',
      severidade: 'alerta',
      texto: `Taxa de cancelamento em ${m.tcc}%, acima do teto de 10%.`,
      cta: { label: 'Analisar churn', acao: 'churn' },
    });
  }

  // 5) Poucos produtos por cliente => oportunidade de cross-sell
  if (m.ppc != null && m.ppc < 1.8 && crosssell.length > 0) {
    out.push({
      id: 'ppc_baixo',
      severidade: 'info',
      texto: `Média de ${m.ppc} produtos por cliente (meta 1,8). ${crosssell.length} cliente(s) com espaço para cross-sell.`,
      cta: { label: 'Ver oportunidades', acao: 'crosssell' },
    });
  }

  // 6) NPS abaixo da meta
  if (m.nps != null && m.nps < 50) {
    out.push({
      id: 'nps_baixo',
      severidade: 'info',
      texto: `NPS em ${m.nps}, abaixo da meta de 50. Reforce a etapa de Satisfação no pós-venda.`,
      cta: { label: 'Ir ao pós-venda', acao: 'nps', link: '/posvendas' },
    });
  }

  // 7) Receita garantida (positivo)
  if (c.receita_garantida > 0) {
    out.push({
      id: 'receita_garantida',
      severidade: 'positivo',
      texto: `${brl(c.receita_garantida)} em comissão garantida por recorrência (clientes saudáveis).`,
      cta: { label: 'Ver renovações', acao: 'renovacoes' },
    });
  }

  // 8) Carteira saudável (positivo)
  if (c.score_saude != null && c.score_saude >= 75) {
    out.push({
      id: 'score_saudavel',
      severidade: 'positivo',
      texto: `Carteira saudável: score ${c.score_saude}. Mantenha o ritmo de renovação.`,
      cta: { label: 'Ver renovações', acao: 'renovacoes' },
    });
  }

  return out;
}

module.exports = { gerar };
