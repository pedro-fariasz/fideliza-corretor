-- =============================================================================
-- Fideliza Corretor — Regras de negócio pós-venda (ponte lead→cliente, cancelamento)
-- Migration: 014_regras_pos_venda.sql   (par de rollback: 014_regras_pos_venda.down.sql)
-- Alvo: PostgreSQL / Supabase (colar direto no SQL Editor)
--
-- CONTEXTO
--   Suporte de schema para o PR que liga o funil comercial ao pós-venda:
--     - `carteira_clientes.lead_id` já existe desde a migration 010 (nada a
--       fazer aqui); mas faltavam `cpf_cnpj` (copiado do lead na promoção) e
--       `status` (ciclo de vida ativo/cancelado, usado pelo endpoint de
--       cancelamento — motivo_cancelamento/tentar_recuperar_em já existem
--       desde a 013).
--     - `compromissos.origem` distingue compromisso criado manualmente pelo
--       corretor de compromisso gerado por job (ex.: retomada de contato).
--
--   Puramente aditiva: só ADD COLUMN IF NOT EXISTS. Nenhuma coluna existente é
--   removida ou alterada. Nenhum dado é migrado. Idempotente.
-- =============================================================================

ALTER TABLE carteira_clientes
    ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT;

ALTER TABLE carteira_clientes
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ativo'
        CHECK (status IN ('ativo','cancelado'));

CREATE INDEX IF NOT EXISTS idx_carteira_clientes_tenant_status ON carteira_clientes (tenant_id, status);

-- 'sistema_retomada' etc. — texto livre (não CHECK) para não travar novos jobs futuros.
ALTER TABLE compromissos
    ADD COLUMN IF NOT EXISTS origem TEXT;

-- =============================================================================
-- FIM DA MIGRATION 014
-- =============================================================================
