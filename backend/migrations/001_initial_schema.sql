-- =============================================================================
-- Fideliza Corretor — Schema inicial (SaaS multi-tenant para corretores de saúde)
-- Migration: 001_initial_schema.sql
-- Alvo: PostgreSQL / Supabase (colar direto no SQL Editor)
--
-- IMPORTANTE:
--   * NÃO usamos RLS. O isolamento entre tenants é feito na aplicação,
--     sempre com WHERE tenant_id = $tenantId na camada de repositories.
--   * Autenticação é via Supabase Auth — esta tabela `users` guarda apenas o
--     perfil de aplicação (tenant, papel). Senha NUNCA fica aqui.
--   * Nomes de tabela/coluna seguem o modelo de dados do projeto (fonte de
--     verdade: docs/INSTRUCOES-PROJETO.md). Não simplificar nem renomear.
-- =============================================================================


-- =============================================================================
-- 1. EXTENSÕES
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- exigida pelas restrições do projeto
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- fornece gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- busca fuzzy por nome (RAG)
CREATE EXTENSION IF NOT EXISTS "btree_gin";   -- combina tenant_id + trigrama num índice GIN


-- =============================================================================
-- 2. FUNÇÃO DE TRIGGER — atualiza atualizado_em automaticamente em cada UPDATE
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
-- Cada corretor (ou corretora) é um tenant. Raiz do isolamento multi-tenant.
-- =============================================================================
CREATE TABLE IF NOT EXISTS tenants (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome                 TEXT NOT NULL,                       -- nome do corretor / corretora
    email                TEXT UNIQUE,                         -- e-mail de contato
    plano                TEXT NOT NULL DEFAULT 'essencial',   -- essencial | profissional
    status               TEXT NOT NULL DEFAULT 'ativo',       -- ativo | suspenso | cancelado
    consultas_mes_atual  INTEGER NOT NULL DEFAULT 0,          -- contador do teto de consultas do agente
    criado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_tenants_atualizado_em ON tenants;
CREATE TRIGGER trg_tenants_atualizado_em
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();


-- =============================================================================
-- 4. TABELA: users
-- Perfil de aplicação do usuário. Credenciais ficam no Supabase Auth.
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email       TEXT NOT NULL UNIQUE,                          -- espelha o e-mail do Supabase Auth
    role        TEXT NOT NULL DEFAULT 'admin',                 -- admin | membro
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users (tenant_id);


-- =============================================================================
-- 5. TABELA: clientes
-- Clientes da carteira do corretor. Núcleo do CRM.
-- Só `nome` é NOT NULL: o cadastro pode ser incompleto de propósito — o
-- score_completude reflete isso e bloqueia alertas quando faltam obrigatórios.
-- =============================================================================
CREATE TABLE IF NOT EXISTS clientes (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- --- Obrigatórios (vazios NÃO travam o INSERT, mas bloqueiam alertas) ---
    nome                 TEXT NOT NULL,
    telefone_whatsapp    TEXT,
    data_inicio_plano    DATE,                                 -- vigência / aniversário do plano
    operadora            TEXT,

    -- --- Importantes (−10% cada no score) ---
    data_aniversario     DATE,                                 -- aniversário do titular
    email                TEXT,
    tipo_plano           TEXT CHECK (tipo_plano IN ('PF','PME','Adesao','PJ')),

    -- --- Complementares (−5% cada no score) ---
    nivel_sinistralidade TEXT CHECK (nivel_sinistralidade IN ('baixo','medio','alto')),
    data_encerramento    DATE,
    carencia_meses       INTEGER,
    qtd_dependentes      INTEGER DEFAULT 0,

    -- --- Demais dados ---
    cpf                  TEXT,                                 -- nullable: nem sempre disponível na hora
    plano_nome           TEXT,
    valor_mensalidade    NUMERIC(10,2),
    vencimento_boleto    INTEGER CHECK (vencimento_boleto BETWEEN 1 AND 31),
    ultimo_contato_em    TIMESTAMPTZ,
    notas                TEXT,

    -- --- Estado e scores ---
    status               TEXT NOT NULL DEFAULT 'ativo'
                              CHECK (status IN ('ativo','inadimplente','cancelado')),
    score_completude     INTEGER NOT NULL DEFAULT 0 CHECK (score_completude BETWEEN 0 AND 100),
    churn_score          INTEGER NOT NULL DEFAULT 0 CHECK (churn_score BETWEEN 0 AND 100),

    criado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_clientes_atualizado_em ON clientes;
CREATE TRIGGER trg_clientes_atualizado_em
    BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- Índices de clientes -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_clientes_tenant_id
    ON clientes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_clientes_tenant_status
    ON clientes (tenant_id, status);
-- Busca fuzzy por nome dentro do tenant (fluxo de RAG): GIN + trigrama.
CREATE INDEX IF NOT EXISTS idx_clientes_tenant_nome
    ON clientes USING GIN (tenant_id, nome gin_trgm_ops);


-- =============================================================================
-- 6. TABELA: alertas
-- Alertas agendados (para o cliente ou para o corretor).
-- =============================================================================
CREATE TABLE IF NOT EXISTS alertas (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
    cliente_id    UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    tipo          TEXT NOT NULL,                        -- aniversario_plano | aniversario_cliente |
                                                        -- boleto_disponivel | boleto_atraso |
                                                        -- sinistralidade | follow_up |
                                                        -- renovar_contato | churn_alto
    canal         TEXT CHECK (canal IN ('whatsapp','email','painel')),
    agendado_para TIMESTAMPTZ,                          -- quando deve disparar (com hora)
    status        TEXT NOT NULL DEFAULT 'pendente'
                       CHECK (status IN ('pendente','enviado','falhou','ignorado')),
    tentativas    INTEGER NOT NULL DEFAULT 0,           -- reprocessamento idempotente do cron
    enviado_em    TIMESTAMPTZ,
    erro          TEXT,                                 -- mensagem de erro do último disparo
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alertas_tenant_id
    ON alertas (tenant_id);
-- Índice PARCIAL: fila de disparo (apenas pendentes).
CREATE INDEX IF NOT EXISTS idx_alertas_pendentes
    ON alertas (tenant_id, agendado_para)
    WHERE status = 'pendente';


-- =============================================================================
-- 7. TABELA: historico_disparos
-- Registro de cada mensagem efetivamente disparada (ligado ao alerta de origem).
-- =============================================================================
CREATE TABLE IF NOT EXISTS historico_disparos (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
    cliente_id       UUID REFERENCES clientes(id) ON DELETE CASCADE,
    alerta_id        UUID REFERENCES alertas(id)  ON DELETE SET NULL,
    canal            TEXT,                              -- whatsapp | email
    conteudo_enviado TEXT,                              -- texto renderizado enviado
    status           TEXT,                              -- enviado | falhou
    criado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historico_tenant_id
    ON historico_disparos (tenant_id);


-- =============================================================================
-- 8. TABELA: sessoes_whatsapp
-- Contexto de conversa do agente. TTL de 30 min via ultima_atividade.
-- =============================================================================
CREATE TABLE IF NOT EXISTS sessoes_whatsapp (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID REFERENCES tenants(id) ON DELETE CASCADE,   -- nulo antes da identificação
    numero_telefone  TEXT NOT NULL,                     -- chave de retomada da sessão
    contexto_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
    ultima_atividade TIMESTAMPTZ NOT NULL DEFAULT now(),
    criado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessoes_telefone
    ON sessoes_whatsapp (numero_telefone);


-- =============================================================================
-- 9. TABELA: templates
-- Templates de mensagem por tenant, tipo e canal.
-- =============================================================================
CREATE TABLE IF NOT EXISTS templates (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tipo          TEXT NOT NULL,                        -- aniversario_plano | boleto_disponivel | ...
    canal         TEXT NOT NULL DEFAULT 'whatsapp'
                       CHECK (canal IN ('whatsapp','email')),
    assunto       TEXT,                                 -- apenas para e-mail
    conteudo      TEXT NOT NULL,                        -- corpo com variáveis {nome} etc.
    ativo         BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- tipo + canal únicos por tenant (garante seeds idempotentes).
    CONSTRAINT uq_templates_tenant_tipo_canal UNIQUE (tenant_id, tipo, canal)
);

DROP TRIGGER IF EXISTS trg_templates_atualizado_em ON templates;
CREATE TRIGGER trg_templates_atualizado_em
    BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

CREATE INDEX IF NOT EXISTS idx_templates_tenant_id
    ON templates (tenant_id);


-- =============================================================================
-- 10. SEEDS — tenant demo (UUID fixo) + templates padrão
-- Idempotente: pode rodar novamente sem duplicar.
-- O CONTEÚDO real dos templates vem do documento "Templates de Mensagem"
-- (Prompt 2, no Notion). Abaixo ficam placeholders só para o tenant demo.
-- =============================================================================
INSERT INTO tenants (id, nome, email, plano)
VALUES ('00000000-0000-0000-0000-000000000000', 'Corretor Demo', 'demo@fideliza.com.br', 'profissional')
ON CONFLICT (id) DO NOTHING;

INSERT INTO templates (tenant_id, tipo, canal, assunto, conteudo)
VALUES
    ('00000000-0000-0000-0000-000000000000', 'aniversario_plano',   'whatsapp', NULL,
        'Oi {nome}! Seu plano {plano_nome} na {operadora} completa um ano em breve. Bora revisar antes do reajuste?'),
    ('00000000-0000-0000-0000-000000000000', 'aniversario_plano',   'email',    'Seu plano faz aniversário em breve',
        'Olá {nome}, seu plano {plano_nome} está próximo da renovação anual. Vamos conversar sobre as opções?'),
    ('00000000-0000-0000-0000-000000000000', 'aniversario_cliente', 'whatsapp', NULL,
        'Feliz aniversário, {nome}! 🎉 Muita saúde. Conte sempre comigo.'),
    ('00000000-0000-0000-0000-000000000000', 'boleto_disponivel',   'whatsapp', NULL,
        'Oi {nome}, tudo bem? O boleto do seu plano vence no dia {vencimento_boleto}. Qualquer dúvida, é só chamar!'),
    ('00000000-0000-0000-0000-000000000000', 'boleto_disponivel',   'email',    'Seu boleto já está disponível',
        'Olá {nome}, o boleto do seu plano {plano_nome} vence no dia {vencimento_boleto}. Estou à disposição.'),
    ('00000000-0000-0000-0000-000000000000', 'follow_up',           'whatsapp', NULL,
        'Oi {nome}! Passando para saber se está tudo certo com seu plano {plano_nome}. Precisa de algo?'),
    ('00000000-0000-0000-0000-000000000000', 'boleto_atraso',       'whatsapp', NULL,
        '[Corretor] {nome} está com boleto em atraso. Vale um contato hoje.'),
    ('00000000-0000-0000-0000-000000000000', 'churn_alto',          'whatsapp', NULL,
        '[Corretor] {nome} está em risco de cancelamento. Motivos: {churn_motivos}.'),
    ('00000000-0000-0000-0000-000000000000', 'cadastro_incompleto', 'whatsapp', NULL,
        '[Corretor] Cadastro de {nome} está em {score_completude}%. Faltam: {campos_faltantes}.')
ON CONFLICT (tenant_id, tipo, canal) DO NOTHING;

-- =============================================================================
-- FIM DO SCHEMA INICIAL
-- =============================================================================
