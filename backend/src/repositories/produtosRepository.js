const { supabase } = require('../config/supabase');

// Colunas que o cliente pode gravar. tenant_id é sempre injetado pelo backend.
const WRITABLE_COLUMNS = [
  'nome',
  'categoria',
  'descricao',
  'tipo_comissao',
  'parcelas_limite',
  'percentual',
  'inicio_pagamento',
  'dia_pagamento',
  'ativo',
];

function pickWritable(payload) {
  const out = {};
  for (const col of WRITABLE_COLUMNS) {
    if (payload[col] !== undefined) out[col] = payload[col];
  }
  return out;
}

async function create(tenantId, payload) {
  if (!tenantId) throw new Error('tenantId é obrigatório em produtosRepository.create');

  const row = { ...pickWritable(payload), tenant_id: tenantId };

  const { data, error } = await supabase
    .from('produtos')
    .insert(row)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function findById(tenantId, id) {
  if (!tenantId) throw new Error('tenantId é obrigatório em produtosRepository.findById');

  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function list(tenantId, filters = {}) {
  if (!tenantId) throw new Error('tenantId é obrigatório em produtosRepository.list');

  let query = supabase
    .from('produtos')
    .select('*')
    .eq('tenant_id', tenantId);

  if (filters.ativo !== undefined) query = query.eq('ativo', filters.ativo);
  if (filters.categoria) query = query.eq('categoria', filters.categoria);

  query = query.order('criado_em', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function update(tenantId, id, payload) {
  if (!tenantId) throw new Error('tenantId é obrigatório em produtosRepository.update');

  const patch = pickWritable(payload);

  const { data, error } = await supabase
    .from('produtos')
    .update(patch)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data;
}

module.exports = {
  create,
  findById,
  list,
  update,
};
