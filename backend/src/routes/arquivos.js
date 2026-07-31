const express = require('express');
const multer = require('multer');
const arquivosController = require('../controllers/arquivosController');
const { requirePermissao } = require('../middlewares/permissoes');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — mesmo teto do arquivosService
  fileFilter(req, file, cb) {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Só é aceito arquivo PDF.'));
    }
    return cb(null, true);
  },
});

// multer chama seu callback de erro com um Error simples (fileFilter) ou
// MulterError (limite de tamanho) — nenhum dos dois tem statusCode, então o
// handler central trataria como 500. Normaliza pra 400 aqui.
function uploadPdf(req, res, next) {
  upload.single('arquivo')(req, res, (err) => {
    if (err) {
      err.statusCode = 400;
      return next(err);
    }
    return next();
  });
}

const router = express.Router();

router.get('/', requirePermissao('carteira', 'ler'), arquivosController.listar);
router.post('/', requirePermissao('carteira', 'escrever'), uploadPdf, arquivosController.upload);

module.exports = router;
