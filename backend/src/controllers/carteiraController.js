const apolicesService = require('../services/apolicesService');
const carteiraService = require('../services/carteiraService');

function parseFiltros(query) {
  const f = {};
  if (query.status) f.status = String(query.status);
  if (query.cliente_id) f.cliente_id = String(query.cliente_id);
  if (query.de) f.de = String(query.de);
  if (query.ate) f.ate = String(query.ate);
  return f;
}

async function pipeline(req, res, next) {
  try {
    const data = await apolicesService.pipeline(req.tenantId, parseFiltros(req.query), req.user);
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function listar(req, res, next) {
  try {
    const data = await apolicesService.listar(req.tenantId, parseFiltros(req.query), req.user);
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function obter(req, res, next) {
  try {
    const data = await apolicesService.obter(req.tenantId, req.params.id, req.user);
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function listarClientes(req, res, next) {
  try {
    const filtros = {};
    if (req.query.busca) filtros.busca = String(req.query.busca);
    const data = await carteiraService.listarClientes(req.tenantId, filtros, req.user);
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function saudeDados(req, res, next) {
  try {
    const data = await carteiraService.saudeDados(req.tenantId, req.user);
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function atualizarCliente(req, res, next) {
  try {
    const data = await carteiraService.atualizarCliente(req.tenantId, req.params.id, req.body, req.user);
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function metricas(req, res, next) {
  try {
    const data = await carteiraService.metricas(req.tenantId, parseFiltros(req.query), req.user);
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function negocioAvulso(req, res, next) {
  try {
    const data = await apolicesService.criarNegocioAvulso(req.tenantId, req.body, req.user);
    return res.status(201).json(data);
  } catch (err) {
    return next(err);
  }
}

async function renovar(req, res, next) {
  try {
    const data = await apolicesService.renovar(req.tenantId, req.params.id, req.body, req.user);
    return res.status(201).json(data);
  } catch (err) {
    return next(err);
  }
}

async function cancelar(req, res, next) {
  try {
    const data = await apolicesService.cancelar(req.tenantId, req.params.id, req.body && req.body.motivo, req.user);
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function cancelarCliente(req, res, next) {
  try {
    const data = await carteiraService.cancelarCliente(req.tenantId, req.params.id, req.body, req.user);
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  pipeline,
  listar,
  listarClientes,
  atualizarCliente,
  obter,
  metricas,
  saudeDados,
  negocioAvulso,
  renovar,
  cancelar,
  cancelarCliente,
};
