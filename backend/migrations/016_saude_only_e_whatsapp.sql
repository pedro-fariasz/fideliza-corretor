-- =============================================================================
-- Fideliza Corretor — Saúde-only + flag de WhatsApp conectado
-- Migration: 016_saude_only_e_whatsapp.sql   (par de rollback: 016_saude_only_e_whatsapp.down.sql)
-- Alvo: PostgreSQL / Supabase (colar direto no SQL Editor)
--
-- CONTEXTO
--   Decisão de produto (sessão atual): o Fideliza deixa de ser multi-vertical e
--   passa a ser SAÚDE-ONLY. Além disso, a aba "Leads" no app só deve aparecer
--   quando a corretora tiver um número de WhatsApp conectado (Meta Cloud API),
--   porque os leads chegam por lá.
--
--   Migration puramente aditiva. Nenhuma coluna existente é removida ou alterada:
--   `produtos.categoria` continua existindo como legado (compat); a nova
--   `tipo_plano_saude` a substitui semanticamente no app.
--
--   Isolamento por tenant_id mantido (app-layer, sem RLS). Idempotente.
-- =============================================================================

-- A) tenants.whatsapp_conectado -----------------------------------------------
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS whatsapp_conectado BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN tenants.whatsapp_conectado IS
    'Flag que controla se a aba Leads aparece no sidebar. Vira true quando a corretora conecta um número via Meta Cloud API.';

-- B) produtos.tipo_plano_saude (vertical única = plano de saúde) ---------------
ALTER TABLE produtos
    ADD COLUMN IF NOT EXISTS tipo_plano_saude TEXT
        CHECK (tipo_plano_saude IN ('PF','PME','Adesao','PJ','Odontologico'));

COMMENT ON COLUMN produtos.tipo_plano_saude IS
    'Vertical única = plano de saúde. Substitui semanticamente a coluna `categoria` que fica como legado.';

-- C) índice de busca por tipo de plano ----------------------------------------
CREATE INDEX IF NOT EXISTS idx_produtos_tenant_tipo_saude
    ON produtos (tenant_id, tipo_plano_saude);

-- =============================================================================
-- FIM DA MIGRATION 016
-- =============================================================================
