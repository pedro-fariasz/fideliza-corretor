const clientesRepository = require('../repositories/clientesRepository');

const OBRIGATORIOS = ['nome', 'telefone_whatsapp', 'data_inicio_plano', 'operadora'];
const IMPORTANTES = ['data_aniversario', 'email', 'tipo_plano'];
const COMPLEMENTARES = [
  'nivel_sinistralidade',
  'data_encerramento',
  'carencia_meses',
  'qtd_dependentes',
];

const PESO_OBRIGATORIO = 25;
const PESO_IMPORTANTE = 10;
const PESO_COMPLEMENTAR = 5;

const TIPOS_PLANO = ['PF', 'PME', 'Adesao', 'PJ'];
const NIVEIS_SINISTRALIDADE = ['baixo', 'medio', 'alto'];
const STATUS_VALIDOS = ['ativo', 'inadimplente', 'cancelado'];

function isPreenchido(campo, valor) {
  if (valor === null || valor === undefined) return false;
  if (campo === 'qtd_dependentes' || campo === 'carencia_meses') {
    return typeof valor === 'number' && !Number.isNaN(valor);
  }
  if (typeof valor === 'string') return valor.trim() !== '';
  return true;
}

function calcularScore(cliente) {
  let score = 100;
  for (const campo of OBRIGATORIOS) {
    if (!isPreenchido(campo, cliente[campo])) score -= PESO_OBRIGATORIO;
  }
  for (const campo of IMPORTANTES) {
    if (!isPreenchido(campo, cliente[campo])) score -= PESO_IMPORTANTE;
  }
  for (const campo of COMPLEMENTARES) {
    if (!isPreenchido(campo, cliente[campo])) score -= PESO_COMPLEMENTAR;
  }
  if (score < 0) score = 0;
  if (score > 100) score = 100;
  return score;
}

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
  if (v === undefined || v === null) return v;
  if (typeof v !== 'string') return v;
  const t = v.trim();
  return t === '' ? null : t;
}

function normalizarPayload(input) {
  const out = { ...input };
  for (const k of Object.keys(out)) {
    if (typeof out[k] === 'string') out[k] = normalizarString(out[k]);
  }
  return out;
}

function validarPayload(payload, { criando }) {
  if (criando) {
    if (!isPreenchido('nome', payload.nome)) {
      throw new ValidationError('O campo "nome" é obrigatório.');
    }
  } else if (payload.nome !== undefined && !isPreenchido('nome', payload.nome)) {
    throw new ValidationError('O campo "nome" não pode ficar vazio.');
  }

  if (payload.tipo_plano !== undefined && payload.tipo_plano !== null) {
    if (!TIPOS_PLANO.includes(payload.tipo_plano)) {
      throw new ValidationError(
        `tipo_plano inválido. Valores aceitos: ${TIPOS_PLANO.join(', ')}.`
      );
    }
  }

  if (payload.nivel_sinistralidade !== undefined && payload.nivel_sinistralidade !== null) {
    if (!NIVEIS_SINISTRALIDADE.includes(payload.nivel_sinistralidade)) {
      throw new ValidationError(
        `nivel_sinistralidade inválido. Valores aceitos: ${NIVEIS_SINISTRALIDADE.join(', ')}.`
      );
    }
  }

  if (payload.status !== undefined && payload.status !== null) {
    if (!STATUS_VALIDOS.includes(payload.status)) {
      throw new ValidationError(
        `status inválido. Valores aceitos: ${STATUS_VALIDOS.join(', ')}.`
      );
    }
  }

  if (payload.vencimento_boleto !== undefined && payload.vencimento_boleto !== null) {
    const v = payload.vencimento_boleto;
    if (!Number.isInteger(v) || v < 1 || v > 31) {
      throw new ValidationError('vencimento_boleto deve ser um inteiro entre 1 e 31.');
    }
  }

  if (payload.qtd_dependentes !== undefined && payload.qtd_dependentes !== null) {
    if (!Number.isInteger(payload.qtd_dependentes) || payload.qtd_dependentes < 0) {
      throw new ValidationError('qtd_dependentes deve ser um inteiro maior ou igual a 0.');
    }
  }

  if (payload.carencia_meses !== undefined && payload.carencia_meses !== null) {
    if (!Number.isInteger(payload.carencia_meses) || payload.carencia_meses < 0) {
      throw new ValidationError('carencia_meses deve ser um inteiro maior ou igual a 0.');
    }
  }
}

async function criar(tenantId, input) {
  const payload = normalizarPayload(input || {});
  // score nunca vem do cliente
  delete payload.score_completude;
  delete payload.tenant_id;
  delete payload.id;

  validarPayload(payload, { criando: true });

  payload.score_completude = calcularScore(payload);

  try {
    return await clientesRepository.create(tenantId, payload);
  } catch (err) {
    console.error('[clientesService.criar] erro ao inserir cliente', {
      tenant_id: tenantId,
      error: err.message,
    });
    throw err;
  }
}

async function listar(tenantId, filtros) {
  return clientesRepository.list(tenantId, filtros);
}

async function obterPorId(tenantId, id) {
  const cliente = await clientesRepository.findById(tenantId, id);
  if (!cliente) throw new NotFoundError('Cliente não encontrado.');
  return cliente;
}

async function atualizar(tenantId, id, input) {
  const existente = await clientesRepository.findById(tenantId, id);
  if (!existente) throw new NotFoundError('Cliente não encontrado.');

  const payload = normalizarPayload(input || {});
  delete payload.score_completude;
  delete payload.tenant_id;
  delete payload.id;
  delete payload.criado_em;
  delete payload.atualizado_em;

  validarPayload(payload, { criando: false });

  // Mescla com o estado atual para recalcular o score corretamente
  const merged = { ...existente, ...payload };
  payload.score_completude = calcularScore(merged);

  try {
    const atualizado = await clientesRepository.update(tenantId, id, payload);
    if (!atualizado) throw new NotFoundError('Cliente não encontrado.');
    return atualizado;
  } catch (err) {
    console.error('[clientesService.atualizar] erro ao atualizar cliente', {
      tenant_id: tenantId,
      cliente_id: id,
      error: err.message,
    });
    throw err;
  }
}

async function remover(tenantId, id) {
  const existente = await clientesRepository.findById(tenantId, id);
  if (!existente) throw new NotFoundError('Cliente não encontrado.');

  try {
    const cancelado = await clientesRepository.softDelete(tenantId, id);
    if (!cancelado) throw new NotFoundError('Cliente não encontrado.');
    return cancelado;
  } catch (err) {
    console.error('[clientesService.remover] erro ao cancelar cliente', {
      tenant_id: tenantId,
      cliente_id: id,
      error: err.message,
    });
    throw err;
  }
}

module.exports = {
  criar,
  listar,
  obterPorId,
  atualizar,
  remover,
  calcularScore,
  ValidationError,
  NotFoundError,
};
