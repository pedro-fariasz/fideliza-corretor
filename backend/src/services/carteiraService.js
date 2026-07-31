// =============================================================================
// carteiraService — reúne os dados da carteira e calcula as 7 métricas + score
// (via carteiraMetricsService, puro e testado) e recalcula o health score.
// Aproximações documentadas onde a reconstrução histórica exata não é viável.
// =============================================================================
const apolicesRepository = require('../repositories/apolicesRepository');
const carteiraClientesRepository = require('../repositories/carteiraClientesRepository');
const arquivosRepository = require('../repositories/arquivosRepository');
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

const CAMPOS_OBRIGATORIOS_CLIENTE = [
  { chave: 'cpf_cnpj', label: 'CPF/CNPJ' },
  { chave: 'telefone', label: 'Telefone' },
  { chave: 'data_nascimento', label: 'Data de nascimento' },
];

// Saúde dos dados da carteira. "PDF anexado" e "cotação pendente" agora são
// reais (tabela `arquivos`, migration 007) — correlacionados por lead_id,
// já que arquivos não tem FK direta pra carteira_clientes. Sem extração
// automática por IA ainda (sem integração com a Claude API no backend): um
// arquivo fica em status_extracao='processando' até alguém tratar à mão.
async function saudeDados(tenantId, usuario) {
  const donoIds = usuario ? await resolverDonoIds(usuario, 'carteira', 'ler') : null;
  const apolices = await apolicesRepository.list(tenantId, { donoIds });
  const clienteIdsEmEscopo = new Set(apolices.map((a) => a.cliente_id));

  const clientes = (await carteiraClientesRepository.list(tenantId, {})).filter((c) =>
    clienteIdsEmEscopo.has(c.id)
  );

  const leadIds = clientes.map((c) => c.lead_id).filter(Boolean);
  const arquivos = leadIds.length ? await arquivosRepository.list(tenantId, { leadIds }) : [];
  const arquivosPorLead = {};
  for (const a of arquivos) {
    if (!a.lead_id) continue;
    (arquivosPorLead[a.lead_id] = arquivosPorLead[a.lead_id] || []).push(a);
  }

  const incompletos = [];
  let clientesComPdf = 0;
  for (const c of clientes) {
    const faltando = CAMPOS_OBRIGATORIOS_CLIENTE.filter((f) => !c[f.chave]).map((f) => f.label);
    const arqsDoCliente = c.lead_id ? arquivosPorLead[c.lead_id] || [] : [];
    if (arqsDoCliente.length > 0) clientesComPdf += 1;
    if (faltando.length > 0) {
      incompletos.push({
        id: c.id,
        nome: c.nome,
        campos_faltando: faltando,
        score_completude: Math.round(
          ((CAMPOS_OBRIGATORIOS_CLIENTE.length - faltando.length) / CAMPOS_OBRIGATORIOS_CLIENTE.length) * 100
        ),
      });
    }
  }
  incompletos.sort((a, b) => a.score_completude - b.score_completude);

  const cotacoesPendentes = arquivos.filter(
    (a) => a.tipo === 'cotacao' && a.status_extracao === 'processando'
  ).length;

  return {
    total_clientes: clientes.length,
    clientes_sem_cpf: clientes.filter((c) => !c.cpf_cnpj).length,
    clientes_sem_telefone: clientes.filter((c) => !c.telefone).length,
    clientes_sem_nascimento: clientes.filter((c) => !c.data_nascimento).length,
    clientes_com_pdf: clientesComPdf,
    clientes_sem_pdf: clientes.length - clientesComPdf,
    cotacoes_pendentes: cotacoesPendentes,
    incompletos: incompletos.slice(0, 20),
  };
}

const CAMPOS_EDITAVEIS_CLIENTE = ['telefone', 'email', 'cpf_cnpj', 'data_nascimento', 'empresa'];

// Edição rápida de cliente (usada pelo CTA "Completar cadastro" da Inteligência).
// Não é um CRUD completo — só os campos que entram no cálculo de completude.
async function atualizarCliente(tenantId, id, patch, usuario) {
  const existente = await carteiraClientesRepository.findById(tenantId, id);
  if (!existente) throw new NotFoundError('Cliente não encontrado.');

  const donoIds = usuario ? await resolverDonoIds(usuario, 'carteira', 'escrever') : null;
  if (Array.isArray(donoIds)) {
    const apolicesDoCliente = await apolicesRepository.list(tenantId, { cliente_id: id, donoIds });
    if (apolicesDoCliente.length === 0) throw new NotFoundError('Cliente não encontrado.');
  }

  const body = {};
  for (const campo of CAMPOS_EDITAVEIS_CLIENTE) {
    if (patch[campo] !== undefined) body[campo] = patch[campo] || null;
  }
  const atualizado = await carteiraClientesRepository.update(tenantId, id, body);
  if (!atualizado) throw new NotFoundError('Cliente não encontrado.');
  return atualizado;
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
  atualizarCliente,
  metricas,
  recalcularHealth,
  cancelarCliente,
  retomarContatos,
  MOTIVOS_CANCELAMENTO_CLIENTE,
  ValidationError,
  NotFoundError,
};
