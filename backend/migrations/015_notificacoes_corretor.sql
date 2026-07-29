-- =============================================================================
-- Fideliza Corretor — Central de avisos pra corretora (notificações, sem envio automático)
-- Migration: 015_notificacoes_corretor.sql   (par de rollback: 015_notificacoes_corretor.down.sql)
-- Alvo: PostgreSQL / Supabase (colar direto no SQL Editor)
--
-- CONTEXTO
--   Decisão de produto (sessão atual): o sistema NÃO dispara mensagem pro
--   cliente final. Ele gera uma notificação pra CORRETORA com o texto pronto;
--   ela abre o WhatsApp dela (wa.me) e decide se envia. Esta migration cria a
--   tabela que guarda essas notificações, geradas por cron (aniversário,
--   boleto, follow-up de 7 dias) ou pela esteira de pós-venda existente.
--
--   Também adiciona a `carteira_clientes` duas colunas que a legada `clientes`
--   já tinha (operadora, vencimento_boleto) mas que o CRM novo (migration 010+)
--   ainda não tinha — nenhuma delas é suprida por `data_nascimento`/`telefone`,
--   que já existem e são reaproveitadas para aniversário/WhatsApp.
--
--   Nota sobre o UNIQUE "1x por evento por dia": um índice de expressão sobre
--   `agendada_para::date` não é seguro aqui (o cast timestamptz->date depende
--   do TimeZone da sessão, então o Postgres não garante IMMUTABLE). Em vez de
--   arriscar uma migration que falha no SQL Editor, `agendada_para_dia` é uma
--   coluna comum (não gerada), calculada e preenchida pelo backend na hora do
--   INSERT — mesmo efeito, sem depender de comportamento não documentado.
--
--   Puramente aditiva. Nenhuma coluna existente é removida ou alterada.
--   Nenhum dado é migrado. Idempotente.
-- =============================================================================

ALTER TABLE carteira_clientes
    ADD COLUMN IF NOT EXISTS operadora TEXT;

ALTER TABLE carteira_clientes
    ADD COLUMN IF NOT EXISTS vencimento_boleto INTEGER
        CHECK (vencimento_boleto BETWEEN 1 AND 31);

-- =============================================================================
-- notificacoes_corretor — feed de avisos pra corretora, com texto pronto.
-- =============================================================================
CREATE TABLE IF NOT EXISTS notificacoes_corretor (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    destinatario_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    tipo              TEXT NOT NULL
                          CHECK (tipo IN ('aniversario_cliente','boleto_disponivel',
                                          'follow_up_pos_venda','esteira_posvendas',
                                          'cliente_novo_atencao','retomada_contato',
                                          'churn_alto','cadastro_incompleto','outro')),

    cliente_id        UUID REFERENCES carteira_clientes(id) ON DELETE CASCADE,
    apolice_id        UUID REFERENCES apolices(id) ON DELETE CASCADE,

    titulo            TEXT NOT NULL,
    mensagem_pronta   TEXT NOT NULL,
    canal_sugerido    TEXT NOT NULL DEFAULT 'whatsapp'
                          CHECK (canal_sugerido IN ('whatsapp','email','ligacao','presencial')),
    telefone_destino  TEXT,                          -- E.164; nulo = sem botão de WhatsApp

    agendada_para     TIMESTAMPTZ NOT NULL,
    -- Dia (wall-clock) de agendada_para, calculado pelo backend no INSERT — ver nota acima.
    agendada_para_dia DATE NOT NULL,

    status            TEXT NOT NULL DEFAULT 'pendente'
                          CHECK (status IN ('pendente','visualizada','enviada','descartada')),
    visualizada_em    TIMESTAMPTZ,
    enviada_em        TIMESTAMPTZ,
    descartada_em     TIMESTAMPTZ,

    origem_tipo       TEXT,                          -- 'esteira_posvendas' | 'cron_aniversario' | ...
    origem_id         UUID,                          -- ex.: id da linha em posvendas_status

    criado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_corretor_tenant ON notificacoes_corretor (tenant_id);
-- Feed principal: pendentes de um destinatário, ordenadas por quando devem aparecer.
CREATE INDEX IF NOT EXISTS idx_notificacoes_corretor_pendentes
    ON notificacoes_corretor (tenant_id, destinatario_id, agendada_para)
    WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS idx_notificacoes_corretor_cliente ON notificacoes_corretor (tenant_id, cliente_id);

-- Evita duplicar o mesmo evento (tipo) pro mesmo cliente no mesmo dia.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notificacoes_corretor_evento_dia
    ON notificacoes_corretor (tenant_id, tipo, cliente_id, agendada_para_dia);

GRANT SELECT, INSERT, UPDATE, DELETE ON notificacoes_corretor TO service_role;

-- =============================================================================
-- FIM DA MIGRATION 015
-- =============================================================================
