const tenantsRepository = require('../repositories/tenantsRepository');

// GET /api/tenants/me — dados do tenant atual (id vem do JWT, nunca do body).
// Usado pelo sidebar (aba Leads condicional a whatsapp_conectado) e afins.
async function me(req, res, next) {
  try {
    const tenant = await tenantsRepository.findById(req.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado.' });
    return res.json({
      id: tenant.id,
      nome: tenant.nome,
      whatsapp_conectado: Boolean(tenant.whatsapp_conectado),
      vertical: tenant.vertical || null,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { me };
