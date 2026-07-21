-- =============================================================================
-- Fideliza Corretor — Fase 2: Pós-Vendas (Timeline Inteligente)
-- Migration: 011_posvendas.sql   (par de rollback: 011_posvendas.down.sql)
-- Alvo: PostgreSQL / Supabase (colar direto no SQL Editor)
--
-- CONTEXTO
--   Esteira automática de relacionamento pós-venda. Diferente do funil (arraste
--   manual), aqui o cliente anda sozinho pelas etapas conforme o tempo passa
--   (gatilhos configuráveis: dias a partir de venda / renovação / vencimento /
--   aniversário). Depende da carteira (apolices, migration 010).
--
--   Três tabelas:
--     - posvendas_etapas    : as etapas do fluxo (por categoria ou por produto)
--     - posvendas_status    : em que etapa cada apólice está agora
--     - posvendas_mensagens : templates de mensagem por categoria × etapa
--
--   Isolamento por tenant_id mantido (app-layer). As etapas/mensagens de fábrica
--   NÃO são semeadas aqui — o backend as materializa por conta sob demanda
--   (posvendasConfigService.garantirDefaults), o que também cobre contas antigas.
--
-- Idempotente.
-- =============================================================================

-- =============================================================================
-- posvendas_etapas — etapas configuráveis do fluxo de pós-venda.
--   categoria: 'seguro' | 'saude' | 'consorcio' | 'venda_imovel' | 'locacao'
--              | 'administracao_imoveis' | 'geral'
--   produto_id: quando preenchido, sobrescreve o fluxo da categoria para aquele
--               produto específico (regra do brief: produto > categoria).
--   gatilho_tipo: 'venda' | 'renovacao' | 'vencimento' | 'aniversario'
--   gatilho_dias: offset em dias (negativo = antes; ex.: -60 = D-60 do vencimento)
-- =============================================================================
CREATE TABLE IF NOT EXISTS posvendas_etapas (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    categoria     TEXT NOT NULL
                      CHECK (categoria IN ('seguro','saude','consorcio','venda_imovel',
                                           'locacao','administracao_imoveis','geral')),
    produto_id    UUID REFERENCES produtos(id) ON DELETE CASCADE,   -- nulo = vale p/ a categoria
    chave         TEXT NOT NULL,                                    -- identifica a etapa de fábrica (boas_vindas, etc.)
    nome          TEXT NOT NULL,
    ordem         INTEGER NOT NULL DEFAULT 0,
    gatilho_tipo  TEXT NOT NULL
                      CHECK (gatilho_tipo IN ('venda','renovacao','vencimento','aniversario')),
    gatilho_dias  INTEGER NOT NULL DEFAULT 0,
    ativo         BOOLEAN NOT NULL DEFAULT true,

    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_posvendas_etapas_atualizado_em ON posvendas_etapas;
CREATE TRIGGER trg_posvendas_etapas_atualizado_em
    BEFORE UPDATE ON posvendas_etapas
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

CREATE INDEX IF NOT EXISTS idx_posvendas_etapas_tenant     ON posvendas_etapas (tenant_id);
CREATE INDEX IF NOT EXISTS idx_posvendas_etapas_categoria  ON posvendas_etapas (tenant_id, categoria);
CREATE INDEX IF NOT EXISTS idx_posvendas_etapas_produto    ON posvendas_etapas (tenant_id, produto_id);
-- Uma etapa (chave) por escopo (categoria + produto) — mantém o "restaurar padrão" idempotente.
CREATE UNIQUE INDEX IF NOT EXISTS uq_posvendas_etapas_escopo
    ON posvendas_etapas (tenant_id, categoria, COALESCE(produto_id, '00000000-0000-0000-0000-000000000000'::uuid), chave);

-- =============================================================================
-- posvendas_status — etapa atual de cada apólice na esteira.
--   Uma linha por (apólice, etapa) visitada; a mais recente = etapa atual.
--   concluido_em: preenchido quando o corretor marca "feito" (congela até o
--   próximo gatilho).
-- =============================================================================
CREATE TABLE IF NOT EXISTS posvendas_status (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    apolice_id    UUID NOT NULL REFERENCES apolices(id) ON DELETE CASCADE,
    etapa_id      UUID NOT NULL REFERENCES posvendas_etapas(id) ON DELETE CASCADE,
    entrou_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    concluido_em  TIMESTAMPTZ,
    concluido_por UUID REFERENCES users(id) ON DELETE SET NULL,
    observacao    TEXT,

    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posvendas_status_tenant   ON posvendas_status (tenant_id);
CREATE INDEX IF NOT EXISTS idx_posvendas_status_apolice  ON posvendas_status (tenant_id, apolice_id);
-- A etapa atual de uma apólice = a linha mais recente; este índice acelera o "última por apólice".
CREATE INDEX IF NOT EXISTS idx_posvendas_status_recente  ON posvendas_status (apolice_id, entrou_em DESC);

-- =============================================================================
-- posvendas_mensagens — template de mensagem por categoria × etapa.
--   is_padrao: true enquanto for o texto de fábrica (vira false ao editar).
-- =============================================================================
CREATE TABLE IF NOT EXISTS posvendas_mensagens (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    categoria     TEXT NOT NULL
                      CHECK (categoria IN ('seguro','saude','consorcio','venda_imovel',
                                           'locacao','administracao_imoveis','geral')),
    etapa_chave   TEXT NOT NULL,                 -- casa com posvendas_etapas.chave
    texto         TEXT NOT NULL,
    is_padrao     BOOLEAN NOT NULL DEFAULT true,

    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_posvendas_mensagens_atualizado_em ON posvendas_mensagens;
CREATE TRIGGER trg_posvendas_mensagens_atualizado_em
    BEFORE UPDATE ON posvendas_mensagens
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

CREATE INDEX IF NOT EXISTS idx_posvendas_mensagens_tenant ON posvendas_mensagens (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_posvendas_mensagens_escopo
    ON posvendas_mensagens (tenant_id, categoria, etapa_chave);

GRANT SELECT, INSERT, UPDATE, DELETE ON posvendas_etapas    TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON posvendas_status    TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON posvendas_mensagens TO service_role;

-- =============================================================================
-- FIM DA MIGRATION 011
-- =============================================================================
