-- =============================================================================
-- Fideliza Corretor — Consentimento para felicitação de aniversário
-- Migration: 002_consentimento_felicitacao.sql
-- Alvo: PostgreSQL / Supabase (colar direto no SQL Editor)
--
-- Motivo: a mensagem de aniversário via WhatsApp é classificada como MARKETING
-- pela Meta e exige consentimento explícito do cliente (LGPD + regras da Meta).
-- O checkbox no formulário de cadastro grava este campo; o cron da Fase 3 deve
-- checar `aceita_felicitacao_aniversario = TRUE` antes de agendar/disparar o
-- alerta `aniversario_cliente`.
--
-- Idempotente: pode rodar novamente sem erro.
-- =============================================================================

ALTER TABLE clientes
    ADD COLUMN IF NOT EXISTS aceita_felicitacao_aniversario BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN clientes.aceita_felicitacao_aniversario IS
    'Consentimento explícito do cliente para receber felicitação de aniversário por WhatsApp (LGPD + regras da Meta). FALSE por padrão; sem TRUE aqui, o alerta aniversario_cliente não pode ser disparado.';

-- =============================================================================
-- FIM
-- =============================================================================
