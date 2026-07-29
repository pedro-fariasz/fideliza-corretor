const notificacaoService = require('../services/notificacaoService');

function parseFiltros(query) {
  const f = {};
  if (query.status) f.status = String(query.status);
  if (query.tipo) f.tipo = String(query.tipo);
  if (query.de) f.de = String(query.de);
  if (query.ate) f.ate = String(query.ate);
  if (query.limit) f.limit = Number(query.limit);
  return f;
}

async function listar(req, res, next) {
  try {
    const data = await notificacaoService.listar(req.tenantId, req.user.id, parseFiltros(req.query));
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function pendentes(req, res, next) {
  try {
    const data = await notificacaoService.listarPendentes(req.tenantId, req.user.id);
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function badge(req, res, next) {
  try {
    const data = await notificacaoService.badge(req.tenantId, req.user.id);
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function marcarEnviada(req, res, next) {
  try {
    const data = await notificacaoService.marcarEnviada(req.tenantId, req.user.id, req.params.id);
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function marcarVisualizada(req, res, next) {
  try {
    const data = await notificacaoService.marcarVisualizada(req.tenantId, req.user.id, req.params.id);
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function descartar(req, res, next) {
  try {
    const data = await notificacaoService.descartar(req.tenantId, req.user.id, req.params.id);
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

module.exports = { listar, pendentes, badge, marcarEnviada, marcarVisualizada, descartar };
