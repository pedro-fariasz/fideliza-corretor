-- =============================================================================
-- Fideliza Corretor — Administrador de PLATAFORMA (acesso cross-tenant interno)
-- Migration: 004_platform_admin.sql
-- Alvo: PostgreSQL / Supabase (colar direto no SQL Editor)
--
-- CONTEXTO
--   Até aqui, "admin" era apenas um ROLE DENTRO de um tenant (ver migration 003:
--   role IN 'corretor' | 'funcionario' | 'admin'). Isso NÃO dá visão entre
--   tenants — é o admin da corretora, não da plataforma.
--
--   Esta migration adiciona um conceito SEPARADO e ortogonal ao role: o
--   ADMINISTRADOR DE PLATAFORMA (você/eu). É a flag `is_platform_admin`, usada
--   EXCLUSIVAMENTE pelas rotas /api/admin/* para enxergar todos os tenants.
--
-- ⚠️ RELAÇÃO COM A REGRA DE ISOLAMENTO (decisão do Pedro — 20/07/2026)
--   A regra nº 1 do projeto continua valendo: TODA query de negócio filtra por
--   tenant_id. `is_platform_admin` NÃO é uma autorização para ignorar tenant_id
--   nas rotas normais — é apenas o portão das rotas /api/admin/*. O bypass de
--   tenant_id fora desse caminho continua sendo bug.
--
-- O QUE ESTA MIGRATION FAZ
--   1. Adiciona a coluna `is_platform_admin` (BOOLEAN NOT NULL DEFAULT false) na
--      tabela `users`. Ortogonal ao `role` — NÃO altera a lógica de role.
--   2. Cria um índice PARCIAL só sobre os poucos platform admins (a maioria
--      esmagadora das linhas é false), para lookups baratos.
--   3. Promove o usuário do Pedro a platform admin.
--
-- NÃO faz (mantém o padrão do projeto):
--   * NÃO mexe no domínio/valores de `role` (admin | funcionario | corretor).
--   * NÃO cria RLS policies — isolamento continua na camada de aplicação.
--
-- Idempotente: pode rodar novamente sem erro.
-- =============================================================================


-- =============================================================================
-- 1. TABELA users — flag de administrador de plataforma
-- =============================================================================
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN users.is_platform_admin IS
    'is_platform_admin nunca deve ser usado para bypassar tenant_id em rotas normais — só existe para rotas /api/admin/*.';


-- =============================================================================
-- 2. ÍNDICE PARCIAL — só os platform admins (raros) entram no índice
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_users_platform_admin
    ON users (is_platform_admin)
    WHERE is_platform_admin = true;


-- =============================================================================
-- 3. PROMOÇÃO DO PLATFORM ADMIN INICIAL
-- ⚠️ TROQUE {SEU_EMAIL_AQUI} pelo e-mail real do platform admin antes de rodar.
-- Só afeta a linha correspondente; nenhum outro usuário é alterado.
-- =============================================================================
UPDATE users
    SET is_platform_admin = true
    WHERE email = '{SEU_EMAIL_AQUI}';


-- =============================================================================
-- FIM DA MIGRATION 004
-- =============================================================================
