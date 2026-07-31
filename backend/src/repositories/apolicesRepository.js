const { supabase } = require('../config/supabase');

const CAMPOS =
  'id, tenant_id, cliente_id, produto_id, corretor_id, venda_id, valor, forma_pagamento, ' +
  'data_inicio, data_vencimento, status, motivo_cancelamento, apolice_mae_id, health_score, criado_em, atualizado_em';
const WRITABLE = [
  'cliente_id', 'produto_id', 'corretor_id', 'venda_id', 'valor', 'forma_pagamento',
  'data_inicio', 'data_vencimento', 'status', 'motivo_cancelamento', 'apolice_mae_id', 'health_score',
];

function pickWritable(payload) {
  const out = {};
  for (const c of WRITABLE) if (payload[c] !== undefined) out[c] = payload[c];
  return out;
}

async function create(tenantId, payload) {
  if (!tenantId) throw new Error('tenantId é obrigatório em apolicesRepository.create');
  const row = { ...pickWritable(payload), tenant_id: tenantId };
  const { data, error } = await supabase.from('apolices').insert(row).select(CAMPOS).single();
  if (error) throw error;
  return data;
}

async function findById(tenantId, id) {
  const { data, error } = await supabase
    .from('apolices').select(CAMPOS).eq('tenant_id', tenantId).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// Idempotência da ponte venda->apólice: uma venda gera no máximo uma apólice.
async function findByVenda(tenantId, vendaId) {
  if (!tenantId) throw new Error('tenantId é obrigatório em apolicesRepository.findByVenda');
  if (!vendaId) return null;
  const { data, error } = await supabase
    .from('apolices').select(CAMPOS).eq('tenant_id', tenantId).eq('venda_id', vendaId).maybeSingle();
  if (error) throw error;
  return data;
}

// Embute nome do cliente e do produto (para as telas de carteira).
const CAMPOS_LIST = `${CAMPOS}, cliente:carteira_clientes(id,nome), produto:produtos(id,nome)`;

async function list(tenantId, filters = {}) {
  let q = supabase.from('apolices').select(CAMPOS_LIST).eq('tenant_id', tenantId);
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.cliente_id) q = q.eq('cliente_id', filters.cliente_id);
  if (filters.corretor_id) q = q.eq('corretor_id', filters.corretor_id);
  if (Array.isArray(filters.donoIds)) {
    if (filters.donoIds.length === 0) return [];
    q = q.in('corretor_id', filters.donoIds);
  }
  q = q.order('data_vencimento', { ascending: true });
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function listByCliente(tenantId, clienteId) {
  const { data, error } = await supabase
    .from('apolices').select(CAMPOS)
    .eq('tenant_id', tenantId).eq('cliente_id', clienteId)
    .order('data_inicio', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function update(tenantId, id, patch) {
  const { data, error } = await supabase
    .from('apolices').update(pickWritable(patch))
    .eq('tenant_id', tenantId).eq('id', id).select(CAMPOS).maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = { create, findById, findByVenda, list, listByCliente, update };
