// =============================================================================
// requireFeature — gate por feature flag de fase. Quando a flag está desligada,
// a rota responde 404 (o módulo simplesmente "não existe" ainda). Permite
// deployar código de uma fase sem expô-la.
// =============================================================================
const { FEATURE_FLAGS } = require('../config/constants');

function requireFeature(flag) {
  return (req, res, next) => {
    if (!FEATURE_FLAGS[flag]) {
      return res.status(404).json({ error: 'Rota não encontrada.' });
    }
    return next();
  };
}

module.exports = { requireFeature };
