const { supabase } = require('../config/supabase');

const WRITABLE_COLUMNS = [
  'lead_id',
  'produto_id',
  'vendedor_id',
  'valor',
  'forma_pagamento',
  'data_venda',
  'status',
  'observacoes',
];

function pickWritable(payload) {
  const out = {};
  for (const col of WRITABLE_COLUMNS) {
    if (payload[col] !== undefined) out[col] = payload[col];
  }
  return out;
}

async function create(tenantId, payload) {
  if (!tenantId) throw new Error('tenantId é obrigatório em vendasRepository.create');

  const row = { ...pickWritable(payload), tenant_id: tenantId };

  const { data, error } = await supabase.from('vendas').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

async function findById(tenantId, id) {
  if (!tenantId) throw new Error('tenantId é obrigatório em vendasRepository.findById');

  const { data, error } = await supabase
    .from('vendas')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function list(tenantId, filters = {}) {
  if (!tenantId) throw new Error('tenantId é obrigatório em vendasRepository.list');

  let query = supabase.from('vendas').select('*').eq('tenant_id', tenantId);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.vendedor_id) query = query.eq('vendedor_id', filters.vendedor_id);
  if (filters.produto_id) query = query.eq('produto_id', filters.produto_id);
  if (filters.data_de) query = query.gte('data_venda', filters.data_de);
  if (filters.data_ate) query = query.lte('data_venda', filters.data_ate);

  query = query.order('data_venda', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function update(tenantId, id, patch) {
  if (!tenantId) throw new Error('tenantId é obrigatório em vendasRepository.update');

  const { data, error } = await supabase
    .from('vendas')
    .update(patch)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function remove(tenantId, id) {
  if (!tenantId) throw new Error('tenantId é obrigatório em vendasRepository.remove');

  const { error } = await supabase.from('vendas').delete().eq('tenant_id', tenantId).eq('id', id);
  if (error) throw error;
}

module.exports = {
  create,
  findById,
  list,
  update,
  remove,
};
