const comissoesRepository = require('../repositories/comissoesRepository');

const STATUS_COMISSAO = ['projetada', 'recebida', 'cancelada'];
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

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

async function listar(tenantId, filtros = {}) {
  const f = {};
  if (filtros.status) {
    if (!STATUS_COMISSAO.includes(filtros.status)) {
      throw new ValidationError(`status inválido. Valores aceitos: ${STATUS_COMISSAO.join(', ')}.`);
    }
    f.status = filtros.status;
  }
  if (filtros.beneficiario) f.beneficiario = filtros.beneficiario;
  if (filtros.data_prevista_de) f.data_prevista_de = filtros.data_prevista_de;
  if (filtros.data_prevista_ate) f.data_prevista_ate = filtros.data_prevista_ate;
  return comissoesRepository.list(tenantId, f);
}

// Marca uma parcela como recebida (default: hoje).
async function marcarRecebida(tenantId, id, dataRecebida) {
  const comissao = await comissoesRepository.findById(tenantId, id);
  if (!comissao) throw new NotFoundError('Comissão não encontrada.');
  if (comissao.status === 'cancelada') {
    throw new ValidationError('Não é possível receber uma comissão cancelada.');
  }

  const data = dataRecebida || hoje();
  if (!DATA_RE.test(String(data))) {
    throw new ValidationError('data_recebida deve estar no formato YYYY-MM-DD.');
  }

  const atualizada = await comissoesRepository.update(tenantId, id, {
    status: 'recebida',
    data_recebida: data,
  });
  if (!atualizada) throw new NotFoundError('Comissão não encontrada.');
  return atualizada;
}

// Desfaz o recebimento (volta para projetada).
async function estornarRecebida(tenantId, id) {
  const comissao = await comissoesRepository.findById(tenantId, id);
  if (!comissao) throw new NotFoundError('Comissão não encontrada.');
  if (comissao.status !== 'recebida') return comissao;

  const atualizada = await comissoesRepository.update(tenantId, id, {
    status: 'projetada',
    data_recebida: null,
  });
  return atualizada;
}

module.exports = {
  listar,
  marcarRecebida,
  estornarRecebida,
  ValidationError,
  NotFoundError,
};
