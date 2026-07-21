-- =============================================================================
-- Fideliza Corretor — CRM de vendas (MVP): leads, funil, produtos, comissão
-- Migration: 006_crm_vendas.sql
-- Alvo: PostgreSQL / Supabase (colar direto no SQL Editor)
--
-- CONTEXTO
--   Mudança de rumo (21/07/2026): o produto deixa de ser pós-venda puro de
--   plano de saúde e passa a ser um CRM de vendas multi-vertical (consórcio,
--   seguro, saúde, imobiliário). Ver docs/PRD-fideliza-corretor.md.
--   As tabelas legadas (clientes, alertas, templates, historico_disparos,
--   sessoes_whatsapp) PERMANECEM, mas ficam fora do escopo do MVP atual.
--
-- REGRAS MANTIDAS
--   * NÃO usamos RLS. Isolamento é app-layer: WHERE tenant_id = $tenantId em
--     TODA query. Por isso TODA tabela nova carrega tenant_id — inclusive as
--     que "poderiam" chegar via join (ex.: comissoes), porque relatórios
--     consultam essas tabelas direto e precisam do filtro.
--   * tenant_id SEMPRE vem do JWT, nunca do body.
--   * Nomes de tabela/coluna em português snake_case.
--
-- Idempotente: pode rodar novamente sem duplicar (IF NOT EXISTS / DO NOTHING).
-- =============================================================================


-- =============================================================================
-- 1. TENANTS — colunas de conta/assinatura do MVP
-- (a tabela já existe na migration 001; aqui só acrescentamos)
-- =============================================================================
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS vertical              TEXT;   -- consorcio | seguro | saude | imobiliario (vertical principal da conta)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_termina_em      TIMESTAMPTZ;  -- fim do trial de 14 dias (definido no signup)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS asaas_customer_id     TEXT;   -- id do cliente no provedor de pagamento
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT;   -- id da assinatura no provedor de pagamento

COMMENT ON COLUMN tenants.trial_termina_em IS 'Fim do trial. Após esta data sem assinatura ativa, status vira suspenso (login bloqueado com CTA de assinatura).';


