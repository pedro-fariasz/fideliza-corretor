-- =============================================================================
-- Rollback da migration 016 (Saúde-only + WhatsApp). Reverte
-- 016_saude_only_e_whatsapp.sql. Roda limpo mesmo se a up nunca tiver rodado.
-- =============================================================================

DROP INDEX IF EXISTS idx_produtos_tenant_tipo_saude;

ALTER TABLE produtos DROP COLUMN IF EXISTS tipo_plano_saude;

ALTER TABLE tenants  DROP COLUMN IF EXISTS whatsapp_conectado;

-- =============================================================================
-- FIM DO ROLLBACK 016
-- =============================================================================
