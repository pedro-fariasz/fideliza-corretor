const dashboardRepository = require('../repositories/dashboardRepository');

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

async function obter(tenantId, filtros = {}) {
  const { de, ate } = resolverPeriodo(filtros);
  const deIso = `${de}T00:00:00.000Z`;
  const ateIso = `${ate}T23:59:59.999Z`;
  const donoId = filtros.donoId || undefined;

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
    dashboardRepository.contarLeadsCriados(tenantId, { deIso, ateIso, donoId }),
    dashboardRepository.contarTotalLeads(tenantId, { donoId, status: 'ativo' }),
    dashboardRepository.vendasConcluidas(tenantId, { de, ate, vendedorId: donoId }),
    dashboardRepository.comissaoPrevista(tenantId, { de, ate }),
    dashboardRepository.comissaoRecebida(tenantId, { de, ate }),
    dashboardRepository.funilResumo(tenantId, { donoId }),
    dashboardRepository.vendasRecentes(tenantId, 5),
    dashboardRepository.leadsRecentes(tenantId, 5),
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
