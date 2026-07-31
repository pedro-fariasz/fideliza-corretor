const apolicesRepository = require('../repositories/apolicesRepository');
const carteiraClientesRepository = require('../repositories/carteiraClientesRepository');
const produtosRepository = require('../repositories/produtosRepository');
const leadsRepository = require('../repositories/leadsRepository');
const vendasRepository = require('../repositories/vendasRepository');
const comissoesRepository = require('../repositories/comissoesRepository');
const comissaoService = require('./comissaoService');
const atividadesService = require('./atividadesService');
const metrics = require('./carteiraMetricsService');
const { resolverDonoIds, donoPermitido } = require('./escopoService');
const { FEATURE_FLAGS } = require('../config/constants');

// Fase 2: garante a esteira de pós-venda da categoria do produto. Não-fatal e
// gated pela flag — nunca quebra a criação/renovação da apólice.
async function inicializarPosvenda(tenantId, produto) {
  if (!FEATURE_FLAGS.posvendas) return;
  try {
    const posvendasService = require('./posvendasService');
    await posvendasService.inicializarApolice(tenantId, produto);
  } catch (err) {
    console.error('[apolicesService] apólice ok, mas falhou ao inicializar pós-venda', {
      tenant_id: tenantId, error: err.message,
    });
  }
}

const FORMAS_PAGAMENTO = ['debito', 'boleto', 'pix', 'cartao', 'dinheiro', 'outro'];
const MOTIVOS_CANCELAMENTO = ['preco', 'concorrencia', 'sinistro', 'mudanca_necessidade', 'insatisfacao', 'sem_contato', 'outro'];
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

class ValidationError extends Error {
  constructor(m) { super(m); this.name = 'ValidationError'; this.statusCode = 400; }
}
class NotFoundError extends Error {
  constructor(m) { super(m); this.name = 'NotFoundError'; this.statusCode = 404; }
}

const hoje = () => new Date().toISOString().slice(0, 10);
const coerceNum = (v) => (v === '' || v == null ? null : typeof v === 'number' ? v : Number(v));

