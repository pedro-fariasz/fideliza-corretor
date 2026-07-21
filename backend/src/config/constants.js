// =============================================================================
// Constantes de aplicação.
// =============================================================================

// Tenant reservado à equipe interna da Fideliza (funcionarios/admins).
// Ver migration 003. NÃO é um corretor — o poder cross-tenant do painel
// interno vem do ROLE, não deste tenant.
const PLATFORM_TENANT_ID = '11111111-1111-1111-1111-111111111111';

// -----------------------------------------------------------------------------
// Feature flags por fase (Fase 0+). Permitem deployar sem expor módulo
// incompleto. Ligadas por env: FEATURE_EQUIPE=on (default OFF).
// Expostas ao frontend em GET /api/auth/me -> flags.
// -----------------------------------------------------------------------------
function flagAtiva(nome) {
  const v = String(process.env[nome] || '').trim().toLowerCase();
  return v === 'on' || v === 'true' || v === '1';
}

const FEATURE_FLAGS = {
  get equipe() {
    return flagAtiva('FEATURE_EQUIPE');
  },
  get carteira() {
    return flagAtiva('FEATURE_CARTEIRA');
  },
  get posvendas() {
    return flagAtiva('FEATURE_POSVENDAS');
  },
  get bi_carteira() {
    return flagAtiva('FEATURE_BI_CARTEIRA');
  },
  get desempenho() {
    return flagAtiva('FEATURE_DESEMPENHO');
  },
};

module.exports = { PLATFORM_TENANT_ID, FEATURE_FLAGS };
