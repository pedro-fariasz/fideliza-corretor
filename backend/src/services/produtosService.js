const produtosRepository = require('../repositories/produtosRepository');

const CATEGORIAS = ['consorcio', 'seguro', 'saude', 'imobiliario'];
// Vertical única = plano de saúde. tipo_plano_saude substitui categoria no app;
// categoria vira legado e é default 'saude' quando o form não a envia.
const TIPOS_PLANO_SAUDE = ['PF', 'PME', 'Adesao', 'PJ', 'Odontologico'];
const TIPOS_COMISSAO = ['limitada', 'recorrente'];
const INICIOS_PAGAMENTO = ['mes_seguinte', 'mesmo_mes'];

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

function normalizarString(v) {
  if (typeof v !== 'string') return v;
  const t = v.trim();
  return t === '' ? null : t;
}

// Converte "10", "1.5" em número; deixa números como estão; demais viram NaN-safe.
function coerceNumero(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return v; // mantém p/ a validação acusar tipo inválido
}

function normalizarPayload(input) {
  const out = { ...input };
  for (const k of Object.keys(out)) {
    if (typeof out[k] === 'string') out[k] = normalizarString(out[k]);
  }
  if (out.percentual !== undefined) out.percentual = coerceNumero(out.percentual);
  if (out.parcelas_limite !== undefined) out.parcelas_limite = coerceNumero(out.parcelas_limite);
  if (out.dia_pagamento !== undefined) out.dia_pagamento = coerceNumero(out.dia_pagamento);
  if (out.vigencia_meses !== undefined) out.vigencia_meses = coerceNumero(out.vigencia_meses);
  return out;
}

// Valida um estado COMPLETO do produto (já mesclado, no caso de update).
function validar(p) {
  if (!p.nome || String(p.nome).trim().length < 3) {
    throw new ValidationError('O campo "nome" é obrigatório (mínimo 3 caracteres).');
  }
  if (!p.categoria || !CATEGORIAS.includes(p.categoria)) {
    throw new ValidationError(`categoria inválida. Valores aceitos: ${CATEGORIAS.join(', ')}.`);
  }
  if (p.tipo_plano_saude != null && !TIPOS_PLANO_SAUDE.includes(p.tipo_plano_saude)) {
    throw new ValidationError(`tipo_plano_saude inválido. Valores aceitos: ${TIPOS_PLANO_SAUDE.join(', ')}.`);
  }
  if (!p.tipo_comissao || !TIPOS_COMISSAO.includes(p.tipo_comissao)) {
    throw new ValidationError(`tipo_comissao inválido. Valores aceitos: ${TIPOS_COMISSAO.join(', ')}.`);
  }
  if (typeof p.percentual !== 'number' || Number.isNaN(p.percentual) || p.percentual <= 0 || p.percentual > 100) {
    throw new ValidationError('percentual deve ser um número entre 0,01 e 100.');
  }
  if (p.tipo_comissao === 'limitada') {
    if (!Number.isInteger(p.parcelas_limite) || p.parcelas_limite < 1 || p.parcelas_limite > 120) {
      throw new ValidationError('parcelas_limite deve ser um inteiro entre 1 e 120 para comissão limitada.');
    }
  }
  const inicio = p.inicio_pagamento || 'mes_seguinte';
  if (!INICIOS_PAGAMENTO.includes(inicio)) {
    throw new ValidationError(`inicio_pagamento inválido. Valores aceitos: ${INICIOS_PAGAMENTO.join(', ')}.`);
  }
  if (inicio === 'mesmo_mes') {
    if (!Number.isInteger(p.dia_pagamento) || p.dia_pagamento < 1 || p.dia_pagamento > 28) {
      throw new ValidationError('dia_pagamento deve ser um inteiro entre 1 e 28 quando o pagamento é no mesmo mês.');
    }
  }
  if (p.vigencia_meses !== undefined && p.vigencia_meses !== null) {
    if (!Number.isInteger(p.vigencia_meses) || p.vigencia_meses < 1 || p.vigencia_meses > 120) {
      throw new ValidationError('vigencia_meses deve ser um inteiro entre 1 e 120.');
    }
  }
}

// Zera campos irrelevantes conforme a regra escolhida (mantém o banco coerente
// com os CHECKs da migration e evita lixo).
function limparIrrelevantes(p) {
  const out = { ...p };
  out.inicio_pagamento = out.inicio_pagamento || 'mes_seguinte';
  if (out.tipo_comissao === 'recorrente') out.parcelas_limite = null;
  if (out.inicio_pagamento === 'mes_seguinte') out.dia_pagamento = null;
  if (out.ativo === undefined) out.ativo = true;
  return out;
}

async function criar(tenantId, input) {
  const payload = normalizarPayload(input || {});
  delete payload.id;
  delete payload.tenant_id;
  delete payload.criado_em;
  delete payload.atualizado_em;

  // Vertical única = saúde: se o form não envia categoria (legado), assume 'saude'.
  if (!payload.categoria) payload.categoria = 'saude';

  validar(payload);
  const limpo = limparIrrelevantes(payload);

  try {
    return await produtosRepository.create(tenantId, limpo);
  } catch (err) {
    console.error('[produtosService.criar] erro ao inserir produto', {
      tenant_id: tenantId,
      error: err.message,
    });
    throw err;
  }
}

async function listar(tenantId, filtros) {
  return produtosRepository.list(tenantId, filtros);
}

async function obterPorId(tenantId, id) {
  const produto = await produtosRepository.findById(tenantId, id);
  if (!produto) throw new NotFoundError('Produto não encontrado.');
  return produto;
}

async function atualizar(tenantId, id, input) {
  const existente = await produtosRepository.findById(tenantId, id);
  if (!existente) throw new NotFoundError('Produto não encontrado.');

  const patch = normalizarPayload(input || {});
  delete patch.id;
  delete patch.tenant_id;
  delete patch.criado_em;
  delete patch.atualizado_em;

  // valida o estado final (mesclado) e limpa os campos irrelevantes.
  const merged = limparIrrelevantes({ ...existente, ...patch });
  validar(merged);

  try {
    const atualizado = await produtosRepository.update(tenantId, id, merged);
    if (!atualizado) throw new NotFoundError('Produto não encontrado.');
    return atualizado;
  } catch (err) {
    console.error('[produtosService.atualizar] erro ao atualizar produto', {
      tenant_id: tenantId,
      produto_id: id,
      error: err.message,
    });
    throw err;
  }
}

// "Remover" = desativar (produto pode estar referenciado por vendas).
async function desativar(tenantId, id) {
  const existente = await produtosRepository.findById(tenantId, id);
  if (!existente) throw new NotFoundError('Produto não encontrado.');

  const atualizado = await produtosRepository.update(tenantId, id, { ativo: false });
  if (!atualizado) throw new NotFoundError('Produto não encontrado.');
  return atualizado;
}

module.exports = {
  criar,
  listar,
  obterPorId,
  atualizar,
  desativar,
  ValidationError,
  NotFoundError,
};