// Soma N meses a uma data 'YYYY-MM-DD' e devolve 'YYYY-MM-DD'.
function somarMeses(dataISO, meses) {
  const [a, m, d] = String(dataISO).slice(0, 10).split('-').map(Number);
  const total = (m - 1) + Number(meses || 0);
  const ano = a + Math.floor(total / 12);
  const mes = ((total % 12) + 12) % 12;
  // clamp de dia (ex.: 31 -> último dia do mês)
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const dia = Math.min(d, ultimoDia);
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// --- Cliente da carteira: acha por lead ou cria do lead / dos campos digitados
async function resolverCliente(tenantId, { lead_id, nome, telefone, email, empresa, data_nascimento }) {
  if (lead_id) {
    const existente = await carteiraClientesRepository.findByLead(tenantId, lead_id);
    if (existente) return existente;
    const lead = await leadsRepository.findById(tenantId, lead_id);
    if (!lead) throw new ValidationError('Lead vinculado não encontrado nesta conta.');
    return carteiraClientesRepository.create(tenantId, {
      lead_id,
      nome: nome || lead.nome,
      telefone: telefone || lead.telefone,
      email: email || lead.email,
      empresa: empresa || lead.empresa,
      data_nascimento: data_nascimento || null,
    });
  }
  if (!nome) throw new ValidationError('Informe o nome do cliente.');
  return carteiraClientesRepository.create(tenantId, { nome, telefone, email, empresa, data_nascimento });
}

// Cria as parcelas de comissão de uma venda (reusa o motor testado).
async function gerarComissoes(tenantId, vendaId, valor, dataVenda, produto) {
  const parcelas = comissaoService.calcularComissoes({ valor, dataVenda, produto });
  await comissoesRepository.createMany(tenantId, vendaId, parcelas);
  return parcelas.length;
}

// --- Gera a apólice a partir de uma venda (chamado no hook do funil) ----------
async function gerarDeVenda(tenantId, { venda, produto, cliente_id, corretor_id, data_inicio, data_vencimento }) {
  // Idempotência: uma venda gera no máximo uma apólice (chave: venda_id).
  const existente = await apolicesRepository.findByVenda(tenantId, venda.id);
  if (existente) return existente;

  const inicio = data_inicio || venda.data_venda || hoje();
  const vencimento = data_vencimento || somarMeses(inicio, produto.vigencia_meses || 12);
  const apolice = await apolicesRepository.create(tenantId, {
    cliente_id,
    produto_id: produto.id,
    corretor_id: corretor_id || venda.vendedor_id || null,
    venda_id: venda.id,
    valor: venda.valor,
    forma_pagamento: venda.forma_pagamento || null,
    data_inicio: inicio,
    data_vencimento: vencimento,
    status: 'ativa',
  });

  // Log de negócio (fire-and-forget: falha aqui não derruba a apólice).
  await atividadesService.registrar(tenantId, {
    entidade: 'apolice',
    entidade_id: apolice.id,
    acao: 'apolice_criada',
    detalhes: { venda_id: venda.id, cliente_id, produto_id: produto.id },
  });

  await inicializarPosvenda(tenantId, produto);
  return apolice;
}

// Chamado por vendasService após criar a venda no funil (lead obrigatório aqui).
async function gerarDeVendaComLead(tenantId, venda, produto, lead) {
  const cliente = await resolverCliente(tenantId, { lead_id: lead.id });
  return gerarDeVenda(tenantId, {
    venda,
    produto,
    cliente_id: cliente.id,
    corretor_id: venda.vendedor_id,
  });
}

// --- Negócio avulso: cria cliente + venda + comissões + apólice ---------------
async function criarNegocioAvulso(tenantId, input, usuario) {
  const body = input || {};
  const valor = coerceNum(body.valor);
  const dataInicio = body.data_inicio || hoje();

  if (!body.produto_id) throw new ValidationError('Produto é obrigatório.');
  if (!(valor > 0)) throw new ValidationError('Valor do negócio deve ser maior que zero.');
  if (!DATA_RE.test(String(dataInicio))) throw new ValidationError('data_inicio deve ser YYYY-MM-DD.');
  if (body.forma_pagamento && !FORMAS_PAGAMENTO.includes(body.forma_pagamento)) {
    throw new ValidationError(`forma_pagamento inválida. Aceitos: ${FORMAS_PAGAMENTO.join(', ')}.`);
  }

  const produto = await produtosRepository.findById(tenantId, body.produto_id);
  if (!produto) throw new ValidationError('Produto não encontrado nesta conta.');

  const vencimento = body.data_vencimento || somarMeses(dataInicio, produto.vigencia_meses || 12);
  if (!DATA_RE.test(String(vencimento))) throw new ValidationError('data_vencimento inválida.');

  const cliente = await resolverCliente(tenantId, body);

  // Venda (registro do negócio) + comissões.
  const venda = await vendasRepository.create(tenantId, {
    lead_id: body.lead_id || null,
    produto_id: produto.id,
    vendedor_id: usuario ? usuario.id : null,
    valor,
    forma_pagamento: body.forma_pagamento || null,
    data_venda: dataInicio,
    status: 'concluida',
    observacoes: body.observacoes || null,
  });
  try {
    await gerarComissoes(tenantId, venda.id, valor, dataInicio, produto);
  } catch (e) {
    await vendasRepository.remove(tenantId, venda.id);
    throw e;
  }

  const apolice = await gerarDeVenda(tenantId, {
    venda,
    produto,
    cliente_id: cliente.id,
    corretor_id: usuario ? usuario.id : null,
    data_inicio: dataInicio,
    data_vencimento: vencimento,
  });

  return { ...apolice, cliente };
}

// --- Renovar: preserva histórico e gera novas comissões -----------------------
async function renovar(tenantId, apoliceId, input, usuario) {
  const mae = await apolicesRepository.findById(tenantId, apoliceId);
  if (!mae) throw new NotFoundError('Apólice não encontrada.');
  if (usuario) {
    const donoIds = await resolverDonoIds(usuario, 'carteira', 'escrever');
    if (!donoPermitido(donoIds, mae.corretor_id)) throw new NotFoundError('Apólice não encontrada.');
  }
  if (mae.status === 'renovada') throw new ValidationError('Esta apólice já foi renovada.');

  const produto = await produtosRepository.findById(tenantId, mae.produto_id);
  if (!produto) throw new ValidationError('Produto da apólice não encontrado.');

  const body = input || {};
  const novoValor = coerceNum(body.valor) || Number(mae.valor);
  const inicio = body.data_inicio || mae.data_vencimento; // nova vigência começa no vencimento anterior
  const vencimento = body.data_vencimento || somarMeses(inicio, produto.vigencia_meses || 12);

  // Venda da renovação + comissões (recalculadas).
  const venda = await vendasRepository.create(tenantId, {
    lead_id: null,
    produto_id: produto.id,
    vendedor_id: usuario ? usuario.id : mae.corretor_id,
    valor: novoValor,
    forma_pagamento: mae.forma_pagamento,
    data_venda: inicio,
    status: 'concluida',
    observacoes: 'Renovação de apólice',
  });
  try {
    await gerarComissoes(tenantId, venda.id, novoValor, inicio, produto);
  } catch (e) {
    await vendasRepository.remove(tenantId, venda.id);
    throw e;
  }

  const nova = await apolicesRepository.create(tenantId, {
    cliente_id: mae.cliente_id,
    produto_id: produto.id,
    corretor_id: usuario ? usuario.id : mae.corretor_id,
    venda_id: venda.id,
    valor: novoValor,
    forma_pagamento: mae.forma_pagamento,
    data_inicio: inicio,
    data_vencimento: vencimento,
    status: 'ativa',
    apolice_mae_id: mae.id,
  });

  await apolicesRepository.update(tenantId, mae.id, { status: 'renovada' });
  await inicializarPosvenda(tenantId, produto);
  return nova;
}

// --- Cancelar (motivo obrigatório) -------------------------------------------
async function cancelar(tenantId, apoliceId, motivo, usuario) {
  const apolice = await apolicesRepository.findById(tenantId, apoliceId);
  if (!apolice) throw new NotFoundError('Apólice não encontrada.');
  if (usuario) {
    const donoIds = await resolverDonoIds(usuario, 'carteira', 'escrever');
    if (!donoPermitido(donoIds, apolice.corretor_id)) throw new NotFoundError('Apólice não encontrada.');
  }
  if (!MOTIVOS_CANCELAMENTO.includes(motivo)) {
    throw new ValidationError(`Motivo obrigatório. Aceitos: ${MOTIVOS_CANCELAMENTO.join(', ')}.`);
  }
  return apolicesRepository.update(tenantId, apoliceId, { status: 'cancelada', motivo_cancelamento: motivo });
}

// --- Pipeline / listagem (com escopo) ----------------------------------------
async function _donoIds(usuario) {
  return usuario ? resolverDonoIds(usuario, 'carteira', 'ler') : null;
}

async function pipeline(tenantId, filtros, usuario) {
  const donoIds = await _donoIds(usuario);
  const apolices = await apolicesRepository.list(tenantId, { ...filtros, donoIds });
  const h = hoje();
  return { contadores: metrics.pipelineContadores(apolices, h), apolices };
}

async function listar(tenantId, filtros, usuario) {
  const donoIds = await _donoIds(usuario);
  return apolicesRepository.list(tenantId, { ...filtros, donoIds });
}

async function obter(tenantId, id, usuario) {
  const apolice = await apolicesRepository.findById(tenantId, id);
  if (!apolice) throw new NotFoundError('Apólice não encontrada.');
  const donoIds = await _donoIds(usuario);
  if (!donoPermitido(donoIds, apolice.corretor_id)) throw new NotFoundError('Apólice não encontrada.');
  const cliente = await carteiraClientesRepository.findById(tenantId, apolice.cliente_id);
  const historico = await apolicesRepository.listByCliente(tenantId, apolice.cliente_id);
  const comissoes = apolice.venda_id ? await comissoesRepository.listByVenda(tenantId, apolice.venda_id) : [];
  return { ...apolice, cliente, historico, comissoes };
}

module.exports = {
  resolverCliente,
  gerarDeVenda,
  gerarDeVendaComLead,
  criarNegocioAvulso,
  renovar,
  cancelar,
  pipeline,
  listar,
  obter,
  somarMeses,
  ValidationError,
  NotFoundError,
  MOTIVOS_CANCELAMENTO,
};
