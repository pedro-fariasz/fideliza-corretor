// =============================================================================
// desempenhoMetrics — funções PURAS do Desempenho de Equipe (sem banco).
// Recebem linhas já agregadas por vendedor; calculam ranking, concentração,
// destaques e a série mensal. Fáceis de testar.
// =============================================================================

const round1 = (n) => Math.round(Number(n || 0) * 10) / 10;
const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const ISO = (d) => String(d).slice(0, 10);
const mesDe = (d) => ISO(d).slice(0, 7);

// Últimos N meses como ['YYYY-MM', ...] crescente.
function mesesRecentes(hojeISO, n) {
  const [a, m] = ISO(hojeISO).slice(0, 7).split('-').map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const total = a * 12 + (m - 1) - i;
    out.push(`${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`);
  }
  return out;
}

// Índice de Concentração = faturamento dos 3 maiores ÷ total × 100.
// Alerta (no front) se > 70%: "receita depende demais de poucas pessoas".
function indiceConcentracao(vendedores) {
  const total = vendedores.reduce((s, v) => s + Number(v.valor || 0), 0);
  if (total <= 0) return 0;
  const top3 = [...vendedores].sort((a, b) => b.valor - a.valor).slice(0, 3)
    .reduce((s, v) => s + Number(v.valor || 0), 0);
  return round1((top3 / total) * 100);
}

// Destaques automáticos (maior valor / ticket / taxa de renovação).
function destaques(vendedores) {
  if (!vendedores.length) return { melhor_vendedor: null, maior_ticket: null, maior_renovacao: null };
  const maxPor = (campo) => vendedores.reduce((melhor, v) => (Number(v[campo] || 0) > Number(melhor[campo] || 0) ? v : melhor), vendedores[0]);
  const mv = maxPor('valor');
  const mt = maxPor('ticket_medio');
  const mr = maxPor('taxa_renovacao');
  return {
    melhor_vendedor: { vendedor_id: mv.vendedor_id, nome: mv.nome, valor: round2(mv.valor) },
    maior_ticket: { vendedor_id: mt.vendedor_id, nome: mt.nome, ticket_medio: round2(mt.ticket_medio) },
    maior_renovacao: { vendedor_id: mr.vendedor_id, nome: mr.nome, taxa_renovacao: round1(mr.taxa_renovacao) },
  };
}

// Totais consolidados (cards de topo).
function totais(vendedores) {
  const vendas = vendedores.reduce((s, v) => s + Number(v.vendas || 0), 0);
  const valor = round2(vendedores.reduce((s, v) => s + Number(v.valor || 0), 0));
  const comissao_projetada = round2(vendedores.reduce((s, v) => s + Number(v.comissao_projetada || 0), 0));
  const comissao_recebida = round2(vendedores.reduce((s, v) => s + Number(v.comissao_recebida || 0), 0));
  const ticket_medio = vendas > 0 ? round2(valor / vendas) : 0;
  return { vendas, valor, comissao_projetada, comissao_recebida, ticket_medio };
}

// Ranking ordenável (default: valor desc). campo ∈ colunas da linha.
function ranking(vendedores, campo = 'valor', asc = false) {
  const ordenados = [...vendedores].sort((a, b) => Number(a[campo] || 0) - Number(b[campo] || 0));
  return asc ? ordenados : ordenados.reverse();
}

// Série mensal (3 séries) a partir das vendas e comissões cruas do período.
function serieMensal(vendas, comissoes, hojeISO, n = 6) {
  const meses = mesesRecentes(hojeISO, n);
  const mapa = {};
  for (const mes of meses) mapa[mes] = { mes, faturamento: 0, comissao_projetada: 0, comissao_recebida: 0 };
  for (const v of vendas) {
    if (v.status === 'cancelada') continue;
    const mes = mesDe(v.data_venda);
    if (mapa[mes]) mapa[mes].faturamento = round2(mapa[mes].faturamento + Number(v.valor || 0));
  }
  for (const c of comissoes) {
    if (c.status === 'projetada') {
      const mes = mesDe(c.data_prevista);
      if (mapa[mes]) mapa[mes].comissao_projetada = round2(mapa[mes].comissao_projetada + Number(c.valor_parcela || 0));
    } else if (c.status === 'recebida') {
      const mes = mesDe(c.data_recebida || c.data_prevista);
      if (mapa[mes]) mapa[mes].comissao_recebida = round2(mapa[mes].comissao_recebida + Number(c.valor_parcela || 0));
    }
  }
  return meses.map((m) => mapa[m]);
}

module.exports = {
  mesesRecentes,
  indiceConcentracao,
  destaques,
  totais,
  ranking,
  serieMensal,
};
