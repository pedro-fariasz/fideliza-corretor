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

module.exports = { create, listByLead };
