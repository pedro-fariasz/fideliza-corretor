const posvendasService = require('../services/posvendasService');
const configService = require('../services/posvendasConfigService');
const defaults = require('../config/posvendasDefaults');

// --- Esteira (leitura) -------------------------------------------------------
async function pipeline(req, res, next) {
  try {
    return res.json(await posvendasService.pipeline(req.tenantId, req.query, req.user));
  } catch (err) { return next(err); }
}

async function lista(req, res, next) {
  try {
    return res.json(await posvendasService.listar(req.tenantId, req.query, req.user));
  } catch (err) { return next(err); }
}

async function crossSell(req, res, next) {
  try {
    return res.json(await posvendasService.crossSell(req.tenantId, req.params.id, req.user));
  } catch (err) { return next(err); }
}

async function mensagem(req, res, next) {
  try {
    const data = await posvendasService.mensagemRenderizada(
      req.tenantId, req.params.id, String(req.query.etapa || ''), req.user
    );
    return res.json(data);
  } catch (err) { return next(err); }
}

async function marcarFeito(req, res, next) {
  try {
    const data = await posvendasService.marcarFeito(
      req.tenantId, req.params.id, req.user, req.body && req.body.observacao
    );
    return res.json(data);
  } catch (err) { return next(err); }
}

// --- Configuração ------------------------------------------------------------
function categorias(_req, res) {
  return res.json(
    defaults.CATEGORIAS_POSVENDA.map((c) => ({ valor: c, label: defaults.CATEGORIA_LABEL[c] }))
  );
}

async function fluxo(req, res, next) {
  try {
    return res.json(await configService.listarFluxo(req.tenantId, req.params.categoria));
  } catch (err) { return next(err); }
}

async function criarEtapa(req, res, next) {
  try {
    const data = await configService.criarEtapa(req.tenantId, req.params.categoria, req.body);
    return res.status(201).json(data);
  } catch (err) { return next(err); }
}

async function atualizarEtapa(req, res, next) {
  try {
    return res.json(await configService.atualizarEtapa(req.tenantId, req.params.id, req.body));
  } catch (err) { return next(err); }
}

async function restaurarFluxo(req, res, next) {
  try {
    return res.json(await configService.restaurarPadraoCategoria(req.tenantId, req.params.categoria));
  } catch (err) { return next(err); }
}

async function mensagens(req, res, next) {
  try {
    return res.json(await configService.listarMensagens(req.tenantId, req.params.categoria));
  } catch (err) { return next(err); }
}

async function salvarMensagem(req, res, next) {
  try {
    const data = await configService.salvarMensagem(
      req.tenantId, req.params.categoria, req.params.etapa, req.body && req.body.texto
    );
    return res.json(data);
  } catch (err) { return next(err); }
}

async function redefinirMensagem(req, res, next) {
  try {
    const data = await configService.redefinirMensagem(req.tenantId, req.params.categoria, req.params.etapa);
    return res.json(data);
  } catch (err) { return next(err); }
}

module.exports = {
  pipeline, lista, crossSell, mensagem, marcarFeito,
  categorias, fluxo, criarEtapa, atualizarEtapa, restaurarFluxo,
  mensagens, salvarMensagem, redefinirMensagem,
};
