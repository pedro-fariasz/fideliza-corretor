-- =============================================================================
-- Fideliza Corretor — Schema inicial (SaaS multi-tenant para corretores de saúde)
-- Migration: 001_initial_schema.sql
-- Alvo: PostgreSQL / Supabase (colar direto no SQL Editor)
--
-- IMPORTANTE:
--   * NÃO usamos RLS (Row Level Security). O isolamento entre tenants é feito
--     na camada de aplicação, sempre filtrando por tenant_id nas queries.
--   * Todos os UUIDs de chave primária usam gen_random_uuid().
--   * Comentários em português descrevem cada seção.
-- =============================================================================


-- =============================================================================
-- 1. EXTENSÕES
-- Habilita as extensões necessárias para geração de UUID e busca por texto.
-- =============================================================================

-- uuid-ossp: solicitada explicitamente pelas restrições do projeto.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pgcrypto: fornece gen_random_uuid() usado nos DEFAULTs das tabelas.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- pg_trgm: habilita índice GIN por trigrama para busca fuzzy de nomes
-- (usado no fluxo de RAG / recuperação de clientes por nome).
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- btree_gin: permite combinar tenant_id (uuid) com trigrama em um único
-- índice GIN composto (idx_clientes_tenant_nome).
CREATE EXTENSION IF NOT EXISTS "btree_gin";


-- =============================================================================
-- 2. FUNÇÃO DE TRIGGER — atualizado_em
-- Atualiza automaticamente a coluna atualizado_em em cada UPDATE.
-- =============================================================================

CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- 3. TABELA: tenants
-- Cada corretor (ou corretora) é um tenant. É a raiz do isolamento multi-tenant.
-- =============================================================================

CREATE TABLE IF NOT EXISTS tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        TEXT        NOT NULL,                       -- Nome do corretor / corretora
    email       TEXT        UNIQUE,                         -- E-mail de login / contato
    telefone    TEXT,                                       -- Telefone / WhatsApp do corretor
    plano       TEXT        NOT NULL DEFAULT 'demo',        -- Plano de assinatura (demo, basico, pro...)
    ativo       BOOLEAN     NOT NULL DEFAULT TRUE,          -- Tenant habilitado?
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =============================================================================
-- 4. TABELA: clientes
-- Clientes (segurados) de cada corretor. Núcleo do CRM.
-- CPF é NULLABLE — nem sempre o corretor tem o CPF na hora do cadastro.
-- =============================================================================