-- =============================================================================
-- 2. LEADS — oportunidade de venda. Coração do CRM.
-- Só `nome` é NOT NULL (cadastro rápido / entrada por PDF ainda incompleta).
-- =============================================================================
CREATE TABLE IF NOT EXISTS leads (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    dono_id           UUID REFERENCES users(id) ON DELETE SET NULL,   -- vendedor responsável

    nome              TEXT NOT NULL,
    tipo_pessoa       TEXT NOT NULL DEFAULT 'PF' CHECK (tipo_pessoa IN ('PF','PJ')),
    empresa           TEXT,
    cpf_cnpj          TEXT,
    telefone          TEXT,
    email             TEXT,

    interesse         TEXT,                       -- produto de interesse (alimenta BI futuro)
    origem_especifica TEXT,                       -- canal granular (Instagram, Indicação, ... , Proposta (PDF))
    estagio           TEXT NOT NULL DEFAULT 'prospectos'
                           CHECK (estagio IN ('prospectos','qualificados','proposta_enviada',
                                              'negociacao','finalizacao','venda_concluida')),
    probabilidade     INTEGER NOT NULL DEFAULT 5 CHECK (probabilidade BETWEEN 0 AND 100),
    valor_estimado    NUMERIC(12,2),

    origem_cadastro   TEXT NOT NULL DEFAULT 'manual' CHECK (origem_cadastro IN ('manual','pdf')),
    observacoes       TEXT,
    ultimo_contato_em TIMESTAMPTZ,

    criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_leads_atualizado_em ON leads;
CREATE TRIGGER trg_leads_atualizado_em
    BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

CREATE INDEX IF NOT EXISTS idx_leads_tenant_id      ON leads (tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_estagio ON leads (tenant_id, estagio);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_dono    ON leads (tenant_id, dono_id);
-- Busca fuzzy por nome dentro do tenant (dedupe / busca na lista).
CREATE INDEX IF NOT EXISTS idx_leads_tenant_nome    ON leads USING GIN (tenant_id, nome gin_trgm_ops);
-- Lookup de dedupe por telefone (aviso "já existe lead com esse telefone").
CREATE INDEX IF NOT EXISTS idx_leads_tenant_telefone ON leads (tenant_id, telefone);


-- =============================================================================
-- 3. PRODUTOS — catálogo + regra de comissão. O "cérebro financeiro".
-- =============================================================================
CREATE TABLE IF NOT EXISTS produtos (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    nome             TEXT NOT NULL,
    categoria        TEXT CHECK (categoria IN ('consorcio','seguro','saude','imobiliario')),
    descricao        TEXT,

    -- Regra de comissão (modelo Fixa % no MVP; bônus/vitalício/diluída ficam pra v2)
    tipo_comissao    TEXT NOT NULL CHECK (tipo_comissao IN ('limitada','recorrente')),
    parcelas_limite  INTEGER CHECK (parcelas_limite BETWEEN 1 AND 120),      -- obrigatório se 'limitada'
    percentual       NUMERIC(6,2) NOT NULL CHECK (percentual > 0 AND percentual <= 100),
    inicio_pagamento TEXT NOT NULL DEFAULT 'mes_seguinte'
                          CHECK (inicio_pagamento IN ('mes_seguinte','mesmo_mes')),
    dia_pagamento    INTEGER CHECK (dia_pagamento BETWEEN 1 AND 28),         -- obrigatório se 'mesmo_mes'

    ativo            BOOLEAN NOT NULL DEFAULT TRUE,

    criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Coerência da regra de comissão garantida no banco:
    CONSTRAINT chk_produtos_parcelas
        CHECK (tipo_comissao <> 'limitada' OR parcelas_limite IS NOT NULL),
    CONSTRAINT chk_produtos_dia
        CHECK (inicio_pagamento <> 'mesmo_mes' OR dia_pagamento IS NOT NULL)
);

DROP TRIGGER IF EXISTS trg_produtos_atualizado_em ON produtos;
CREATE TRIGGER trg_produtos_atualizado_em
    BEFORE UPDATE ON produtos
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

CREATE INDEX IF NOT EXISTS idx_produtos_tenant_id    ON produtos (tenant_id);
CREATE INDEX IF NOT EXISTS idx_produtos_tenant_ativo ON produtos (tenant_id, ativo);


-- =============================================================================
-- 4. VENDAS — nascem ao mover o card para "Venda Concluída" no funil.
-- =============================================================================
CREATE TABLE IF NOT EXISTS vendas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id         UUID REFERENCES leads(id)   ON DELETE SET NULL,
    produto_id      UUID NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
    vendedor_id     UUID REFERENCES users(id)   ON DELETE SET NULL,

    valor           NUMERIC(12,2) NOT NULL CHECK (valor > 0),
    forma_pagamento TEXT CHECK (forma_pagamento IN ('debito','boleto','pix','cartao','dinheiro','outro')),
    data_venda      DATE NOT NULL DEFAULT CURRENT_DATE,
    status          TEXT NOT NULL DEFAULT 'concluida' CHECK (status IN ('concluida','cancelada')),
    observacoes     TEXT,

    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_vendas_atualizado_em ON vendas;
CREATE TRIGGER trg_vendas_atualizado_em
    BEFORE UPDATE ON vendas
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

CREATE INDEX IF NOT EXISTS idx_vendas_tenant_id     ON vendas (tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendas_tenant_status ON vendas (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_vendas_tenant_data   ON vendas (tenant_id, data_venda);


-- =============================================================================
-- 5. COMISSOES — 1 venda gera N parcelas, cada uma com sua data prevista.
-- `beneficiario` já modela a COMISSÃO DUPLA (corretor + corretora) no banco;
-- no MVP a UI só usa 'corretor'. Ver PRD §6.5 / §8.
-- tenant_id denormalizado de propósito: relatório "a receber por mês" consulta
-- comissoes direto e PRECISA do filtro de isolamento.
-- =============================================================================
CREATE TABLE IF NOT EXISTS comissoes (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    venda_id       UUID NOT NULL REFERENCES vendas(id)  ON DELETE CASCADE,

    beneficiario   TEXT NOT NULL DEFAULT 'corretor' CHECK (beneficiario IN ('corretor','corretora')),
    percentual     NUMERIC(6,2),
    valor_parcela  NUMERIC(12,2) NOT NULL,
    num_parcela    INTEGER NOT NULL,
    total_parcelas INTEGER,
    data_prevista  DATE NOT NULL,
    data_recebida  DATE,
    status         TEXT NOT NULL DEFAULT 'projetada'
                        CHECK (status IN ('projetada','recebida','cancelada')),

    criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_comissoes_atualizado_em ON comissoes;
CREATE TRIGGER trg_comissoes_atualizado_em
    BEFORE UPDATE ON comissoes
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

CREATE INDEX IF NOT EXISTS idx_comissoes_tenant_id       ON comissoes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_venda_id        ON comissoes (venda_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_tenant_prevista ON comissoes (tenant_id, data_prevista);
CREATE INDEX IF NOT EXISTS idx_comissoes_tenant_status   ON comissoes (tenant_id, status);


-- =============================================================================
-- 6. INTERACOES — timeline do lead. O funil escreve aqui automaticamente
-- ("Movido de Qualificado para Proposta"), mesmo sem tela dedicada no MVP.
-- =============================================================================
CREATE TABLE IF NOT EXISTS interacoes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id    UUID NOT NULL REFERENCES leads(id)   ON DELETE CASCADE,
    usuario_id UUID REFERENCES users(id) ON DELETE SET NULL,

    tipo       TEXT NOT NULL DEFAULT 'nota'
                    CHECK (tipo IN ('nota','ligacao','whatsapp','email','reuniao',
                                    'sistema','mudanca_estagio')),
    descricao  TEXT,

    criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interacoes_tenant_id   ON interacoes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_interacoes_tenant_lead ON interacoes (tenant_id, lead_id);


-- =============================================================================
-- 7. COMPROMISSOS — agenda simples (evento único no MVP).
-- =============================================================================
CREATE TABLE IF NOT EXISTS compromissos (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    usuario_id       UUID REFERENCES users(id) ON DELETE CASCADE,
    lead_id          UUID REFERENCES leads(id) ON DELETE SET NULL,

    titulo           TEXT NOT NULL,
    descricao        TEXT,
    data_inicio      TIMESTAMPTZ NOT NULL,
    data_fim         TIMESTAMPTZ NOT NULL,
    lembrete_enviado BOOLEAN NOT NULL DEFAULT FALSE,   -- cron de e-mail 1h antes (idempotência)

    criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_compromissos_atualizado_em ON compromissos;
CREATE TRIGGER trg_compromissos_atualizado_em
    BEFORE UPDATE ON compromissos
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

CREATE INDEX IF NOT EXISTS idx_compromissos_tenant_id    ON compromissos (tenant_id);
CREATE INDEX IF NOT EXISTS idx_compromissos_tenant_inicio ON compromissos (tenant_id, data_inicio);
-- Fila do lembrete: só o que ainda não foi avisado.
CREATE INDEX IF NOT EXISTS idx_compromissos_lembrete
    ON compromissos (tenant_id, data_inicio)
    WHERE lembrete_enviado = FALSE;


-- =============================================================================
-- 8. GRANTS — garante acesso do backend (service_role) às novas tabelas.
-- (A migration 005 já configurou ALTER DEFAULT PRIVILEGES, mas reemitimos por
--  segurança caso estas tabelas tenham sido criadas por outro papel.)
-- =============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- =============================================================================
-- FIM DA MIGRATION 006
-- =============================================================================
