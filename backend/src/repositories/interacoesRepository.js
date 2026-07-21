const { supabase } = require('../config/supabase');

async function create(tenantId, payload) {
  if (!tenantId) throw new Error('tenantId é obrigatório em interacoesRepository.create');

  const row = {
    tenant_id: tenantId,
    lead_id: payload.lead_id,
    usuario_id: payload.usuario_id || null,
    tipo: payload.tipo || 'nota',
    descricao: payload.descricao || null,
  };

  const { data, error } = await supabase
    .from('interacoes')
    .insert(row)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function listByLead(tenantId, leadId) {
  if (!tenantId) throw new Error('tenantId é obrigatório em interacoesRepository.listByLead');

  const { data, error } = await supabase
    .from('interacoes')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('lead_id', leadId)
    .order('criado_em', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Mapa lead_id -> data da interação mais recente ('YYYY-MM-DD'), para o BI
// ("sem contato nos últimos N dias"). Uma query, reduzido em app-layer.
async function latestPorLead(tenantId) {
  if (!tenantId) throw new Error('tenantId é obrigatório em interacoesRepository.latestPorLead');
  const { data, error } = await supabase
    .from('interacoes')
    .select('lead_id, criado_em')
    .eq('tenant_id', tenantId)
    .order('criado_em', { ascending: false });
  if (error) throw error;
  const map = {};
  for (const row of data || []) {
    if (row.lead_id && !map[row.lead_id]) map[row.lead_id] = String(row.criado_em).slice(0, 10);
  }
  return map;
}

module.exports = { create, listByLead, latestPorLead };
