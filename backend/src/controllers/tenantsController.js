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

// POST /api/tenants/me/whatsapp — conecta o WhatsApp (placeholder até a
// integração oficial Meta Cloud API existir; ver CLAUDE.md). Só liga a flag,
// não guarda token bruto nem fala com nenhuma API externa ainda.
async function conectarWhatsapp(req, res, next) {
  try {
    const token = (req.body && req.body.token) || '';
    if (!token.trim()) {
      return res.status(400).json({ error: 'Informe o token de acesso.' });
    }
    const tenant = await tenantsRepository.setWhatsappConectado(req.tenantId, true);
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

module.exports = { me, conectarWhatsapp };
