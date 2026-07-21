-- =============================================================================
-- Fideliza Corretor — Arquivos de proposta (PDF) + bucket de storage
-- Migration: 007_arquivos_propostas.sql
-- Alvo: PostgreSQL / Supabase (colar direto no SQL Editor)
--
-- CONTEXTO
--   Cadastro de lead via upload do PDF da proposta (PRD §6.3.1). O corretor
--   sobe o PDF que já tem em mãos; a Claude API extrai os dados em background;
--   o corretor confirma numa tela pré-preenchida antes de salvar o lead.
--
--   `arquivos` guarda o PDF (referência ao objeto no storage) + o resultado
--   bruto da extração (dados_extraidos_json). O arquivo pode existir ANTES do
--   lead ser salvo (por isso lead_id é nullable).
--
-- PRIVACIDADE (LGPD)
--   O PDF contém dado pessoal. O bucket `propostas` é PRIVADO. O frontend nunca
--   acessa o objeto direto: o backend (service_role) gera URL assinada de
--   curta duração quando o corretor precisa ver o arquivo. Não há política de
--   storage pública — o acesso é sempre mediado pelo backend, com filtro de
--   tenant_id, como no resto do sistema.
--
-- Idempotente.
-- =============================================================================


-- =============================================================================
-- 1. TABELA: arquivos
-- =============================================================================
CREATE TABLE IF NOT EXISTS arquivos (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id              UUID REFERENCES leads(id) ON DELETE SET NULL,   -- pode ser nulo até o lead ser salvo

    tipo                 TEXT NOT NULL DEFAULT 'proposta_pdf',
    storage_path         TEXT NOT NULL,                 -- caminho do objeto no bucket `propostas`
    nome_original        TEXT,
    mime_type            TEXT,
    tamanho_bytes        BIGINT,

    -- Estado da extração assíncrona por IA
    status_extracao      TEXT NOT NULL DEFAULT 'processando'
                              CHECK (status_extracao IN ('processando','concluida','falhou')),
    dados_extraidos_json JSONB,                         -- campos que a IA leu (sugestão, não verdade)
    erro                 TEXT,                          -- motivo da falha de extração

    criado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_arquivos_atualizado_em ON arquivos;
CREATE TRIGGER trg_arquivos_atualizado_em
    BEFORE UPDATE ON arquivos
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

CREATE INDEX IF NOT EXISTS idx_arquivos_tenant_id     ON arquivos (tenant_id);
CREATE INDEX IF NOT EXISTS idx_arquivos_tenant_lead   ON arquivos (tenant_id, lead_id);
-- Fila de extração: só o que está processando.
CREATE INDEX IF NOT EXISTS idx_arquivos_processando
    ON arquivos (tenant_id, criado_em)
    WHERE status_extracao = 'processando';


-- =============================================================================
-- 2. BUCKET DE STORAGE (privado) — `propostas`
-- Cria o bucket via SQL. Se preferir, dá pra criar pela UI do Supabase
-- (Storage → New bucket → nome `propostas`, "Public" DESmarcado).
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('propostas', 'propostas', false)
ON CONFLICT (id) DO NOTHING;

-- Observação: NÃO criamos policies de storage. O backend acessa o bucket como
-- service_role (que bypassa RLS de storage), e o isolamento por tenant é feito
-- na aplicação (o caminho do objeto começa com o tenant_id, ex.:
-- `<tenant_id>/<uuid>.pdf`, e toda leitura passa pelo backend filtrando tenant).

GRANT SELECT, INSERT, UPDATE, DELETE ON arquivos TO service_role;

-- =============================================================================
-- FIM DA MIGRATION 007
-- =============================================================================
