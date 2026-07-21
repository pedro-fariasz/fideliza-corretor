const { supabase } = require('../config/supabase');

// Colunas graváveis pelo cliente. tenant_id é sempre injetado pelo backend.
const WRITABLE_COLUMNS = [
  'dono_id',
  'nome',
  'tipo_pessoa',
  'empresa',
  'cpf_cnpj',
  'telefone',
  'email',
  'interesse',
  'origem_especifica',
  'estagio',
  'probabilidade',
  'valor_estimado',
  'origem_cadastro',
  'observacoes',
  'ultimo_contato_em',
  'status',
  'motivo_perda',
];

function pickWritable(payload) {
  const out = {};
  for (const col of WRITABLE_COLUMNS) {
    if (payload[col] !== undefined) out[col] = payload[col];
  }
  return out;
}

async function create(tenantId, payload) {
  if (!tenantId) throw new Error('tenantId é obrigatório em leadsRepository.create');

  const row = { ...pickWritable(payload), tenant_id: tenantId };

  const { data, error } = await supabase
    .from('leads')
    .insert(row)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function findById(tenantId, id) {
  if (!tenantId) throw new Error('tenantId é obrigatório em leadsRepository.findById');

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function findByTelefone(tenantId, telefone) {
  if (!tenantId) throw new Error('tenantId é obrigatório em leadsRepository.findByTelefone');
  if (!telefone) return [];

  const { data, error } = await supabase
    .from('leads')
    .select('id, nome, telefone, estagio')
    .eq('tenant_id', tenantId)
    .eq('telefone', telefone);

  if (error) throw error;
  return data || [];
}

async function list(tenantId, filters = {}) {
  if (!tenantId) throw new Error('tenantId é obrigatório em leadsRepository.list');

  let query = supabase
    .from('leads')
    .select('*')
    .eq('tenant_id', tenantId);

  if (filters.estagio) query = query.eq('estagio', filters.estagio);
  if (filters.dono_id) query = query.eq('dono_id', filters.dono_id);
  if (filters.origem_especifica) query = query.eq('origem_especifica', filters.origem_especifica);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.telefone) query = query.eq('telefone', filters.telefone);
  if (filters.busca) query = query.ilike('nome', `%${filters.busca}%`);

  query = query.order('atualizado_em', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function update(tenantId, id, payload) {
  if (!tenantId) throw new Error('tenantId é obrigatório em leadsRepository.update');

  const patch = pickWritable(payload);

  const { data, error } = await supabase
    .from('leads')
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
  findByTelefone,
  list,
  update,
};
