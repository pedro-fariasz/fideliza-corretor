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
const notificacoesGeradorService = require('../services/notificacoesGeradorService');

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

// Agenda a retomada de contato dos clientes cancelados cuja data de retomada
// venceu (carteira_clientes.tentar_recuperar_em <= hoje). Idempotente: o campo
// é zerado após o compromisso ser criado, então não reprocessa o mesmo cliente.
router.post('/retomada-contato', requireJobSecret, async (req, res) => {
  try {
    const tenantIds = await tenantsRepository.listCorretorIds();
    let total = 0;
    const erros = [];
    for (const tenantId of tenantIds) {
      try {
        const r = await carteiraService.retomarContatos(tenantId);
        total += r.processados;
      } catch (e) {
        erros.push({ tenant_id: tenantId, error: e.message });
      }
    }
    return res.json({ processados: total, tenants: tenantIds.length, erros });
  } catch (err) {
    console.error('[job.retomada-contato] falhou', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// Gera avisos de aniversário do dia (roda diariamente às 6h). Idempotente: a
// UNIQUE (tenant, tipo, cliente, dia) em notificacoes_corretor barra duplicata.
router.post('/gerar-notificacoes-aniversario', requireJobSecret, async (req, res) => {
  try {
    const tenantIds = await tenantsRepository.listCorretorIds();
    let total = 0;
    const erros = [];
    for (const tenantId of tenantIds) {
      try {
        const r = await notificacoesGeradorService.gerarAniversario(tenantId);
        total += r.criadas;
      } catch (e) {
        erros.push({ tenant_id: tenantId, error: e.message });
      }
    }
    return res.json({ criadas: total, tenants: tenantIds.length, erros });
  } catch (err) {
    console.error('[job.gerar-notificacoes-aniversario] falhou', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// Gera avisos de boleto a vencer em 3 dias (roda diariamente às 6h). Idempotente.
router.post('/gerar-notificacoes-boleto', requireJobSecret, async (req, res) => {
  try {
    const tenantIds = await tenantsRepository.listCorretorIds();
    let total = 0;
    const erros = [];
    for (const tenantId of tenantIds) {
      try {
        const r = await notificacoesGeradorService.gerarBoleto(tenantId);
        total += r.criadas;
      } catch (e) {
        erros.push({ tenant_id: tenantId, error: e.message });
      }
    }
    return res.json({ criadas: total, tenants: tenantIds.length, erros });
  } catch (err) {
    console.error('[job.gerar-notificacoes-boleto] falhou', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// Gera avisos de follow-up de 7 dias pós-venda (roda diariamente às 6h). Idempotente.
router.post('/gerar-notificacoes-follow-up', requireJobSecret, async (req, res) => {
  try {
    const tenantIds = await tenantsRepository.listCorretorIds();
    let total = 0;
    const erros = [];
    for (const tenantId of tenantIds) {
      try {
        const r = await notificacoesGeradorService.gerarFollowUp(tenantId);
        total += r.criadas;
      } catch (e) {
        erros.push({ tenant_id: tenantId, error: e.message });
      }
    }
    return res.json({ criadas: total, tenants: tenantIds.length, erros });
  } catch (err) {
    console.error('[job.gerar-notificacoes-follow-up] falhou', { error: err.message });
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
