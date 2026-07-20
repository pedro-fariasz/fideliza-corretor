-- =============================================================================
-- Fideliza Corretor — Concede privilégios de tabela ao papel service_role
-- Migration: 005_grant_service_role.sql
-- Alvo: PostgreSQL / Supabase (colar direto no SQL Editor)
--
-- PROBLEMA QUE ISTO CORRIGE
--   O backend conecta ao Postgres como o papel `service_role` (via SERVICE ROLE
--   KEY). Ao carregar o perfil em GET /api/auth/me, a query em `public.users`
--   voltava com:
--       ERRO 42501: permission denied for table users
--       hint: GRANT SELECT ON public.users TO service_role;
--   Ou seja: faltavam os GRANTs de tabela para `service_role` no schema public.
--   As migrations 001–004 nunca emitiram GRANT — dependiam dos grants padrão do
--   Supabase, que aqui não foram aplicados ao service_role. Isso derrubava o
--   login de TODOS os perfis (corretor e equipe), não só do admin.
--
-- ⚠️ ISTO NÃO ENFRAQUECE O ISOLAMENTO DE TENANT
--   O isolamento é app-layer (WHERE tenant_id = $tenantId nos repositories) e o
--   backend JÁ opera como service_role por design (que bypassa RLS). Este script
--   apenas restaura o acesso de tabela que o backend precisa para funcionar.
--   Continuamos SEM RLS; nada aqui altera papéis, colunas ou a lógica de role.
--
-- Idempotente: pode rodar novamente sem erro.
-- =============================================================================

-- Acesso ao schema.
GRANT USAGE ON SCHEMA public TO service_role;

-- Privilégios de dados nas tabelas existentes (o backend faz CRUD completo).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;

-- Sequences (por segurança; hoje os PKs usam gen_random_uuid, sem serial).
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Tabelas/sequences criadas no futuro já nascem acessíveis ao backend.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO service_role;

-- =============================================================================
-- FIM DA MIGRATION 005
-- =============================================================================
