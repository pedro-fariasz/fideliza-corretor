// =============================================================================
// posvendasConfigService — configuração da esteira: fluxos (etapas), mensagens
// e os padrões de fábrica materializados por conta.
//
// garantirDefaults(tenant, categoria) é idempotente e cobre contas antigas: a
// primeira vez que a esteira é usada (tela, job ou hook de venda) as etapas e
// mensagens de fábrica passam a existir no banco e ficam editáveis.
// =============================================================================
const etapasRepo = require('../repositories/posvendasEtapasRepository');
const mensagensRepo = require('../repositories/posvendasMensagensRepository');
const defaults = require('../config/posvendasDefaults');

const GATILHOS = ['venda', 'renovacao', 'vencimento', 'aniversario'];

class ValidationError extends Error {
  constructor(m) { super(m); this.name = 'ValidationError'; this.statusCode = 400; }
}

function validarCategoria(categoria) {
  if (!defaults.CATEGORIAS_POSVENDA.includes(categoria)) {
    throw new ValidationError(`Categoria inválida. Aceitas: ${defaults.CATEGORIAS_POSVENDA.join(', ')}.`);
  }
}

// Garante etapas + mensagens de fábrica para a categoria (fluxo da categoria,
// produto_id nulo). Idempotente: se já existir etapa, não recria.
async function garantirDefaults(tenantId, categoria) {
  validarCategoria(categoria);
  const existentes = await etapasRepo.list(tenantId, { categoria, produto_id: null });
  if (existentes.length === 0) {
    await etapasRepo.createMany(
      tenantId,
      defaults.ETAPAS_PADRAO.map((e) => ({ ...e, categoria, produto_id: null }))
    );
  }
  const msgs = await mensagensRepo.list(tenantId, { categoria });
  if (msgs.length === 0) {
    await mensagensRepo.createMany(
      tenantId,
      defaults.ETAPAS_PADRAO.map((e) => ({
        categoria,
        etapa_chave: e.chave,
        texto: defaults.mensagemPadrao(categoria, e.chave),
        is_padrao: true,
      }))
    );
  }
}

// Etapas EFETIVAS de um produto: se o produto tem fluxo próprio, ele sobrescreve
// o da categoria; senão usa o da categoria (garantindo os defaults).
async function etapasEfetivas(tenantId, categoria, produtoId) {
  validarCategoria(categoria);
  if (produtoId) {
    const doProduto = await etapasRepo.list(tenantId, { categoria, produto_id: produtoId });
    if (doProduto.length > 0) return doProduto;
  }
  await garantirDefaults(tenantId, categoria);
  return etapasRepo.list(tenantId, { categoria, produto_id: null });
}

// --- Telas de configuração ---------------------------------------------------

async function listarFluxo(tenantId, categoria) {
  validarCategoria(categoria);
  await garantirDefaults(tenantId, categoria);
  const etapas = await etapasRepo.list(tenantId, { categoria, produto_id: null });
  return { categoria, etapas };
}

async function atualizarEtapa(tenantId, etapaId, patch) {
  const etapa = await etapasRepo.findById(tenantId, etapaId);
  if (!etapa) throw new ValidationError('Etapa não encontrada nesta conta.');
  const out = {};
  if (patch.nome !== undefined) out.nome = String(patch.nome).trim();
  if (patch.ordem !== undefined) out.ordem = Number(patch.ordem);
  if (patch.ativo !== undefined) out.ativo = Boolean(patch.ativo);
  if (patch.gatilho_tipo !== undefined) {
    if (!GATILHOS.includes(patch.gatilho_tipo)) {
      throw new ValidationError(`gatilho_tipo inválido. Aceitos: ${GATILHOS.join(', ')}.`);
    }
    out.gatilho_tipo = patch.gatilho_tipo;
  }
  if (patch.gatilho_dias !== undefined) {
    const n = Number(patch.gatilho_dias);
    if (!Number.isInteger(n)) throw new ValidationError('gatilho_dias deve ser um inteiro.');
    out.gatilho_dias = n;
  }
  return etapasRepo.update(tenantId, etapaId, out);
}

async function criarEtapa(tenantId, categoria, input) {
  validarCategoria(categoria);
  const body = input || {};
  if (!body.nome) throw new ValidationError('Informe o nome da etapa.');
  if (!GATILHOS.includes(body.gatilho_tipo)) {
    throw new ValidationError(`gatilho_tipo inválido. Aceitos: ${GATILHOS.join(', ')}.`);
  }
  const chave = body.chave || `custom_${Date.now()}`;
  return etapasRepo.create(tenantId, {
    categoria,
    produto_id: null,
    chave,
    nome: String(body.nome).trim(),
    ordem: Number(body.ordem) || 99,
    gatilho_tipo: body.gatilho_tipo,
    gatilho_dias: Number(body.gatilho_dias) || 0,
    ativo: body.ativo !== false,
  });
}

// Restaura TODO o fluxo de fábrica da categoria (etapas + mensagens).
async function restaurarPadraoCategoria(tenantId, categoria) {
  validarCategoria(categoria);
  await etapasRepo.removeByCategoria(tenantId, categoria);
  await mensagensRepo.removeByCategoria(tenantId, categoria);
  await garantirDefaults(tenantId, categoria);
  return listarFluxo(tenantId, categoria);
}

// --- Mensagens ---------------------------------------------------------------

async function listarMensagens(tenantId, categoria) {
  validarCategoria(categoria);
  await garantirDefaults(tenantId, categoria);
  return mensagensRepo.list(tenantId, { categoria });
}

async function salvarMensagem(tenantId, categoria, etapaChave, texto) {
  validarCategoria(categoria);
  if (!etapaChave) throw new ValidationError('Etapa da mensagem é obrigatória.');
  if (!texto || !String(texto).trim()) throw new ValidationError('O texto da mensagem não pode ficar vazio.');
  const padrao = defaults.mensagemPadrao(categoria, etapaChave);
  const isPadrao = String(texto).trim() === String(padrao).trim();
  return mensagensRepo.upsert(tenantId, categoria, etapaChave, String(texto), isPadrao);
}

// Redefine só UMA mensagem para o texto de fábrica.
async function redefinirMensagem(tenantId, categoria, etapaChave) {
  validarCategoria(categoria);
  const padrao = defaults.mensagemPadrao(categoria, etapaChave);
  return mensagensRepo.upsert(tenantId, categoria, etapaChave, padrao, true);
}

module.exports = {
  garantirDefaults,
  etapasEfetivas,
  listarFluxo,
  criarEtapa,
  atualizarEtapa,
  restaurarPadraoCategoria,
  listarMensagens,
  salvarMensagem,
  redefinirMensagem,
  validarCategoria,
  ValidationError,
};
