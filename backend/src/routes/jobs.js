// =============================================================================
// Rotas de JOB (cron). NÃO usam authMiddleware — são chamadas por um agendador
// (Railway Cron) e protegidas por um segredo compartilhado no header:
//   x-job-secret: $JOB_SECRET
// Montadas ANTES do authMiddleware global (ver app.js).
// =============================================================================
const express = require('express');
const tenantsRepository = require('../repositories/tenantsRepository');
const carteiraService = require('../services/carteiraService');
const posvendasService = require('../services/posvendasService');
const biCarteiraService = require('../services/biCarteiraService');

const router = express.Router();

function requireJobSecret(req, res, next) {
  const esperado = process.env.JOB_SECRET;
  const recebido = req.headers['x-job-secret'];
  if (!esperado) return res.status(503).json({ error: 'JOB_SECRET não configurado no servidor.' });
  if (!recebido || recebido !== esperado) return res.status(401).json({ error: 'Segredo de job inválido.' });
  return next();
}

// Recalcula o health score de todas as contas (idempotente).
router.post('/recalcular-carteira', requireJobSecret, async (req, res) => {
  try {
    const tenantIds = await tenantsRepository.listCorretorIds();
    let total = 0;
    const erros = [];
    for (const tenantId of tenantIds) {
      try {
        const r = await carteiraService.recalcularHealth(tenantId);
        total += r.apolices_atualizadas;
      } catch (e) {
        erros.push({ tenant_id: tenantId, error: e.message });
      }
    }
    return res.json({ tenants: tenantIds.length, apolices_atualizadas: total, erros });
  } catch (err) {
    console.error('[job.recalcular-carteira] falhou', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// Recalcula a etapa de pós-venda de todas as apólices (move a esteira). Idempotente.
router.post('/recalcular-posvendas', requireJobSecret, async (req, res) => {
  try {
    const tenantIds = await tenantsRepository.listCorretorIds();
    let total = 0;
    const erros = [];
    for (const tenantId of tenantIds) {
      try {
        const r = await posvendasService.recalcularEtapas(tenantId);
        total += r.apolices_movidas;
      } catch (e) {
        erros.push({ tenant_id: tenantId, error: e.message });
      }
    }
    return res.json({ tenants: tenantIds.length, apolices_movidas: total, erros });
  } catch (err) {
    console.error('[job.recalcular-posvendas] falhou', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// Recalcula os agregados de BI de todas as contas (snapshots por corretor/conta/período).
router.post('/recalcular-bi', requireJobSecret, async (req, res) => {
  try {
    const tenantIds = await tenantsRepository.listCorretorIds();
    let total = 0;
    const erros = [];
    for (const tenantId of tenantIds) {
      try {
        const r = await biCarteiraService.recalcular(tenantId);
        total += r.snapshots;
        biCarteiraService.invalidarCache(tenantId);
      } catch (e) {
        erros.push({ tenant_id: tenantId, error: e.message });
      }
    }
    return res.json({ tenants: tenantIds.length, snapshots: total, erros });
  } catch (err) {
    console.error('[job.recalcular-bi] falhou', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
