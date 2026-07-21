const leadsService = require('../services/leadsService');

function parseFiltros(query) {
  const filtros = {};
  if (query.estagio) filtros.estagio = String(query.estagio);
  if (query.origem_especifica) filtros.origem_especifica = String(query.origem_especifica);
  if (query.busca) filtros.busca = String(query.busca);
  if (query.telefone) filtros.telefone = String(query.telefone);
  // "ativos" (default do funil) vs "todos"
  if (query.status === 'ativo' || query.status === 'perdido') filtros.status = query.status;
  return filtros;
}

async function criar(req, res, next) {
  try {
    const lead = await leadsService.criar(req.tenantId, req.body, req.user);
    return res.status(201).json(lead);
  } catch (err) {
    return next(err);
  }
}

async function listar(req, res, next) {
  try {
    const filtros = parseFiltros(req.query);
    // "meus" leads = do usuário logado.
    if (req.query.meus === 'true' || req.query.meus === '1') filtros.dono_id = req.user.id;
    const leads = await leadsService.listar(req.tenantId, filtros, req.user);
    return res.json(leads);
  } catch (err) {
    return next(err);
  }
}

async function obter(req, res, next) {
  try {
    const lead = await leadsService.obterPorId(req.tenantId, req.params.id, req.user);
    return res.json(lead);
  } catch (err) {
    return next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const lead = await leadsService.atualizar(req.tenantId, req.params.id, req.body, req.user);
    return res.json(lead);
  } catch (err) {
    return next(err);
  }
}

// Funil: mover card de estágio.
async function mudarEstagio(req, res, next) {
  try {
    const lead = await leadsService.mudarEstagio(req.tenantId, req.params.id, req.body.estagio, req.user);
    return res.json(lead);
  } catch (err) {
    return next(err);
  }
}

async function mudarStatus(req, res, next) {
  try {
    const lead = await leadsService.mudarStatus(
      req.tenantId,
      req.params.id,
      req.body.status,
      req.body.motivo_perda,
      req.user
    );
    return res.json(lead);
  } catch (err) {
    return next(err);
  }
}

async function listarInteracoes(req, res, next) {
  try {
    const interacoes = await leadsService.listarInteracoes(req.tenantId, req.params.id, req.user);
    return res.json(interacoes);
  } catch (err) {
    return next(err);
  }
}

async function registrarInteracao(req, res, next) {
  try {
    const interacao = await leadsService.registrarInteracao(req.tenantId, req.params.id, req.body, req.user);
    return res.status(201).json(interacao);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  criar,
  listar,
  obter,
  atualizar,
  mudarEstagio,
  mudarStatus,
  listarInteracoes,
  registrarInteracao,
};
