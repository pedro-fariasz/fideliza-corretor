const produtosService = require('../services/produtosService');

function parseFiltros(query) {
  const filtros = {};
  if (query.ativo === 'true' || query.ativo === '1') filtros.ativo = true;
  if (query.ativo === 'false' || query.ativo === '0') filtros.ativo = false;
  if (query.categoria) filtros.categoria = String(query.categoria);
  return filtros;
}

async function criar(req, res, next) {
  try {
    const produto = await produtosService.criar(req.tenantId, req.body);
    return res.status(201).json(produto);
  } catch (err) {
    return next(err);
  }
}

async function listar(req, res, next) {
  try {
    const produtos = await produtosService.listar(req.tenantId, parseFiltros(req.query));
    return res.json(produtos);
  } catch (err) {
    return next(err);
  }
}

async function obter(req, res, next) {
  try {
    const produto = await produtosService.obterPorId(req.tenantId, req.params.id);
    return res.json(produto);
  } catch (err) {
    return next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const produto = await produtosService.atualizar(req.tenantId, req.params.id, req.body);
    return res.json(produto);
  } catch (err) {
    return next(err);
  }
}

async function remover(req, res, next) {
  try {
    const produto = await produtosService.desativar(req.tenantId, req.params.id);
    return res.json(produto);
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
