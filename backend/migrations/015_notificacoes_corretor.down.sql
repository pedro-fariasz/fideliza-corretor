-- =============================================================================
-- Rollback da migration 015 (Central de avisos pra corretora). Reverte
-- 015_notificacoes_corretor.sql. Roda limpo mesmo se a up nunca tiver rodado.
-- ⚠️ Destrói notificacoes_corretor (e dados).
-- =============================================================================

DROP TABLE IF EXISTS notificacoes_corretor;

ALTER TABLE carteira_clientes DROP COLUMN IF EXISTS vencimento_boleto;
ALTER TABLE carteira_clientes DROP COLUMN IF EXISTS operadora;

-- =============================================================================
-- FIM DO ROLLBACK 015
-- =============================================================================
