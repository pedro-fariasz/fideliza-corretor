-- =============================================================================
-- Rollback da migration 009 (equipe, papéis da conta e hierarquia).
-- Alvo: PostgreSQL / Supabase. Reverte 009_equipe_permissoes.sql.
--
-- ⚠️ Destrói os dados das colunas removidas (papel_conta, cargo, lider_id,
--    ativo, ultimo_acesso). Use só para desfazer a Fase 0.
-- =============================================================================

DROP INDEX IF EXISTS idx_users_tenant_lider;

ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_papel_conta;
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_cargo;

ALTER TABLE users DROP COLUMN IF EXISTS papel_conta;
ALTER TABLE users DROP COLUMN IF EXISTS cargo;
ALTER TABLE users DROP COLUMN IF EXISTS lider_id;
ALTER TABLE users DROP COLUMN IF EXISTS ativo;
ALTER TABLE users DROP COLUMN IF EXISTS ultimo_acesso;

-- =============================================================================
-- FIM DO ROLLBACK 009
-- =============================================================================
