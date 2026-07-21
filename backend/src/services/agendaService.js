const compromissosRepository = require('../repositories/compromissosRepository');
const leadsRepository = require('../repositories/leadsRepository');
const { resolverDonoIds, donoPermitido } = require('./escopoService');

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

function parseDataHora(v, campo) {
  if (!v) throw new ValidationError(`${campo} é obrigatório.`);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    throw new ValidationError(`${campo} inválido (use data/hora ISO, ex.: 2026-07-21T14:30:00Z).`);
  }
  return d;
}

async function validarLead(tenantId, leadId) {
  if (!leadId) return null;
  const lead = await leadsRepository.findById(tenantId, leadId);
  if (!lead) throw new ValidationError('Lead vinculado não encontrado nesta conta.');
  return lead;
}

async function criar(tenantId, input, usuario) {
  const body = input || {};
  const titulo = normalizarString(body.titulo);
  if (!titulo) throw new ValidationError('O campo "título" é obrigatório.');

  const inicio = parseDataHora(body.data_inicio, 'data_inicio');
  const fim = parseDataHora(body.data_fim, 'data_fim');
  if (fim.getTime() < inicio.getTime()) {
    throw new ValidationError('data_fim não pode ser anterior a data_inicio.');
  }

  await validarLead(tenantId, body.lead_id);

  const payload = {
    usuario_id: usuario ? usuario.id : null, // dono = usuário logado, nunca do body
    lead_id: body.lead_id || null,
    titulo,
    descricao: normalizarString(body.descricao),
    data_inicio: inicio.toISOString(),
    data_fim: fim.toISOString(),
  };

  return compromissosRepository.create(tenantId, payload);
}

async function listar(tenantId, filtros, user) {
  const donoIds = user ? await resolverDonoIds(user, 'agenda', 'ler') : null;
  return compromissosRepository.list(tenantId, { ...filtros, donoIds });
}

async function obterPorId(tenantId, id, user) {
  const compromisso = await compromissosRepository.findById(tenantId, id);
  if (!compromisso) throw new NotFoundError('Compromisso não encontrado.');
  if (user) {
    const donoIds = await resolverDonoIds(user, 'agenda', 'escrever');
    if (!donoPermitido(donoIds, compromisso.usuario_id)) throw new NotFoundError('Compromisso não encontrado.');
  }
  return compromisso;
}

async function atualizar(tenantId, id, input, user) {
  const existente = await obterPorId(tenantId, id, user); // tenant + escopo

  const body = input || {};
  const patch = {};

  if (body.titulo !== undefined) {
    const titulo = normalizarString(body.titulo);
    if (!titulo) throw new ValidationError('O campo "título" não pode ficar vazio.');
    patch.titulo = titulo;
  }
  if (body.descricao !== undefined) patch.descricao = normalizarString(body.descricao);
  if (body.lead_id !== undefined) {
    await validarLead(tenantId, body.lead_id);
    patch.lead_id = body.lead_id || null;
  }

  // valida a coerência início/fim considerando o estado final.
  const inicio = body.data_inicio !== undefined
    ? parseDataHora(body.data_inicio, 'data_inicio')
    : new Date(existente.data_inicio);
  const fim = body.data_fim !== undefined
    ? parseDataHora(body.data_fim, 'data_fim')
    : new Date(existente.data_fim);
  if (fim.getTime() < inicio.getTime()) {
    throw new ValidationError('data_fim não pode ser anterior a data_inicio.');
  }
  if (body.data_inicio !== undefined) patch.data_inicio = inicio.toISOString();
  if (body.data_fim !== undefined) patch.data_fim = fim.toISOString();

  const atualizado = await compromissosRepository.update(tenantId, id, patch);
  if (!atualizado) throw new NotFoundError('Compromisso não encontrado.');
  return atualizado;
}

async function remover(tenantId, id, user) {
  await obterPorId(tenantId, id, user); // tenant + escopo
  const removido = await compromissosRepository.remove(tenantId, id);
  if (!removido) throw new NotFoundError('Compromisso não encontrado.');
  return { id: removido.id, removido: true };
}

module.exports = {
  criar,
  listar,
  obterPorId,
  atualizar,
  remover,
  ValidationError,
  NotFoundError,
};
