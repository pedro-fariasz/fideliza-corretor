const clientesService = require('../services/clientesService');

function parseFiltros(query) {
  const filtros = {};
  if (query.status) filtros.status = String(query.status);
  if (query.operadora) filtros.operadora = String(query.operadora);
  if (query.incompletos === 'true' || query.incompletos === '1') {
    filtros.incompletos = true;
  }
  return filtros;
}

async function criar(req, res, next) {
  try {
    const cliente = await clientesService.criar(req.tenantId, req.body);
    return res.status(201).json(cliente);
  } catch (err) {
    return next(err);
  }
}

async function listar(req, res, next) {
  try {
    const filtros = parseFiltros(req.query);
    const clientes = await clientesService.listar(req.tenantId, filtros);
    return res.json(clientes);
  } catch (err) {
    return next(err);
  }
}

async function obter(req, res, next) {
  try {
    const cliente = await clientesService.obterPorId(req.tenantId, req.params.id);
    return res.json(cliente);
  } catch (err) {
    return next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const cliente = await clientesService.atualizar(req.tenantId, req.params.id, req.body);
    return res.json(cliente);
  } catch (err) {
    return next(err);
  }
}

async function remover(req, res, next) {
  try {
    const cliente = await clientesService.remover(req.tenantId, req.params.id);
    return res.json(cliente);
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
