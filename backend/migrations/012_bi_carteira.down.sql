-- =============================================================================
-- Rollback da migration 012 (BI de Carteira). Reverte 012_bi_carteira.sql.
-- Remove só o que a 012 adicionou; preserva a carteira_agregados da Fase 1.
-- =============================================================================

DROP INDEX IF EXISTS uq_carteira_agregados_snapshot;
DROP INDEX IF EXISTS idx_carteira_agregados_periodo;

ALTER TABLE carteira_agregados DROP COLUMN IF EXISTS dados_json;
ALTER TABLE carteira_agregados DROP COLUMN IF EXISTS periodo;

-- =============================================================================
-- FIM DO ROLLBACK 012
-- =============================================================================
