// =============================================================================
// carteiraService — reúne os dados da carteira e calcula as 7 métricas + score
// (via carteiraMetricsService, puro e testado) e recalcula o health score.
// Aproximações documentadas onde a reconstrução histórica exata não é viável.
// =============================================================================
const apolicesRepository = require('../repositories/apolicesRepository');
const carteiraClientesRepository = require('../repositories/carteiraClientesRepository');
const comissoesRepository = require('../repositories/comissoesRepository');
const leadsRepository = require('../repositories/leadsRepository');
const tagsRepository = require('../repositories/tagsRepository');
const leadTagsRepository = require('../repositories/leadTagsRepository');
const compromissosRepository = require('../repositories/compromissosRepository');
const usersRepository = require('../repositories/usersRepository');
const metrics = require('./carteiraMetricsService');
const atividadesService = require('./atividadesService');
const { resolverDonoIds } = require('./escopoService');

const hoje = () => new Date().toISOString().slice(0, 10);

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

function noPeriodo(dataISO, de, ate) {
  if (!dataISO) return false;
  const d = String(dataISO).slice(0, 10);
  return d >= de && d <= ate;
}

function somarDias(dataISO, dias) {
  const d = new Date(`${dataISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Lista os clientes da carteira (carteira_clientes — a tabela nova do CRM,
// não confundir com a tabela legada `clientes` do pós-venda pré-pivô). Usado
// pela aba Carteira do hub de Clientes: é a prova visual de que uma venda
// concluída realmente promoveu o lead a cliente. Escopo pelas apólices do
// usuário, mesmo critério de `metricas`.
async function listarClientes(tenantId, filtros = {}, usuario) {
  const donoIds = usuario ? await resolverDonoIds(usuario, 'carteira', 'ler') : null;

  const apolices = await apolicesRepository.list(tenantId, { donoIds });
  const clienteIdsEmEscopo = new Set(apolices.map((a) => a.cliente_id));

  const porCliente = {};
  for (const a of apolices) {
    if (!porCliente[a.cliente_id]) porCliente[a.cliente_id] = [];
    porCliente[a.cliente_id].push(a);
  }

  const clientes = await carteiraClientesRepository.list(tenantId, { busca: filtros.busca });

  return clientes
    .filter((c) => clienteIdsEmEscopo.has(c.id))
    .map((c) => {
      const apsCliente = porCliente[c.id] || [];
      const ativas = apsCliente.filter((a) => a.status === 'ativa');
      return {
        ...c,
        apolices_ativas: ativas.length,
        produto_principal: ativas[0] && ativas[0].produto ? ativas[0].produto.nome : null,
      };
    });
}

// Saúde dos dados da carteira — indicadores simples de completude, só com o
// que já existe no modelo hoje (cpf_cnpj em carteira_clientes). Indicadores
// como "apólices sem PDF" ou "cotações pendentes" dependem de features que
// ainda não existem no backend (upload de PDF da proposta, cotações) — ver
// CLAUDE.md; não inventamos números pra eles aqui.
async function saudeDados(tenantId, usuario) {
  const donoIds = usuario ? await resolverDonoIds(usuario, 'carteira', 'ler') : null;
  const apolices = await apolicesRepository.list(tenantId, { donoIds });
  const clienteIdsEmEscopo = new Set(apolices.map((a) => a.cliente_id));

  const clientes = (await carteiraClientesRepository.list(tenantId, {})).filter((c) =>
    clienteIdsEmEscopo.has(c.id)
  );
  const semCpf = clientes.filter((c) => !c.cpf_cnpj).length;

  return {
    total_clientes: clientes.length,
    clientes_sem_cpf: semCpf,
  };
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

// --- Cancelamento de cliente (Relacionamento & Pós-Venda) ---------------------
// Cenário A (recuperável): financeiro/insatisfacao/trocou_operadora/outro.
// Cenário B (lead frio de risco): trocou_corretor/mal_pagador.
// Cenário C (óbito): falecimento.
const MOTIVOS_RECUPERAVEIS = ['financeiro', 'insatisfacao', 'trocou_operadora', 'outro'];
const MOTIVOS_RISCO = ['trocou_corretor', 'mal_pagador'];
const MOTIVOS_OBITO = ['falecimento'];
const MOTIVOS_CANCELAMENTO_CLIENTE = [...MOTIVOS_RECUPERAVEIS, ...MOTIVOS_RISCO, ...MOTIVOS_OBITO];
const DIAS_TENTAR_RECUPERAR = 60;

async function cancelarCliente(tenantId, clienteId, input, usuario) {
  const body = input || {};
  const motivo = body.motivo_cancelamento;
  if (!MOTIVOS_CANCELAMENTO_CLIENTE.includes(motivo)) {
    throw new ValidationError(`motivo_cancelamento inválido. Aceitos: ${MOTIVOS_CANCELAMENTO_CLIENTE.join(', ')}.`);
  }
  const observacao = body.observacao || null;

  const cliente = await carteiraClientesRepository.findById(tenantId, clienteId);
  if (!cliente) throw new NotFoundError('Cliente não encontrado.');

  if (MOTIVOS_RECUPERAVEIS.includes(motivo)) {
    const tentarRecuperarEm = somarDias(hoje(), DIAS_TENTAR_RECUPERAR);
    await carteiraClientesRepository.update(tenantId, clienteId, {
      motivo_cancelamento: motivo,
      status: 'cancelado',
      tentar_recuperar_em: tentarRecuperarEm,
    });
    await atividadesService.registrar(tenantId, {
      usuario_id: usuario && usuario.id,
      entidade: 'cliente',
      entidade_id: clienteId,
      acao: 'cliente_cancelado_recuperavel',
      detalhes: { motivo, observacao, tentar_recuperar_em: tentarRecuperarEm },
    });
    return { ok: true, cliente_id: clienteId, cenario: 'A' };
  }

  if (MOTIVOS_RISCO.includes(motivo)) {
    await carteiraClientesRepository.update(tenantId, clienteId, {
      motivo_cancelamento: motivo,
      status: 'cancelado',
      tentar_recuperar_em: null,
    });

    const novoLead = await leadsRepository.create(tenantId, {
      dono_id: usuario ? usuario.id : null,
      nome: cliente.nome,
      tipo_pessoa: 'PF',
      telefone: cliente.telefone || null,
      email: cliente.email || null,
      origem_canal: 'indicacao',
      indicado_por_cliente_id: clienteId,
      observacoes: `Cliente perdido: ${motivo}. Requer atenção redobrada.`,
      estagio: 'prospectos',
      probabilidade: 5,
      origem_cadastro: 'manual',
    });

    try {
      const tagRisco = await tagsRepository.obterOuCriar(tenantId, 'risco', '#F5A623');
      await leadTagsRepository.aplicar(tenantId, novoLead.id, tagRisco.id);
    } catch (err) {
      console.error('[carteiraService.cancelarCliente] lead frio criado, mas falhou ao aplicar tag "risco"', {
        tenant_id: tenantId,
        lead_id: novoLead.id,
        error: err.message,
      });
    }

    await atividadesService.registrar(tenantId, {
      usuario_id: usuario && usuario.id,
      entidade: 'cliente',
      entidade_id: clienteId,
      acao: 'cliente_virou_lead_frio',
      detalhes: { motivo, novo_lead_id: novoLead.id },
    });
    return { ok: true, cliente_id: clienteId, cenario: 'B', novo_lead_id: novoLead.id };
  }

  // Óbito: sem recuperação, sem lead novo.
  await carteiraClientesRepository.update(tenantId, clienteId, {
    motivo_cancelamento: 'falecimento',
    status: 'cancelado',
    tentar_recuperar_em: null,
  });
  await atividadesService.registrar(tenantId, {
    usuario_id: usuario && usuario.id,
    entidade: 'cliente',
    entidade_id: clienteId,
    acao: 'cliente_falecimento',
    detalhes: { motivo },
  });
  return { ok: true, cliente_id: clienteId, cenario: 'C' };
}

// --- Job: retomada de contato ---------------------------------------------------
// Clientes com tentar_recuperar_em vencido ganham um compromisso na agenda do
// corretor dono do tenant e o campo é limpo (não gera de novo amanhã).
async function retomarContatos(tenantId) {
  const clientes = await carteiraClientesRepository.listParaRetomada(tenantId);
  if (!clientes.length) return { processados: 0 };

  const dono = await usersRepository.findCorretorDoTenant(tenantId);
  const inicio = new Date();
  const fim = new Date(inicio.getTime() + 60 * 60 * 1000);

  let processados = 0;
  for (const cliente of clientes) {
    try {
      await compromissosRepository.create(tenantId, {
        usuario_id: dono ? dono.id : null,
        titulo: `Retomar contato com ${cliente.nome}`,
        descricao: `Cliente cancelou por ${cliente.motivo_cancelamento || 'motivo não informado'}. Hora de tentar reativar.`,
        data_inicio: inicio.toISOString(),
        data_fim: fim.toISOString(),
        origem: 'sistema_retomada',
      });

      await carteiraClientesRepository.update(tenantId, cliente.id, { tentar_recuperar_em: null });

      await atividadesService.registrar(tenantId, {
        entidade: 'cliente',
        entidade_id: cliente.id,
        acao: 'retomada_agendada',
        detalhes: { motivo: cliente.motivo_cancelamento },
      });

      processados += 1;
    } catch (err) {
      console.error('[carteiraService.retomarContatos] falha ao processar cliente', {
        tenant_id: tenantId,
        cliente_id: cliente.id,
        error: err.message,
      });
    }
  }
  return { processados };
}

module.exports = {
  listarClientes,
  saudeDados,
  metricas,
  recalcularHealth,
  cancelarCliente,
  retomarContatos,
  MOTIVOS_CANCELAMENTO_CLIENTE,
  ValidationError,
  NotFoundError,
};
