const vendasRepository = require('../repositories/vendasRepository');
const comissoesRepository = require('../repositories/comissoesRepository');
const produtosRepository = require('../repositories/produtosRepository');
const leadsRepository = require('../repositories/leadsRepository');
const interacoesRepository = require('../repositories/interacoesRepository');
const comissaoService = require('./comissaoService');
const { resolverDonoIds, donoPermitido } = require('./escopoService');
const { FEATURE_FLAGS } = require('../config/constants');

const FORMAS_PAGAMENTO = ['debito', 'boleto', 'pix', 'cartao', 'dinheiro', 'outro'];
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function coerceNumero(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && !Number.isNaN(Number(v))) return Number(v);
  return v;
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

async function registrarInteracaoLead(tenantId, leadId, usuarioId, tipo, descricao) {
  if (!leadId) return;
  try {
    await interacoesRepository.create(tenantId, { lead_id: leadId, usuario_id: usuarioId || null, tipo, descricao });
  } catch (err) {
    console.error('[vendasService] falha ao registrar interação da venda', {
      tenant_id: tenantId,
      lead_id: leadId,
      error: err.message,
    });
  }
}

function formatBRL(v) {
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Cria a venda a partir do funil e gera as parcelas de comissão.
 * Move o lead (se houver) para 'venda_concluida'.
 */
async function criar(tenantId, input, usuario) {
  const body = input || {};
  const valor = coerceNumero(body.valor);
  const dataVenda = body.data_venda || hoje();

  // --- validações ---
  if (!body.produto_id) throw new ValidationError('produto_id é obrigatório.');
  if (!(typeof valor === 'number' && valor > 0)) {
    throw new ValidationError('valor da venda deve ser um número maior que zero.');
  }
  if (body.forma_pagamento && !FORMAS_PAGAMENTO.includes(body.forma_pagamento)) {
    throw new ValidationError(`forma_pagamento inválida. Valores aceitos: ${FORMAS_PAGAMENTO.join(', ')}.`);
  }
  if (!DATA_RE.test(String(dataVenda))) {
    throw new ValidationError('data_venda deve estar no formato YYYY-MM-DD.');
  }

  // produto precisa existir e ser do tenant.
  const produto = await produtosRepository.findById(tenantId, body.produto_id);
  if (!produto) throw new ValidationError('Produto não encontrado nesta conta.');

  // lead é opcional, mas se vier precisa ser do tenant E do escopo do usuário.
  let lead = null;
  if (body.lead_id) {
    lead = await leadsRepository.findById(tenantId, body.lead_id);
    if (!lead) throw new ValidationError('Lead não encontrado nesta conta.');
    if (usuario) {
      const donoIds = await resolverDonoIds(usuario, 'leads', 'escrever');
      if (!donoPermitido(donoIds, lead.dono_id)) {
        throw new ValidationError('Você não pode registrar venda para um lead fora da sua carteira.');
      }
    }
  }

  // --- calcula as parcelas ANTES de tocar o banco (função pura) ---
  let parcelas;
  try {
    parcelas = comissaoService.calcularComissoes({ valor, dataVenda, produto });
  } catch (err) {
    throw new ValidationError(`Não foi possível calcular a comissão: ${err.message}`);
  }

  // --- cria a venda ---
  const venda = await vendasRepository.create(tenantId, {
    lead_id: body.lead_id || null,
    produto_id: body.produto_id,
    vendedor_id: usuario ? usuario.id : null,
    valor,
    forma_pagamento: body.forma_pagamento || null,
    data_venda: dataVenda,
    status: 'concluida',
    observacoes: body.observacoes || null,
  });

  // --- gera as comissões; se falhar, desfaz a venda (compensação) ---
  let comissoes;
  try {
    comissoes = await comissoesRepository.createMany(tenantId, venda.id, parcelas);
  } catch (err) {
    console.error('[vendasService.criar] falha ao gerar comissões; desfazendo a venda', {
      tenant_id: tenantId,
      venda_id: venda.id,
      error: err.message,
    });
    try {
      await vendasRepository.remove(tenantId, venda.id);
    } catch (rollbackErr) {
      console.error('[vendasService.criar] falha ao desfazer a venda órfã', {
        tenant_id: tenantId,
        venda_id: venda.id,
        error: rollbackErr.message,
      });
    }
    throw err;
  }

  // --- move o lead pro fim do funil + timeline ---
  if (lead) {
    try {
      await leadsRepository.update(tenantId, lead.id, { estagio: 'venda_concluida', probabilidade: 100 });
    } catch (err) {
      console.error('[vendasService.criar] venda criada, mas falhou ao mover o lead', {
        tenant_id: tenantId,
        lead_id: lead.id,
        venda_id: venda.id,
        error: err.message,
      });
    }
    await registrarInteracaoLead(
      tenantId,
      lead.id,
      usuario && usuario.id,
      'sistema',
      `Venda registrada: ${formatBRL(valor)} — ${produto.nome} (${parcelas.length}x de comissão).`
    );
  }

  // Fase 1: venda gera apólice automaticamente (só quando a carteira está ativa,
  // e nunca quebra a venda se falhar — o registro financeiro já está feito).
  if (FEATURE_FLAGS.carteira && lead) {
    try {
      // require tardio: evita ciclo e só carrega quando a feature está ligada.
      const apolicesService = require('./apolicesService');
      await apolicesService.gerarDeVendaComLead(tenantId, venda, produto, lead);
    } catch (err) {
      console.error('[vendasService.criar] venda ok, mas falhou ao gerar apólice', {
        tenant_id: tenantId,
        venda_id: venda.id,
        error: err.message,
      });
    }
  }

  return { ...venda, comissoes };
}

async function listar(tenantId, filtros, user) {
  const donoIds = user ? await resolverDonoIds(user, 'vendas', 'ler') : null;
  return vendasRepository.list(tenantId, { ...filtros, donoIds });
}

async function obterPorId(tenantId, id, user) {
  const venda = await vendasRepository.findById(tenantId, id);
  if (!venda) throw new NotFoundError('Venda não encontrada.');
  if (user) {
    const donoIds = await resolverDonoIds(user, 'vendas', 'ler');
    if (!donoPermitido(donoIds, venda.vendedor_id)) throw new NotFoundError('Venda não encontrada.');
  }
  const comissoes = await comissoesRepository.listByVenda(tenantId, id);
  return { ...venda, comissoes };
}

async function cancelar(tenantId, id, usuario) {
  const venda = await vendasRepository.findById(tenantId, id);
  if (!venda) throw new NotFoundError('Venda não encontrada.');
  if (usuario) {
    const donoIds = await resolverDonoIds(usuario, 'vendas', 'escrever');
    if (!donoPermitido(donoIds, venda.vendedor_id)) throw new NotFoundError('Venda não encontrada.');
  }
  if (venda.status === 'cancelada') return venda;

  const atualizada = await vendasRepository.update(tenantId, id, { status: 'cancelada' });
  // cancela as parcelas projetadas (mantém as já recebidas).
  await comissoesRepository.cancelByVenda(tenantId, id);

  await registrarInteracaoLead(
    tenantId,
    venda.lead_id,
    usuario && usuario.id,
    'sistema',
    'Venda cancelada; comissões projetadas foram canceladas.'
  );

  return atualizada;
}

module.exports = {
  criar,
  listar,
  obterPorId,
  cancelar,
  ValidationError,
  NotFoundError,
};
