-- =============================================================================
-- Fideliza Corretor — Relacionamento & Pós-Venda (atribuição, plataformas, tags)
-- Migration: 013_relacionamento_pos_venda.sql   (par de rollback: 013_relacionamento_pos_venda.down.sql)
-- Alvo: PostgreSQL / Supabase (colar direto no SQL Editor)
--
-- CONTEXTO
--   Migration puramente aditiva. Prepara o terreno para:
--     - Ciclo de vida do cliente na carteira (novo -> base) e cancelamento com
--       motivo, incluindo a data de retomada de contato da esteira de recuperação.
--     - Atribuição de origem do lead (Meta Conversions API, Google Ads, indicação,
--       landing page) sem quebrar o campo de texto livre já existente.
--     - Plataforma de descarga (Steel, Dinasty, Bida...) — onde a corretora
--       registra a venda para receber comissão, diferente da operadora.
--     - Log de atividades de negócio (feed "Inteligência", ainda não construído).
--     - Tags coloridas aplicáveis a leads e clientes.
--
--   Nenhuma coluna existente é removida ou alterada. Nenhum dado é migrado.
--   Isolamento por tenant_id mantido (app-layer, sem RLS).
--
-- Idempotente.
-- =============================================================================

-- =============================================================================
-- plataformas_descarga — onde a corretora registra a venda p/ receber comissão
-- (Steel, Dinasty, Bida, ...). Não confundir com operadora (Amil, SulAmérica),
-- que fica em carteira_clientes.operadora.
-- =============================================================================
CREATE TABLE IF NOT EXISTS plataformas_descarga (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    nome                TEXT NOT NULL,
    prazo_estorno_dias  INTEGER NOT NULL DEFAULT 180
                             CHECK (prazo_estorno_dias BETWEEN 0 AND 720),
    regras_estorno      TEXT,                                     -- markdown livre, notas da corretora
    ativo               BOOLEAN NOT NULL DEFAULT TRUE,

    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_plataformas_descarga_atualizado_em ON plataformas_descarga;
CREATE TRIGGER trg_plataformas_descarga_atualizado_em
    BEFORE UPDATE ON plataformas_descarga
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

CREATE INDEX IF NOT EXISTS idx_plataformas_descarga_tenant_id ON plataformas_descarga (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_plataformas_descarga_nome
    ON plataformas_descarga (tenant_id, LOWER(nome));

-- =============================================================================
-- carteira_clientes — ciclo de vida (novo -> base), cancelamento e esteira de
-- recuperação. tipo_cliente nasce sempre 'novo'; um cron futuro promove p/ 'base'.
-- =============================================================================
ALTER TABLE carteira_clientes
    ADD COLUMN IF NOT EXISTS tipo_cliente TEXT NOT NULL DEFAULT 'novo'
        CHECK (tipo_cliente IN ('novo','base'));

ALTER TABLE carteira_clientes
    ADD COLUMN IF NOT EXISTS data_promovido_base TIMESTAMPTZ;

ALTER TABLE carteira_clientes
    ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT
        CHECK (motivo_cancelamento IN ('financeiro','insatisfacao','trocou_operadora',
                                        'trocou_corretor','mal_pagador','falecimento','outro'));

ALTER TABLE carteira_clientes
    ADD COLUMN IF NOT EXISTS tentar_recuperar_em DATE;   -- nulo p/ falecimento, trocou_corretor, mal_pagador

ALTER TABLE carteira_clientes
    ADD COLUMN IF NOT EXISTS plataforma_descarga_id UUID
        REFERENCES plataformas_descarga(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_carteira_clientes_tenant_tipo ON carteira_clientes (tenant_id, tipo_cliente);
CREATE INDEX IF NOT EXISTS idx_carteira_clientes_recuperacao
    ON carteira_clientes (tenant_id, tentar_recuperar_em) WHERE tentar_recuperar_em IS NOT NULL;

-- =============================================================================
-- leads — canal canonizado de origem, p/ Meta Conversions API e atribuição.
-- origem_especifica (texto livre) continua existindo; origem_canal é o valor
-- fechado usado nos relatórios e na integração com as plataformas de anúncio.
-- =============================================================================
ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS origem_canal TEXT
        CHECK (origem_canal IN ('meta_instant_form','meta_click_to_whatsapp','landing_page',
                                 'google_ads','indicacao','whatsapp_direto','organico','outro'));

ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS campanha_id TEXT;

ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS anuncio_id TEXT;

ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS indicado_por_cliente_id UUID
        REFERENCES carteira_clientes(id) ON DELETE SET NULL;

ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS fbclid TEXT;

ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS gclid TEXT;

ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS ctwa_clid TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_tenant_origem_canal ON leads (tenant_id, origem_canal);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_indicador
    ON leads (tenant_id, indicado_por_cliente_id) WHERE indicado_por_cliente_id IS NOT NULL;

-- =============================================================================
-- atividades — log leve de negócio (não é log de sistema). Alimenta a futura
-- aba "Inteligência" no frontend. usuario_id nulo = autor foi o cron.
-- =============================================================================
CREATE TABLE IF NOT EXISTS atividades (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    usuario_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    entidade      TEXT NOT NULL
                      CHECK (entidade IN ('lead','cliente','venda','apolice','plataforma','tag','sistema')),
    entidade_id   UUID,                                    -- nulo p/ 'sistema'
    acao          TEXT NOT NULL,                            -- livre: 'lead_criado', 'venda_fechada', ...
    detalhes      JSONB,                                    -- payload livre (antes/depois, motivo, etc)

    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atividades_tenant_id       ON atividades (tenant_id);
CREATE INDEX IF NOT EXISTS idx_atividades_tenant_entidade  ON atividades (tenant_id, entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_atividades_tenant_data      ON atividades (tenant_id, criado_em DESC);

-- =============================================================================
-- tags — tags coloridas estilo WhatsApp Business, aplicáveis a leads e clientes.
-- lead_tags / cliente_tags: tenant_id denormalizado de propósito (mesmo padrão
-- de comissoes) — o repositório filtra por tenant_id direto nas tabelas de junção.
-- =============================================================================
CREATE TABLE IF NOT EXISTS tags (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nome          TEXT NOT NULL,
    cor           TEXT NOT NULL DEFAULT '#1E5EFF',           -- hex; validado no service, não no CHECK
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tags_tenant_id ON tags (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tags_nome ON tags (tenant_id, LOWER(nome));

CREATE TABLE IF NOT EXISTS lead_tags (
    lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    tag_id        UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    aplicado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (lead_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_tags_tenant_id ON lead_tags (tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_tags_tag       ON lead_tags (tenant_id, tag_id);

CREATE TABLE IF NOT EXISTS cliente_tags (
    cliente_id    UUID NOT NULL REFERENCES carteira_clientes(id) ON DELETE CASCADE,
    tag_id        UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    aplicado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (cliente_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_cliente_tags_tenant_id ON cliente_tags (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cliente_tags_tag       ON cliente_tags (tenant_id, tag_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON plataformas_descarga TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON atividades           TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON tags                 TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON lead_tags             TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON cliente_tags           TO service_role;

-- =============================================================================
-- FIM DA MIGRATION 013
-- =============================================================================
