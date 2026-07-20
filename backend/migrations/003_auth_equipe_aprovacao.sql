-- =============================================================================
-- Fideliza Corretor — Autenticação: corretor, equipe interna e aprovação
-- Migration: 003_auth_equipe_aprovacao.sql
-- Alvo: PostgreSQL / Supabase (colar direto no SQL Editor)
--
-- O QUE ESTA MIGRATION FAZ
--   1. Estende a tabela `users` (já existente) com os campos necessários para
--      diferenciar papéis e controlar aprovação manual de funcionários:
--        - role passa a aceitar: 'corretor' | 'funcionario' | 'admin'
--        - status: 'ativo' | 'pendente' | 'recusado' | 'suspenso'
--        - nome, aprovado_por, aprovado_em (auditoria da aprovação)
--   2. Cria um TENANT DE PLATAFORMA reservado à equipe interna da Fideliza.
--      Funcionários/admins internos pertencem a ESSE tenant — o poder de ver
--      dados entre corretores vem do ROLE, não do tenant (ver exceção abaixo).
--   3. Cria a allowlist `equipe_pre_aprovada` e semeia o PRIMEIRO admin, para
--      resolver o problema do ovo-e-galinha (sem admin, ninguém aprova ninguém).
--
-- ⚠️ EXCEÇÃO EXPLÍCITA À REGRA DE ISOLAMENTO (decisão do Pedro — 20/07/2026)
--   A regra nº 1 do projeto é: TODA query de dados de negócio filtra por
--   tenant_id. Abre-se AQUI uma única exceção, deliberada e restrita:
--   o PAINEL INTERNO da equipe Fideliza (role 'funcionario'/'admin', status
--   'ativo') consulta a tabela `clientes` de TODOS os tenants, para controle
--   interno. Essa leitura cross-tenant vive num caminho separado e marcado
--   (internalRepository + middleware requireInternal). Corretores continuam
--   100% isolados por tenant_id. Nenhuma outra parte do sistema ignora o
--   tenant_id.
--
-- Papéis:
--   corretor    -> self-signup público, status 'ativo' na hora, dono do tenant.
--   funcionario -> signup na área da equipe, status 'pendente'; só acessa o
--                  painel interno depois que um admin aprovar.
--   admin       -> equipe interna com poder de aprovar funcionários. É semeado
--                  via allowlist (ou aprovado por outro admin).
--
-- Idempotente: pode rodar novamente sem erro.
-- =============================================================================


-- =============================================================================
-- 1. TABELA users — novos campos
-- =============================================================================

-- Nome do usuário (exibido na tela de aprovação da equipe).
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS nome TEXT;

-- Estado do acesso. Corretor nasce 'ativo'; funcionário nasce 'pendente'.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ativo';

-- Auditoria da aprovação manual de funcionários.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS aprovado_por UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ;

-- --- Constraints de domínio (recriadas de forma idempotente) ----------------
-- role: antes o default era 'admin' (contexto antigo). Agora o padrão de quem
-- se cadastra sozinho é 'corretor'.
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'corretor';

ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;
ALTER TABLE users
    ADD CONSTRAINT chk_users_role
    CHECK (role IN ('corretor', 'funcionario', 'admin'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_status;
ALTER TABLE users
    ADD CONSTRAINT chk_users_status
    CHECK (status IN ('ativo', 'pendente', 'recusado', 'suspenso'));

-- Fila de aprovação (funcionários pendentes) e consultas por papel.
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users (role, status);


-- =============================================================================
-- 2. TENANT DE PLATAFORMA — lar da equipe interna Fideliza
-- UUID fixo e reservado. Não é um corretor; agrupa os usuários internos.
-- =============================================================================
INSERT INTO tenants (id, nome, email, plano, status)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Fideliza — Plataforma (interno)',
    'plataforma@fideliza.com.br',
    'profissional',
    'ativo'
)
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 3. ALLOWLIST DA EQUIPE — pré-aprovação por e-mail
-- No cadastro da área da equipe, se o e-mail estiver aqui o usuário entra já
-- 'ativo' com o role indicado; caso contrário, entra como 'funcionario'
-- 'pendente' e espera aprovação manual de um admin.
-- =============================================================================
CREATE TABLE IF NOT EXISTS equipe_pre_aprovada (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email      TEXT NOT NULL UNIQUE,                       -- e-mail do Supabase Auth
    role       TEXT NOT NULL DEFAULT 'funcionario'
                   CHECK (role IN ('funcionario', 'admin')),
    criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --- SEED DO PRIMEIRO ADMIN --------------------------------------------------
-- ⚠️ TROQUE este e-mail pelo do admin inicial real antes de rodar em produção.
-- Quem se cadastrar na área da equipe com este e-mail vira admin 'ativo'
-- automaticamente e passa a poder aprovar os demais funcionários.
INSERT INTO equipe_pre_aprovada (email, role)
VALUES ('pedro.fariasevangelista@gmail.com', 'admin')
ON CONFLICT (email) DO NOTHING;


-- =============================================================================
-- FIM DA MIGRATION 003
-- =============================================================================
