-- =============================================================================
-- Rollback da migration 011 (Pós-Vendas). Reverte 011_posvendas.sql.
-- ⚠️ Destrói posvendas_status, posvendas_etapas e posvendas_mensagens (e dados).
-- =============================================================================

DROP TABLE IF EXISTS posvendas_status;
DROP TABLE IF EXISTS posvendas_mensagens;
DROP TABLE IF EXISTS posvendas_etapas;

-- =============================================================================
-- FIM DO ROLLBACK 011
-- =============================================================================
