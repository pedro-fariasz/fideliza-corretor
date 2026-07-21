-- =============================================================================
-- Fideliza Corretor — Fase 0: equipe, papéis da conta e hierarquia
-- Migration: 009_equipe_permissoes.sql   (par de rollback: 009_..._down.sql)
-- Alvo: PostgreSQL / Supabase (colar direto no SQL Editor)
--
-- CONTEXTO
--   Uma conta (tenant) passa a ter VÁRIOS usuários com papéis distintos.
--   Introduz um EIXO NOVO, ortogonal ao `role` de plataforma:
--     * role (existente)  -> corretor | funcionario | admin  (PLATAFORMA:
--                            corretor = cliente; funcionario/admin = equipe
--                            interna Fideliza). NÃO é tocado aqui.
--     * papel_conta (novo)-> administrador | corretor | secretaria
--                            (papel DENTRO da conta do corretor)
--     * cargo (novo)      -> vendedor | lider | gerente
--                            (hierarquia; só se aplica a papel_conta='corretor')
--     * lider_id (novo)   -> auto-referência p/ o líder direto do vendedor
--
--   O isolamento por tenant_id continua igual. A hierarquia é uma camada A MAIS
--   de escopo DENTRO do tenant (vendedor vê os próprios; líder vê subordinados;
--   gerente/administrador vê tudo da conta).
--
-- Idempotente.
-- =============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS papel_conta   TEXT;   -- administrador | corretor | secretaria
ALTER TABLE users ADD COLUMN IF NOT EXISTS cargo         TEXT;   -- vendedor | lider | gerente (só p/ papel_conta='corretor')
ALTER TABLE users ADD COLUMN IF NOT EXISTS lider_id      UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ativo         BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ultimo_acesso TIMESTAMPTZ;

-- Domínios (recriados de forma idempotente).
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_papel_conta;
ALTER TABLE users ADD CONSTRAINT chk_users_papel_conta
    CHECK (papel_conta IS NULL OR papel_conta IN ('administrador','corretor','secretaria'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_cargo;
ALTER TABLE users ADD CONSTRAINT chk_users_cargo
    CHECK (cargo IS NULL OR cargo IN ('vendedor','lider','gerente'));

-- Backfill: todo corretor-dono já existente vira administrador/gerente
-- (mantém "vê tudo da conta" = exatamente o comportamento atual; não quebra nada).
UPDATE users
   SET papel_conta = 'administrador', cargo = 'gerente'
 WHERE role = 'corretor' AND papel_conta IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_tenant_lider ON users (tenant_id, lider_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON users TO service_role;

-- =============================================================================
-- FIM DA MIGRATION 009
-- =============================================================================
