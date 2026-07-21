-- =============================================================================
-- Fideliza Corretor — Fase 1: Gestão de Carteira (apólices)
-- Migration: 010_carteira.sql   (par de rollback: 010_carteira.down.sql)
-- Alvo: PostgreSQL / Supabase (colar direto no SQL Editor)
--
-- CONTEXTO
--   Introduz o conceito de RELACIONAMENTO CONTÍNUO (apólice/contrato), que
--   sustenta renovação, pós-venda e BI. Uma venda gera uma apólice; a apólice
--   renova gerando nova vigência (apolice_mae_id preserva o histórico).
--
--   `carteira_clientes` é NOVA e separada da `clientes` legada (plano de saúde,
--   usada pelo painel interno) — decisão do Pedro (21/07/2026). Não tocamos na
--   tabela legada.
--
--   Isolamento por tenant_id mantido; escopo hierárquico por corretor_id.
--
-- Idempotente.
-- =============================================================================

-- --- Produtos: vigência (prazo do contrato), p/ calcular vencimento da apólice.
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS vigencia_meses INTEGER NOT NULL DEFAULT 12;

-- =============================================================================
-- carteira_clientes — a pessoa/empresa dona de apólices (pós-venda).
-- =============================================================================
CREATE TABLE IF NOT EXISTS carteira_clientes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id         UUID REFERENCES leads(id) ON DELETE SET NULL,   -- origem no funil (quando houver)

    nome            TEXT NOT NULL,
    telefone        TEXT,
    email           TEXT,
    empresa         TEXT,
    data_nascimento DATE,                                           -- gatilho de aniversário (Fase 2)

    nps             INTEGER CHECK (nps IS NULL OR nps BETWEEN 0 AND 10),   -- coletado na Satisfação (Fase 2)
    health_score    INTEGER CHECK (health_score IS NULL OR health_score BETWEEN 0 AND 100),

    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_carteira_clientes_atualizado_em ON carteira_clientes;
CREATE TRIGGER trg_carteira_clientes_atualizado_em
    BEFORE UPDATE ON carteira_clientes
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

CREATE INDEX IF NOT EXISTS idx_carteira_clientes_tenant   ON carteira_clientes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_carteira_clientes_lead     ON carteira_clientes (tenant_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_carteira_clientes_nome     ON carteira_clientes USING GIN (tenant_id, nome gin_trgm_ops);

-- =============================================================================
-- apolices — contrato recorrente. Venda gera; renovação cria nova vigência.
-- =============================================================================
CREATE TABLE IF NOT EXISTS apolices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cliente_id          UUID NOT NULL REFERENCES carteira_clientes(id) ON DELETE CASCADE,
    produto_id          UUID NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
    corretor_id         UUID REFERENCES users(id) ON DELETE SET NULL,     -- dono (escopo hierárquico)
    venda_id            UUID REFERENCES vendas(id) ON DELETE SET NULL,    -- venda de origem (nulo em avulso)

    valor               NUMERIC(12,2) NOT NULL CHECK (valor > 0),
    forma_pagamento     TEXT CHECK (forma_pagamento IN ('debito','boleto','pix','cartao','dinheiro','outro')),
    data_inicio         DATE NOT NULL,
    data_vencimento     DATE NOT NULL,
    status              TEXT NOT NULL DEFAULT 'ativa'
                             CHECK (status IN ('ativa','vencida','renovada','cancelada')),
    motivo_cancelamento TEXT,                                            -- alimenta o BI de churn (Fase 3)
    apolice_mae_id      UUID REFERENCES apolices(id) ON DELETE SET NULL, -- vigência anterior (histórico)
    health_score        INTEGER CHECK (health_score IS NULL OR health_score BETWEEN 0 AND 100),

    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_apolices_atualizado_em ON apolices;
CREATE TRIGGER trg_apolices_atualizado_em
    BEFORE UPDATE ON apolices
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

CREATE INDEX IF NOT EXISTS idx_apolices_tenant        ON apolices (tenant_id);
CREATE INDEX IF NOT EXISTS idx_apolices_tenant_status ON apolices (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_apolices_tenant_venc   ON apolices (tenant_id, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_apolices_tenant_corr   ON apolices (tenant_id, corretor_id);
CREATE INDEX IF NOT EXISTS idx_apolices_cliente       ON apolices (cliente_id);

-- =============================================================================
-- carteira_agregados — cache das métricas (usado forte na Fase 3 - BI).
-- Na Fase 1 as métricas podem ser calculadas ao vivo; a tabela já nasce pronta.
-- =============================================================================
CREATE TABLE IF NOT EXISTS carteira_agregados (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    corretor_id    UUID REFERENCES users(id) ON DELETE SET NULL,   -- nulo = conta inteira
    referencia_mes TEXT,                                           -- 'YYYY-MM'
    trc            NUMERIC, ltv NUMERIC, nps NUMERIC, ppc NUMERIC,
    tcc            NUMERIC, rpc NUMERIC, tmr NUMERIC, score_geral NUMERIC,
    calculado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carteira_agregados_tenant ON carteira_agregados (tenant_id, referencia_mes);

GRANT SELECT, INSERT, UPDATE, DELETE ON carteira_clientes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON apolices TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON carteira_agregados TO service_role;

-- =============================================================================
-- FIM DA MIGRATION 010
-- =============================================================================
