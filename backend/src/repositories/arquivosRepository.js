const { supabase } = require('../config/supabase');

// =============================================================================
// arquivosRepository — PDFs de cotação/proposta (migration 007). O arquivo
// pode existir antes de um lead/cliente formal (por isso lead_id é nullable).
// =============================================================================

const CAMPOS =
  'id, tenant_id, lead_id, tipo, storage_path, nome_original, mime_type, tamanho_bytes, ' +
  'status_extracao, dados_extraidos_json, erro, criado_em, atualizado_em';

async function create(tenantId, payload) {
  if (!tenantId) throw new Error('tenantId é obrigatório em arquivosRepository.create');
  const row = {
    tenant_id: tenantId,
    lead_id: payload.lead_id || null,
    tipo: payload.tipo,
    storage_path: payload.storage_path,
    nome_original: payload.nome_original || null,
    mime_type: payload.mime_type || null,
    tamanho_bytes: payload.tamanho_bytes || null,
    status_extracao: payload.status_extracao || 'processando',
  };
  const { data, error } = await supabase.from('arquivos').insert(row).select(CAMPOS).single();
  if (error) throw error;
  return data;
}

async function list(tenantId, filtros = {}) {
  if (!tenantId) throw new Error('tenantId é obrigatório em arquivosRepository.list');
  let q = supabase.from('arquivos').select(CAMPOS).eq('tenant_id', tenantId);
  if (filtros.lead_id) q = q.eq('lead_id', filtros.lead_id);
  if (Array.isArray(filtros.leadIds)) q = q.in('lead_id', filtros.leadIds);
  if (filtros.tipo) q = q.eq('tipo', filtros.tipo);
  if (filtros.status_extracao) q = q.eq('status_extracao', filtros.status_extracao);
  q = q.order('criado_em', { ascending: false });
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function findById(tenantId, id) {
  if (!tenantId) throw new Error('tenantId é obrigatório em arquivosRepository.findById');
  const { data, error } = await supabase
    .from('arquivos')
    .select(CAMPOS)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = { create, list, findById };
