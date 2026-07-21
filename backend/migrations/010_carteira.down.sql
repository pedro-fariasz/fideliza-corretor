-- =============================================================================
-- Rollback da migration 010 (Gestão de Carteira). Reverte 010_carteira.sql.
-- ⚠️ Destrói apolices, carteira_clientes e carteira_agregados (e seus dados).
-- =============================================================================

DROP TABLE IF EXISTS carteira_agregados;
DROP TABLE IF EXISTS apolices;
DROP TABLE IF EXISTS carteira_clientes;

ALTER TABLE produtos DROP COLUMN IF EXISTS vigencia_meses;

-- =============================================================================
-- FIM DO ROLLBACK 010
-- =============================================================================
