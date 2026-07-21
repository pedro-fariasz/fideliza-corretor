const comissoesService = require('../services/comissoesService');

function parseFiltros(query) {
  const filtros = {};
  if (query.status) filtros.status = String(query.status);
  if (query.beneficiario) filtros.beneficiario = String(query.beneficiario);
  if (query.de) filtros.data_prevista_de = String(query.de);
  if (query.ate) filtros.data_prevista_ate = String(query.ate);
  return filtros;
}

async function listar(req, res, next) {
  try {
    const comissoes = await comissoesService.listar(req.tenantId, parseFiltros(req.query), req.user);
    return res.json(comissoes);
  } catch (err) {
    return next(err);
  }
}

async function receber(req, res, next) {
  try {
    const comissao = await comissoesService.marcarRecebida(req.tenantId, req.params.id, req.body.data_recebida, req.user);
    return res.json(comissao);
  } catch (err) {
    return next(err);
  }
}

async function estornar(req, res, next) {
  try {
    const comissao = await comissoesService.estornarRecebida(req.tenantId, req.params.id, req.user);
    return res.json(comissao);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listar,
  receber,
  estornar,
};
