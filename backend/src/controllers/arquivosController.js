const arquivosService = require('../services/arquivosService');

async function upload(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Envie o PDF no campo "arquivo".' });
    }
    const data = await arquivosService.upload(
      req.tenantId,
      {
        tipo: req.body.tipo,
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        originalName: req.file.originalname,
        leadId: req.body.lead_id || null,
      },
      req.user
    );
    return res.status(201).json(data);
  } catch (err) {
    return next(err);
  }
}

async function listar(req, res, next) {
  try {
    const filtros = {};
    if (req.query.lead_id) filtros.lead_id = String(req.query.lead_id);
    if (req.query.tipo) filtros.tipo = String(req.query.tipo);
    if (req.query.status) filtros.status_extracao = String(req.query.status);
    const data = await arquivosService.listar(req.tenantId, filtros);
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

module.exports = { upload, listar };
