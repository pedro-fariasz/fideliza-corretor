// =============================================================================
// desempenhoService — orquestra o Desempenho de Equipe (Fase 4).
// Agrega vendas/comissões/leads/apólices por vendedor no período, respeitando o
// escopo de permissão (recurso 'desempenho'): vendedor vê só a própria linha,
// líder a equipe, gerente/admin tudo. Calculado on-read (sem job/tabela nova).
// =============================================================================
const vendasRepository = require('../repositories/vendasRepository');
const comissoesRepository = require('../repositories/comissoesRepository');
const leadsRepository = require('../repositories/leadsRepository');
const apolicesRepository = require('../repositories/apolicesRepository');
const usersRepository = require('../repositories/usersRepository');
const metrics = require('./desempenhoMetrics');
const { resolverDonoIds } = require('./escopoService');

const PERIODOS = ['30d', '90d', '6m', '1a', 'tudo'];
const PERIODO_PADRAO = '90d';

const hojeISO = () => new Date().toISOString().slice(0, 10);
const ISO = (d) => String(d).slice(0, 10);
function addDays(dataISO, dias) {
  const d = new Date(`${ISO(dataISO)}T00:00:00Z`);
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
const noPeriodo = (dataISO, de, ate) => !!dataISO && ISO(dataISO) >= de && ISO(dataISO) <= ate;
const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const round1 = (n) => Math.round(Number(n || 0) * 10) / 10;

async function obter(tenantId, filtros, user) {
  const periodo = PERIODOS.includes(filtros.periodo) ? filtros.periodo : PERIODO_PADRAO;
  const hoje = hojeISO();
  const de = periodoParaDe(periodo, hoje);

  const perm = user ? await resolverDonoIds(user, 'desempenho', 'ler') : null; // null|[]|[ids]
  if (Array.isArray(perm) && perm.length === 0) {
    return { periodo, escopo: 'nenhum', cards: metrics.totais([]), vendedores: [], serie_mensal: [], destaques: metrics.destaques([]), indice_concentracao: 0 };
  }

  // Carrega os dados no escopo (uma passada).
  const donoIds = perm; // null = tudo
  const [vendas, comissoesAll, leads, apolices, users] = await Promise.all([
    vendasRepository.list(tenantId, { donoIds }),
    comissoesRepository.list(tenantId, {}),
    leadsRepository.list(tenantId, { donoIds }),
    apolicesRepository.list(tenantId, { donoIds }),
    usersRepository.listByTenant(tenantId),
  ]);

  // Comissões restritas às vendas em escopo.
  const vendaById = {};
  for (const v of vendas) vendaById[v.id] = v;
  const comissoes = comissoesAll.filter((c) => vendaById[c.venda_id]);

  // Conjunto de vendedores a exibir: escopo + (filtro de vendedor específico).
  const nomePorId = {};
  for (const u of users) nomePorId[u.id] = u.nome || u.email;
  let vendedorIds;
  if (donoIds === null) {
    vendedorIds = users
      .filter((u) => u.ativo !== false && (u.papel_conta === 'corretor' || u.papel_conta === 'administrador'))
      .map((u) => u.id);
  } else {
    vendedorIds = [...donoIds];
  }
  if (filtros.vendedor_id) {
    if (donoIds !== null && !donoIds.includes(filtros.vendedor_id)) {
      return { periodo, escopo: 'nenhum', cards: metrics.totais([]), vendedores: [], serie_mensal: [], destaques: metrics.destaques([]), indice_concentracao: 0 };
    }
    vendedorIds = [filtros.vendedor_id];
  }

  // Agregação por vendedor (no período).
  const linhas = vendedorIds.map((vid) => {
    const vendasV = vendas.filter((v) => v.vendedor_id === vid && v.status !== 'cancelada' && noPeriodo(v.data_venda, de, hoje));
    const qtd = vendasV.length;
    const valor = round2(vendasV.reduce((s, v) => s + Number(v.valor || 0), 0));
    const vendaIdsV = new Set(vendasV.map((v) => v.id));
    const comV = comissoes.filter((c) => vendaIdsV.has(c.venda_id));
    const comissao_projetada = round2(comV.filter((c) => c.status === 'projetada').reduce((s, c) => s + Number(c.valor_parcela || 0), 0));
    const comissao_recebida = round2(comV.filter((c) => c.status === 'recebida').reduce((s, c) => s + Number(c.valor_parcela || 0), 0));

    // Conversão do funil: venda_concluida ÷ total de leads do vendedor (no período por criação).
    const leadsV = leads.filter((l) => l.dono_id === vid && noPeriodo(l.criado_em, de, hoje));
    const convertidos = leadsV.filter((l) => l.estagio === 'venda_concluida').length;
    const taxa_conversao = leadsV.length > 0 ? round1((convertidos / leadsV.length) * 100) : 0;

    // Renovação: renovadas ÷ vencidas no período (por data_vencimento).
    const apsV = apolices.filter((a) => a.corretor_id === vid);
    const vencidas = apsV.filter((a) => noPeriodo(a.data_vencimento, de, hoje)).length;
    const renovadas = apsV.filter((a) => a.status === 'renovada' && noPeriodo(a.data_vencimento, de, hoje)).length;
    const taxa_renovacao = vencidas > 0 ? round1((renovadas / vencidas) * 100) : 0;

    return {
      vendedor_id: vid,
      nome: nomePorId[vid] || 'Vendedor',
      vendas: qtd,
      valor,
      ticket_medio: qtd > 0 ? round2(valor / qtd) : 0,
      comissao_projetada,
      comissao_recebida,
      taxa_conversao,
      taxa_renovacao,
    };
  });

  return {
    periodo,
    escopo: donoIds === null ? 'empresa' : (donoIds.length === 1 ? 'proprio' : 'equipe'),
    cards: metrics.totais(linhas),
    destaques: metrics.destaques(linhas),
    indice_concentracao: metrics.indiceConcentracao(linhas),
    vendedores: metrics.ranking(linhas, 'valor'),
    serie_mensal: metrics.serieMensal(
      vendas.filter((v) => vendedorIds.includes(v.vendedor_id)),
      comissoes.filter((c) => vendedorIds.includes((vendaById[c.venda_id] || {}).vendedor_id)),
      hoje,
      6
    ),
  };
}

module.exports = { obter, PERIODOS };
