-- =============================================================================
-- Fideliza Corretor — Fase 3: BI de Carteira / Inteligência Estratégica
-- Migration: 012_bi_carteira.sql   (par de rollback: 012_bi_carteira.down.sql)
-- Alvo: PostgreSQL / Supabase (colar direto no SQL Editor)
--
-- CONTEXTO
--   O BI lê AGREGADOS pré-calculados (job noturno), nunca recalcula em cima das
--   apólices cruas na request. A tabela `carteira_agregados` já nasceu na
--   Fase 1 (migration 010) com as 7 métricas + score. Aqui ela ganha:
--     - `periodo`     : janela do agregado ('30d'|'90d'|'6m'|'1a'|'tudo')
--     - `dados_json`  : o payload rico do BI (cards, gráficos, churn, cross-sell)
--
--   O snapshot é gravado por CORRETOR (corretor_id) e por CONTA (corretor_id
--   nulo). A leitura resolve o escopo do usuário e SOMA os snapshots dos
--   corretores no escopo — poucas linhas, rápido, com cache de 15 min na app.
--
--   Isolamento por tenant_id mantido.
--
-- Idempotente.
-- =============================================================================

ALTER TABLE carteira_agregados ADD COLUMN IF NOT EXISTS periodo    TEXT;
ALTER TABLE carteira_agregados ADD COLUMN IF NOT EXISTS dados_json JSONB;

-- Um snapshot por (conta, corretor|conta, período). COALESCE trata corretor
-- nulo (agregado da conta) como uma chave estável.
CREATE UNIQUE INDEX IF NOT EXISTS uq_carteira_agregados_snapshot
    ON carteira_agregados (
        tenant_id,
        COALESCE(corretor_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(periodo, 'tudo')
    );

CREATE INDEX IF NOT EXISTS idx_carteira_agregados_periodo
    ON carteira_agregados (tenant_id, periodo);

-- =============================================================================
-- FIM DA MIGRATION 012
-- =============================================================================
