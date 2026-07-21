const { supabase } = require('../config/supabase');

// lembrete_enviado é gerido pelo cron de lembrete, nunca pelo cliente.
const WRITABLE_COLUMNS = ['usuario_id', 'lead_id', 'titulo', 'descricao', 'data_inicio', 'data_fim'];

function pickWritable(payload) {
  const out = {};
  for (const col of WRITABLE_COLUMNS) {
    if (payload[col] !== undefined) out[col] = payload[col];
  }
  return out;
}

async function create(tenantId, payload) {
  if (!tenantId) throw new Error('tenantId é obrigatório em compromissosRepository.create');

  const row = { ...pickWritable(payload), tenant_id: tenantId };

  const { data, error } = await supabase.from('compromissos').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

async function findById(tenantId, id) {
  if (!tenantId) throw new Error('tenantId é obrigatório em compromissosRepository.findById');

  const { data, error } = await supabase
    .from('compromissos')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function list(tenantId, filters = {}) {
  if (!tenantId) throw new Error('tenantId é obrigatório em compromissosRepository.list');

  let query = supabase.from('compromissos').select('*').eq('tenant_id', tenantId);

  if (filters.usuario_id) query = query.eq('usuario_id', filters.usuario_id);
  if (filters.lead_id) query = query.eq('lead_id', filters.lead_id);
  if (Array.isArray(filters.donoIds)) {
    if (filters.donoIds.length === 0) return [];
    query = query.in('usuario_id', filters.donoIds);
  }
  if (filters.de) query = query.gte('data_inicio', filters.de);
  if (filters.ate) query = query.lte('data_inicio', filters.ate);

  query = query.order('data_inicio', { ascending: true });

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function update(tenantId, id, patch) {
  if (!tenantId) throw new Error('tenantId é obrigatório em compromissosRepository.update');

  const { data, error } = await supabase
    .from('compromissos')
    .update(pickWritable(patch))
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function remove(tenantId, id) {
  if (!tenantId) throw new Error('tenantId é obrigatório em compromissosRepository.remove');

  const { data, error } = await supabase
    .from('compromissos')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function reassignUsuario(tenantId, deId, paraId) {
  const { error } = await supabase
    .from('compromissos')
    .update({ usuario_id: paraId })
    .eq('tenant_id', tenantId)
    .eq('usuario_id', deId);
  if (error) throw error;
}

module.exports = {
  create,
  findById,
  list,
  update,
  remove,
  reassignUsuario,
};
