const agendaService = require('../services/agendaService');

function parseFiltros(query) {
  const filtros = {};
  if (query.de) filtros.de = String(query.de);
  if (query.ate) filtros.ate = String(query.ate);
  if (query.lead_id) filtros.lead_id = String(query.lead_id);
  return filtros;
}

async function criar(req, res, next) {
  try {
    const compromisso = await agendaService.criar(req.tenantId, req.body, req.user);
    return res.status(201).json(compromisso);
  } catch (err) {
    return next(err);
  }
}

async function listar(req, res, next) {
  try {
    const filtros = parseFiltros(req.query);
    // "minha agenda" (default sugerido) vs "equipe" (todos do tenant).
    if (req.query.equipe === 'true' || req.query.equipe === '1') {
      // sem filtro de usuário: mostra a conta inteira.
    } else {
      filtros.usuario_id = req.user.id;
    }
    const compromissos = await agendaService.listar(req.tenantId, filtros);
    return res.json(compromissos);
  } catch (err) {
    return next(err);
  }
}

async function obter(req, res, next) {
  try {
    const compromisso = await agendaService.obterPorId(req.tenantId, req.params.id);
    return res.json(compromisso);
  } catch (err) {
    return next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const compromisso = await agendaService.atualizar(req.tenantId, req.params.id, req.body);
    return res.json(compromisso);
  } catch (err) {
    return next(err);
  }
}

async function remover(req, res, next) {
  try {
    const resultado = await agendaService.remover(req.tenantId, req.params.id);
    return res.json(resultado);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  criar,
  listar,
  obter,
  atualizar,
  remover,
};
