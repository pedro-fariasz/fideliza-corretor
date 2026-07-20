// =============================================================================
// Constantes de aplicação.
// =============================================================================

// Tenant reservado à equipe interna da Fideliza (funcionarios/admins).
// Ver migration 003. NÃO é um corretor — o poder cross-tenant do painel
// interno vem do ROLE, não deste tenant.
const PLATFORM_TENANT_ID = '11111111-1111-1111-1111-111111111111';

module.exports = { PLATFORM_TENANT_ID };
