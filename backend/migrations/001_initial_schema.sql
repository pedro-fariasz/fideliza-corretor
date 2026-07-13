-- =============================================================================
-- Fideliza Corretor — Schema Inicial (001)
-- SaaS multi-tenant de pós-venda para corretores de plano de saúde
-- =============================================================================
-- Alvo: Supabase (PostgreSQL). Pronto para colar no SQL Editor.
--
-- ⚠️  ISOLAMENTO DE TENANT
-- O backend usa a SERVICE ROLE KEY do Supabase, que BYPASSA a RLS por completo.
-- Por decisão de arquitetura, NÃO criamos RLS policies aqui: o isolamento entre
-- tenants é feito EXCLUSIVAMENTE na camada de aplicação (repositories), com
-- `WHERE tenant_id = $tenantId` em TODA query. O tenant_id vem SEMPRE do JWT.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Extensões
-- -----------------------------------------------------------------------------
-- uuid-ossp: habilitada por requisito do projeto (funções uuid_generate_*).
-- Usamos gen_random_uuid() (nativa do PostgreSQL) para os defaults das PKs.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- -----------------------------------------------------------------------------
-- Função e gatilho de atualização automática de atualizado_em
-- -----------------------------------------------------------------------------
-- Mantém a coluna atualizado_em sincronizada em cada UPDATE, sem depender da
-- aplicação lembrar de setar o campo.
CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- -----------------------------------------------------------------------------
-- Tabela: tenants (corretores / contas do SaaS)
-- -----------------------------------------------------------------------------
-- Cada corretor independente é um tenant. Toda outra tabela referencia
-- tenant_id para garantir o isolamento na aplicação.
CREATE TABLE IF NOT EXISTS tenants (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome          TEXT NOT NULL,                      -- nome do corretor / da corretora
    email         TEXT NOT NULL UNIQUE,               -- e-mail de login/contato do tenant
    telefone      TEXT,                               -- telefone de contato
    ativo         BOOLEAN NOT NULL DEFAULT TRUE,      -- desativa o tenant sem apagar dados
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_tenants_atualizado_em
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION set_atualizado_em();


-- -----------------------------------------------------------------------------
-- Tabela: usuarios (logins vinculados a um tenant)
-- -----------------------------------------------------------------------------
-- Usuários que autenticam no sistema. O tenant_id do usuário logado é o que
-- alimenta o JWT e, por consequência, o filtro de isolamento das queries.
CREATE TABLE IF NOT EXISTS usuarios (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nome          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,               -- e-mail de login
    senha_hash    TEXT NOT NULL,                      -- hash da senha (nunca em texto puro)
    ativo         BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_usuarios_atualizado_em
    BEFORE UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION set_atualizado_em();

CREATE INDEX IF NOT EXISTS idx_usuarios_tenant_id ON usuarios (tenant_id);


-- -----------------------------------------------------------------------------
-- Tabela: clientes (cadastro dos segurados do corretor)
-- -----------------------------------------------------------------------------
-- Coração do sistema. O corretor cadastra o cliente uma vez e o sistema cuida
-- do relacionamento. Os campos abaixo alimentam o cálculo do score de
-- completude (ver CLAUDE.md).
CREATE TABLE IF NOT EXISTS clientes (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- --- Campos OBRIGATÓRIOS (bloqueiam alertas se vazios) ---
    nome                 TEXT NOT NULL,
    telefone_whatsapp    TEXT NOT NULL,
    data_inicio_plano    DATE,
    operadora            TEXT,

    -- --- Campos IMPORTANTES (−10% cada no score) ---
    data_aniversario     DATE,
    email                TEXT,
    tipo_plano           TEXT,

    -- --- Campos COMPLEMENTARES (−5% cada no score) ---
    nivel_sinistralidade TEXT,
    data_encerramento    DATE,
    carencia_meses       INTEGER,
    qtd_dependentes      INTEGER DEFAULT 0,

    -- --- Dados adicionais ---
    -- CPF nullable: nem sempre o corretor tem o dado na hora do cadastro.
    cpf                  TEXT,
    -- Dia do mês de vencimento do boleto (1 a 31).
    vencimento_boleto    INTEGER CHECK (vencimento_boleto BETWEEN 1 AND 31),

    -- --- Estado e score ---
    -- score de completude (0 a 100), recalculado ao salvar o cliente.
    score                INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
    -- status do relacionamento: ativo | inativo | encerrado
    status               TEXT NOT NULL DEFAULT 'ativo',

    criado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Gatilho para atualizar atualizado_em automaticamente em clientes.
CREATE OR REPLACE TRIGGER trg_clientes_atualizado_em
    BEFORE UPDATE ON clientes
    FOR EACH ROW
    EXECUTE FUNCTION set_atualizado_em();

-- Índices de clientes (isolamento e consultas mais frequentes).
CREATE INDEX IF NOT EXISTS idx_clientes_tenant_id     ON clientes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_clientes_tenant_status ON clientes (tenant_id, status);
-- idx_clientes_tenant_nome: usado pelo RAG / busca por nome dentro do tenant.
CREATE INDEX IF NOT EXISTS idx_clientes_tenant_nome   ON clientes (tenant_id, nome);


-- -----------------------------------------------------------------------------
-- Tabela: alertas (lembretes/ações automáticas geradas para cada cliente)
-- -----------------------------------------------------------------------------
-- O cron (fase futura) gera alertas de pós-venda; aqui já deixamos a estrutura
-- e os índices prontos.
CREATE TABLE IF NOT EXISTS alertas (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
    cliente_id    UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    tipo          TEXT NOT NULL,                       -- ex.: aniversario, vencimento_boleto, renovacao
    canal         TEXT,                                -- ex.: whatsapp, email
    -- status do alerta: pendente | enviado | cancelado | erro
    status        TEXT NOT NULL DEFAULT 'pendente',
    agendado_para TIMESTAMPTZ,                         -- quando o alerta deve disparar
    enviado_em    TIMESTAMPTZ,                         -- quando efetivamente foi enviado
    payload       JSONB,                               -- dados extras do alerta
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alertas_tenant_id ON alertas (tenant_id);
-- Índice PARCIAL: acelera a varredura do cron pelos alertas ainda pendentes.
CREATE INDEX IF NOT EXISTS idx_alertas_pendentes
    ON alertas (tenant_id, agendado_para)
    WHERE status = 'pendente';


-- -----------------------------------------------------------------------------
-- Tabela: historico (log de interações com o cliente)
-- -----------------------------------------------------------------------------
-- Registra mensagens enviadas/recebidas, mudanças e eventos relevantes, para
-- dar contexto ao agente e ao corretor.
CREATE TABLE IF NOT EXISTS historico (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
    cliente_id  UUID REFERENCES clientes(id) ON DELETE CASCADE,
    tipo        TEXT NOT NULL,                         -- ex.: mensagem_enviada, mensagem_recebida, nota
    canal       TEXT,                                 -- ex.: whatsapp, email, sistema
    conteudo    TEXT,                                 -- corpo da mensagem/nota
    metadata    JSONB,                                -- dados extras (ids externos, status, etc.)
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historico_tenant_id ON historico (tenant_id);


-- -----------------------------------------------------------------------------
-- Tabela: sessoes (estado das conversas de WhatsApp por telefone)
-- -----------------------------------------------------------------------------
-- Mantém o contexto da conversa do agente com o cliente/corretor, indexado
-- pelo telefone que originou a mensagem.
CREATE TABLE IF NOT EXISTS sessoes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID REFERENCES tenants(id)  ON DELETE CASCADE,
    cliente_id    UUID REFERENCES clientes(id) ON DELETE SET NULL,
    telefone      TEXT NOT NULL,                       -- número que identifica a sessão
    estado        TEXT,                                -- estágio atual do fluxo conversacional
    contexto      JSONB,                               -- memória/contexto da conversa
    expira_em     TIMESTAMPTZ,                         -- expiração da janela de sessão
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_sessoes_atualizado_em
    BEFORE UPDATE ON sessoes
    FOR EACH ROW
    EXECUTE FUNCTION set_atualizado_em();

-- idx_sessoes_telefone: lookup da sessão pelo telefone quando chega mensagem.
CREATE INDEX IF NOT EXISTS idx_sessoes_telefone ON sessoes (telefone);


-- -----------------------------------------------------------------------------
-- Tabela: templates (modelos de mensagem por tenant)
-- -----------------------------------------------------------------------------
-- Modelos reutilizáveis de mensagem (WhatsApp/e-mail). Cada tenant tem os seus;
-- o tenant demo recebe um conjunto padrão nos seeds abaixo.
CREATE TABLE IF NOT EXISTS templates (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    chave         TEXT NOT NULL,                       -- identificador lógico (ex.: aniversario)
    canal         TEXT NOT NULL DEFAULT 'whatsapp',    -- whatsapp | email
    titulo        TEXT,                                -- assunto (para e-mail) ou rótulo interno
    corpo         TEXT NOT NULL,                       -- texto com placeholders {{nome}} etc.
    ativo         BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, chave, canal)
);

CREATE OR REPLACE TRIGGER trg_templates_atualizado_em
    BEFORE UPDATE ON templates
    FOR EACH ROW
    EXECUTE FUNCTION set_atualizado_em();

CREATE INDEX IF NOT EXISTS idx_templates_tenant_id ON templates (tenant_id);


-- =============================================================================
-- SEEDS — Tenant demo + templates padrão
-- =============================================================================
-- Tenant demo com UUID fixo para facilitar desenvolvimento e testes locais.
INSERT INTO tenants (id, nome, email)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'Corretor Demo',
    'demo@fidelizacorretor.com.br'
)
ON CONFLICT (id) DO NOTHING;

-- Templates padrão para o tenant demo. ON CONFLICT evita duplicar em re-execução.
INSERT INTO templates (tenant_id, chave, canal, titulo, corpo)
VALUES
    (
        '00000000-0000-0000-0000-000000000000',
        'boas_vindas', 'whatsapp', 'Boas-vindas',
        'Olá {{nome}}! 👋 Seu plano com a {{operadora}} está ativo. Qualquer dúvida, é só me chamar por aqui.'
    ),
    (
        '00000000-0000-0000-0000-000000000000',
        'aniversario', 'whatsapp', 'Aniversário',
        'Feliz aniversário, {{nome}}! 🎉 Que seu novo ciclo seja de muita saúde. Conte comigo para o que precisar.'
    ),
    (
        '00000000-0000-0000-0000-000000000000',
        'vencimento_boleto', 'whatsapp', 'Lembrete de vencimento',
        'Oi {{nome}}, passando para lembrar que o boleto do seu plano vence no dia {{vencimento_boleto}}. Já recebeu? 😊'
    ),
    (
        '00000000-0000-0000-0000-000000000000',
        'renovacao', 'email', 'Renovação do seu plano de saúde',
        'Olá {{nome}}, o seu plano com a {{operadora}} está próximo do período de renovação. Vamos conversar sobre as opções?'
    )
ON CONFLICT (tenant_id, chave, canal) DO NOTHING;

-- =============================================================================
-- FIM DO SCHEMA 001
-- =============================================================================
