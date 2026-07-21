const dashboardRepository = require('../repositories/dashboardRepository');
const vendasRepository = require('../repositories/vendasRepository');
const { resolverDonoIds } = require('./escopoService');

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

// Estágios do funil na ordem, para o resumo sair sempre completo (com zeros).
const ESTAGIOS = [
  'prospectos',
  'qualificados',
  'proposta_enviada',
  'negociacao',
  'finalizacao',
  'venda_concluida',
];

// Período padrão = mês corrente (1º ao último dia).
function periodoMesCorrente() {
  const agora = new Date();
  const ano = agora.getUTCFullYear();
  const mes = agora.getUTCMonth(); // 0-based
  const primeiro = new Date(Date.UTC(ano, mes, 1));
  const ultimo = new Date(Date.UTC(ano, mes + 1, 0)); // dia 0 do próximo = último deste
  return {
    de: primeiro.toISOString().slice(0, 10),
    ate: ultimo.toISOString().slice(0, 10),
  };
}

function resolverPeriodo(filtros = {}) {
  const padrao = periodoMesCorrente();
  const de = DATA_RE.test(filtros.de || '') ? filtros.de : padrao.de;
  const ate = DATA_RE.test(filtros.ate || '') ? filtros.ate : padrao.ate;
  return { de, ate };
}

async function obter(tenantId, filtros = {}, user) {
  const { de, ate } = resolverPeriodo(filtros);
  const deIso = `${de}T00:00:00.000Z`;
  const ateIso = `${ate}T23:59:59.999Z`;

  // Escopo hierárquico: donoIds (leads/vendas) e vendaIds (comissões).
  let donoIds = null;
  if (user) donoIds = await resolverDonoIds(user, 'dashboard_financeiro', 'ler');
  // Filtro "meus" explícito (restringe ainda mais, dentro do escopo).
  if (filtros.donoId) donoIds = donoIds === null ? [filtros.donoId] : donoIds.filter((x) => x === filtros.donoId);
  const vendaIds = donoIds === null ? null : await vendasRepository.idsByVendedores(tenantId, donoIds);

  const [
    leadsNovos,
    totalLeads,
    vendas,
    comissaoPrevista,
    comissaoRecebida,
    funil,
    vendasRecentes,
    leadsRecentes,
  ] = await Promise.all([
    dashboardRepository.contarLeadsCriados(tenantId, { deIso, ateIso, donoIds }),
    dashboardRepository.contarTotalLeads(tenantId, { donoIds, status: 'ativo' }),
    dashboardRepository.vendasConcluidas(tenantId, { de, ate, donoIds }),
    dashboardRepository.comissaoPrevista(tenantId, { de, ate, vendaIds }),
    dashboardRepository.comissaoRecebida(tenantId, { de, ate, vendaIds }),
    dashboardRepository.funilResumo(tenantId, { donoIds }),
    dashboardRepository.vendasRecentes(tenantId, { limit: 5, donoIds }),
    dashboardRepository.leadsRecentes(tenantId, { limit: 5, donoIds }),
  ]);

  const taxaConversao =
    leadsNovos > 0 ? Math.round((vendas.quantidade / leadsNovos) * 1000) / 10 : 0;

  const funilResumo = ESTAGIOS.map((estagio) => ({
    estagio,
    quantidade: funil[estagio] || 0,
  }));

  return {
    periodo: { de, ate },
    kpis: {
      leads_novos: leadsNovos,
      total_leads: totalLeads,
      vendas_concluidas: vendas, // { quantidade, valor_total }
      comissao_prevista: comissaoPrevista,
      comissao_recebida: comissaoRecebida,
      taxa_conversao: taxaConversao, // %
    },
    funil: funilResumo,
    vendas_recentes: vendasRecentes,
    leads_recentes: leadsRecentes,
  };
}

module.exports = { obter };
