-- =============================================================================
-- Rollback da migration 013 (Relacionamento & Pós-Venda). Reverte
-- 013_relacionamento_pos_venda.sql. Roda limpo mesmo se a up nunca tiver rodado.
-- ⚠️ Destrói cliente_tags, lead_tags, tags e atividades (e dados).
-- =============================================================================

DROP TABLE IF EXISTS cliente_tags;
DROP TABLE IF EXISTS lead_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS atividades;

ALTER TABLE leads DROP COLUMN IF EXISTS ctwa_clid;
ALTER TABLE leads DROP COLUMN IF EXISTS gclid;
ALTER TABLE leads DROP COLUMN IF EXISTS fbclid;
ALTER TABLE leads DROP COLUMN IF EXISTS indicado_por_cliente_id;
ALTER TABLE leads DROP COLUMN IF EXISTS anuncio_id;
ALTER TABLE leads DROP COLUMN IF EXISTS campanha_id;
ALTER TABLE leads DROP COLUMN IF EXISTS origem_canal;

ALTER TABLE carteira_clientes DROP COLUMN IF EXISTS plataforma_descarga_id;
ALTER TABLE carteira_clientes DROP COLUMN IF EXISTS tentar_recuperar_em;
ALTER TABLE carteira_clientes DROP COLUMN IF EXISTS motivo_cancelamento;
ALTER TABLE carteira_clientes DROP COLUMN IF EXISTS data_promovido_base;
ALTER TABLE carteira_clientes DROP COLUMN IF EXISTS tipo_cliente;

DROP TABLE IF EXISTS plataformas_descarga;

-- =============================================================================
-- FIM DO ROLLBACK 013
-- =============================================================================
