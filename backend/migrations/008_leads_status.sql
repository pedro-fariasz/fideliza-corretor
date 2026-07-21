-- =============================================================================
-- Fideliza Corretor — Status do lead (ativo/perdido) para o filtro do funil
-- Migration: 008_leads_status.sql
-- Alvo: PostgreSQL / Supabase (colar direto no SQL Editor)
--
-- CONTEXTO
--   O funil filtra "Ativos / Todos" (PRD §6.4): um lead pode ser marcado como
--   PERDIDO sem sair das 6 colunas de estágio. `estagio` continua sendo a
--   coluna do Kanban; `status` diz se o lead está ativo ou foi perdido.
--
-- Idempotente.
-- =============================================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo','perdido'));
ALTER TABLE leads ADD COLUMN IF NOT EXISTS motivo_perda TEXT;

-- Fila do Kanban por status (a maioria das consultas é "ativos").
CREATE INDEX IF NOT EXISTS idx_leads_tenant_status ON leads (tenant_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON leads TO service_role;

-- =============================================================================
-- FIM DA MIGRATION 008
-- =============================================================================
