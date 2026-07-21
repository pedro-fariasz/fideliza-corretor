const equipeService = require('../services/equipeService');

async function listar(req, res, next) {
  try {
    const usuarios = await equipeService.listar(req.tenantId);
    return res.json(usuarios);
  } catch (err) {
    return next(err);
  }
}

async function criarCorretor(req, res, next) {
  try {
    const usuario = await equipeService.criarCorretor(req.tenantId, req.body);
    return res.status(201).json(usuario);
  } catch (err) {
    return next(err);
  }
}

async function criarSecretaria(req, res, next) {
  try {
    const usuario = await equipeService.criarSecretaria(req.tenantId, req.body);
    return res.status(201).json(usuario);
  } catch (err) {
    return next(err);
  }
}

async function editar(req, res, next) {
  try {
    const usuario = await equipeService.editar(req.tenantId, req.params.id, req.body);
    return res.json(usuario);
  } catch (err) {
    return next(err);
  }
}

async function desativar(req, res, next) {
  try {
    const resultado = await equipeService.desativar(
      req.tenantId,
      req.params.id,
      { transferirParaId: req.body && req.body.transferir_para_id },
      req.user.id
    );
    return res.json(resultado);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listar,
  criarCorretor,
  criarSecretaria,
  editar,
  desativar,
};
