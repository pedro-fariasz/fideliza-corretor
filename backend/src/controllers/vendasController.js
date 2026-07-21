const vendasService = require('../services/vendasService');

function parseFiltros(query) {
  const filtros = {};
  if (query.status) filtros.status = String(query.status);
  if (query.produto_id) filtros.produto_id = String(query.produto_id);
  if (query.data_de) filtros.data_de = String(query.data_de);
  if (query.data_ate) filtros.data_ate = String(query.data_ate);
  return filtros;
}

async function criar(req, res, next) {
  try {
    const venda = await vendasService.criar(req.tenantId, req.body, req.user);
    return res.status(201).json(venda);
  } catch (err) {
    return next(err);
  }
}

async function listar(req, res, next) {
  try {
    const filtros = parseFiltros(req.query);
    if (req.query.meus === 'true' || req.query.meus === '1') filtros.vendedor_id = req.user.id;
    const vendas = await vendasService.listar(req.tenantId, filtros);
    return res.json(vendas);
  } catch (err) {
    return next(err);
  }
}

async function obter(req, res, next) {
  try {
    const venda = await vendasService.obterPorId(req.tenantId, req.params.id);
    return res.json(venda);
  } catch (err) {
    return next(err);
  }
}

async function cancelar(req, res, next) {
  try {
    const venda = await vendasService.cancelar(req.tenantId, req.params.id, req.user);
    return res.json(venda);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  criar,
  listar,
  obter,
  cancelar,
};
