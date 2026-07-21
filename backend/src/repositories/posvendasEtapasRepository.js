const { supabase } = require('../config/supabase');

const CAMPOS =
  'id, tenant_id, categoria, produto_id, chave, nome, ordem, gatilho_tipo, gatilho_dias, ativo, criado_em, atualizado_em';
const WRITABLE = ['categoria', 'produto_id', 'chave', 'nome', 'ordem', 'gatilho_tipo', 'gatilho_dias', 'ativo'];

function pickWritable(payload) {
  const out = {};
  for (const c of WRITABLE) if (payload[c] !== undefined) out[c] = payload[c];
  return out;
}

async function create(tenantId, payload) {
  if (!tenantId) throw new Error('tenantId é obrigatório em posvendasEtapasRepository.create');
  const row = { ...pickWritable(payload), tenant_id: tenantId };
  const { data, error } = await supabase.from('posvendas_etapas').insert(row).select(CAMPOS).single();
  if (error) throw error;
  return data;
}

// Insere várias etapas de uma vez (usado no garantirDefaults / restaurar padrão).
async function createMany(tenantId, etapas) {
  if (!tenantId) throw new Error('tenantId é obrigatório em posvendasEtapasRepository.createMany');
  if (!etapas || etapas.length === 0) return [];
  const rows = etapas.map((e) => ({ ...pickWritable(e), tenant_id: tenantId }));
  const { data, error } = await supabase.from('posvendas_etapas').insert(rows).select(CAMPOS);
  if (error) throw error;
  return data || [];
}

async function findById(tenantId, id) {
  const { data, error } = await supabase
    .from('posvendas_etapas').select(CAMPOS).eq('tenant_id', tenantId).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// Lista etapas de uma categoria. Sem produto_id específico (fluxo da categoria),
// a menos que filters.produto_id seja passado.
async function list(tenantId, filters = {}) {
  let q = supabase.from('posvendas_etapas').select(CAMPOS).eq('tenant_id', tenantId);
  if (filters.categoria) q = q.eq('categoria', filters.categoria);
  if (filters.produto_id === null) q = q.is('produto_id', null);
  else if (filters.produto_id) q = q.eq('produto_id', filters.produto_id);
  q = q.order('ordem', { ascending: true });
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function update(tenantId, id, patch) {
  const { data, error } = await supabase
    .from('posvendas_etapas').update(pickWritable(patch))
    .eq('tenant_id', tenantId).eq('id', id).select(CAMPOS).maybeSingle();
  if (error) throw error;
  return data;
}

async function remove(tenantId, id) {
  const { error } = await supabase.from('posvendas_etapas').delete().eq('tenant_id', tenantId).eq('id', id);
  if (error) throw error;
}

// Apaga o fluxo de uma categoria (produto_id nulo) — usado no "restaurar padrão".
async function removeByCategoria(tenantId, categoria) {
  const { error } = await supabase
    .from('posvendas_etapas').delete()
    .eq('tenant_id', tenantId).eq('categoria', categoria).is('produto_id', null);
  if (error) throw error;
}

module.exports = { create, createMany, findById, list, update, remove, removeByCategoria };