CREATE TABLE IF NOT EXISTS clientes (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nome               TEXT        NOT NULL,                 -- Nome completo do cliente
    cpf                TEXT,                                 -- CPF (nullable de propósito)
    telefone           TEXT,                                 -- Telefone / WhatsApp
    email              TEXT,                                 -- E-mail do cliente
    operadora          TEXT,                                 -- Operadora do plano (Amil, Bradesco...)
    plano              TEXT,                                 -- Nome / tipo do plano contratado
    valor_mensalidade  NUMERIC(10,2),                        -- Valor mensal do plano
    vencimento_boleto  INTEGER CHECK (vencimento_boleto BETWEEN 1 AND 31), -- Dia do vencimento (1-31)
    status             TEXT        NOT NULL DEFAULT 'ativo', -- ativo, inadimplente, cancelado
    observacoes        TEXT,                                 -- Anotações livres do corretor
    criado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: mantém atualizado_em sincronizado a cada UPDATE em clientes.
DROP TRIGGER IF EXISTS trg_clientes_atualizado_em ON clientes;
CREATE TRIGGER trg_clientes_atualizado_em
    BEFORE UPDATE ON clientes
    FOR EACH ROW
    EXECUTE FUNCTION set_atualizado_em();


-- =============================================================================
-- 5. TABELA: alertas
-- Lembretes / alertas gerados para o corretor (vencimento, aniversário,
-- renovação, inadimplência etc.).
-- =============================================================================

CREATE TABLE IF NOT EXISTS alertas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID        NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
    cliente_id  UUID        REFERENCES clientes(id) ON DELETE CASCADE,
    tipo        TEXT        NOT NULL,                        -- vencimento, aniversario, renovacao, inadimplencia...
    mensagem    TEXT,                                        -- Texto do alerta
    data_alerta DATE        NOT NULL,                        -- Data em que o alerta deve disparar
    status      TEXT        NOT NULL DEFAULT 'pendente',     -- pendente, enviado, cancelado
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =============================================================================
-- 6. TABELA: historico
-- Histórico de interações com o cliente (mensagens, ligações, notas).
-- =============================================================================

CREATE TABLE IF NOT EXISTS historico (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID        NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
    cliente_id  UUID        REFERENCES clientes(id) ON DELETE CASCADE,
    tipo        TEXT        NOT NULL,                        -- mensagem, ligacao, email, nota...
    conteudo    TEXT,                                        -- Conteúdo da interação
    canal       TEXT,                                        -- whatsapp, telefone, email, sistema
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =============================================================================
-- 7. TABELA: sessoes
-- Sessões de conversa do bot / atendimento por telefone (estado + contexto).
-- Indexada por telefone para retomada rápida da conversa.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sessoes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID        REFERENCES tenants(id) ON DELETE CASCADE,
    telefone      TEXT        NOT NULL,                      -- Telefone da sessão (chave de retomada)
    estado        TEXT,                                      -- Estado atual do fluxo de conversa
    contexto      JSONB       NOT NULL DEFAULT '{}'::jsonb,  -- Contexto acumulado da sessão
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: mantém atualizado_em sincronizado a cada UPDATE em sessoes.
DROP TRIGGER IF EXISTS trg_sessoes_atualizado_em ON sessoes;
CREATE TRIGGER trg_sessoes_atualizado_em
    BEFORE UPDATE ON sessoes
    FOR EACH ROW
    EXECUTE FUNCTION set_atualizado_em();


-- =============================================================================
-- 8. TABELA: templates
-- Templates de mensagens reutilizáveis por tenant (boas-vindas, cobrança...).
-- =============================================================================

CREATE TABLE IF NOT EXISTS templates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nome        TEXT        NOT NULL,                        -- Nome identificador do template
    tipo        TEXT        NOT NULL,                        -- vencimento, aniversario, boas_vindas...
    conteudo    TEXT        NOT NULL,                        -- Corpo da mensagem (com placeholders)
    ativo       BOOLEAN     NOT NULL DEFAULT TRUE,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Nome do template é único por tenant (garante seeds idempotentes).
    CONSTRAINT uq_templates_tenant_nome UNIQUE (tenant_id, nome)
);


-- =============================================================================
-- 9. ÍNDICES
-- Índices obrigatórios para performance das queries multi-tenant.
-- =============================================================================

-- clientes ---------------------------------------------------------------
-- Filtro base por tenant.
CREATE INDEX IF NOT EXISTS idx_clientes_tenant_id
    ON clientes (tenant_id);

-- Filtro por tenant + status (listagens de ativos/inadimplentes).
CREATE INDEX IF NOT EXISTS idx_clientes_tenant_status
    ON clientes (tenant_id, status);

-- Busca fuzzy de nome por tenant (fluxo de RAG). GIN + trigrama.
CREATE INDEX IF NOT EXISTS idx_clientes_tenant_nome
    ON clientes USING GIN (tenant_id, nome gin_trgm_ops);

-- alertas ----------------------------------------------------------------
-- Filtro base por tenant.
CREATE INDEX IF NOT EXISTS idx_alertas_tenant_id
    ON alertas (tenant_id);

-- Índice PARCIAL: apenas alertas pendentes (fila de processamento).
CREATE INDEX IF NOT EXISTS idx_alertas_pendentes
    ON alertas (tenant_id, data_alerta)
    WHERE status = 'pendente';

-- historico --------------------------------------------------------------
-- Filtro base por tenant.
CREATE INDEX IF NOT EXISTS idx_historico_tenant_id
    ON historico (tenant_id);

-- sessoes ----------------------------------------------------------------
-- Retomada de sessão por telefone.
CREATE INDEX IF NOT EXISTS idx_sessoes_telefone
    ON sessoes (telefone);


-- =============================================================================
-- 10. SEEDS
-- Tenant de demonstração (UUID fixo) + templates padrão.
-- Idempotente: pode rodar novamente sem duplicar.
-- =============================================================================

-- Tenant demo com UUID fixo, usado em desenvolvimento / testes.
INSERT INTO tenants (id, nome, email, plano, ativo)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'Corretor Demo',
    'demo@fideliza.com.br',
    'demo',
    TRUE
)
ON CONFLICT (id) DO NOTHING;

-- Templates padrão do tenant demo.
INSERT INTO templates (tenant_id, nome, tipo, conteudo)
VALUES
    (
        '00000000-0000-0000-0000-000000000000',
        'Boas-vindas',
        'boas_vindas',
        'Olá {{nome}}! Seja bem-vindo(a). Sou seu corretor de saúde e estou à disposição para ajudar com seu plano {{plano}}.'
    ),
    (
        '00000000-0000-0000-0000-000000000000',
        'Lembrete de vencimento',
        'vencimento',
        'Oi {{nome}}, tudo bem? Passando para lembrar que o boleto do seu plano vence no dia {{vencimento_boleto}}. Qualquer dúvida, é só chamar!'
    ),
    (
        '00000000-0000-0000-0000-000000000000',
        'Aniversário',
        'aniversario',
        'Feliz aniversário, {{nome}}! 🎉 Desejamos muita saúde. Conte sempre com a gente.'
    ),
    (
        '00000000-0000-0000-0000-000000000000',
        'Cobrança / inadimplência',
        'inadimplencia',
        'Olá {{nome}}, identificamos que o pagamento do seu plano {{plano}} está em atraso. Vamos resolver juntos? Estou à disposição.'
    ),
    (
        '00000000-0000-0000-0000-000000000000',
        'Renovação',
        'renovacao',
        'Oi {{nome}}! Seu plano {{plano}} está próximo da renovação. Vamos conversar sobre as melhores opções para você?'
    )
ON CONFLICT (tenant_id, nome) DO NOTHING;

-- =============================================================================
-- FIM DO SCHEMA INICIAL
-- =============================================================================
