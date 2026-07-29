-- =============================================================================
-- Rollback da migration 014 (Regras de negócio pós-venda). Reverte
-- 014_regras_pos_venda.sql. Roda limpo mesmo se a up nunca tiver rodado.
-- =============================================================================

ALTER TABLE compromissos DROP COLUMN IF EXISTS origem;

DROP INDEX IF EXISTS idx_carteira_clientes_tenant_status;
ALTER TABLE carteira_clientes DROP COLUMN IF EXISTS status;
ALTER TABLE carteira_clientes DROP COLUMN IF EXISTS cpf_cnpj;

-- =============================================================================
-- FIM DO ROLLBACK 014
-- =============================================================================
