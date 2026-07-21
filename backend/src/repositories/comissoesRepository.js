const { supabase } = require('../config/supabase');

// Insere as N parcelas de uma venda de uma vez. tenant_id e venda_id são
// injetados pelo backend — nunca vêm do cliente.
async function createMany(tenantId, vendaId, parcelas) {
  if (!tenantId) throw new Error('tenantId é obrigatório em comissoesRepository.createMany');
  if (!Array.isArray(parcelas) || parcelas.length === 0) return [];

  const rows = parcelas.map((p) => ({
    tenant_id: tenantId,
    venda_id: vendaId,
    beneficiario: p.beneficiario || 'corretor',
    percentual: p.percentual,
    valor_parcela: p.valor_parcela,
    num_parcela: p.num_parcela,
    total_parcelas: p.total_parcelas,
    data_prevista: p.data_prevista,
    status: p.status || 'projetada',
  }));

  const { data, error } = await supabase.from('comissoes').insert(rows).select('*');
  if (error) throw error;
  return data || [];
}

async function findById(tenantId, id) {
  if (!tenantId) throw new Error('tenantId é obrigatório em comissoesRepository.findById');

  const { data, error } = await supabase
    .from('comissoes')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function listByVenda(tenantId, vendaId) {
  if (!tenantId) throw new Error('tenantId é obrigatório em comissoesRepository.listByVenda');

  const { data, error } = await supabase
    .from('comissoes')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('venda_id', vendaId)
    .order('num_parcela', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function list(tenantId, filters = {}) {
  if (!tenantId) throw new Error('tenantId é obrigatório em comissoesRepository.list');

  let query = supabase.from('comissoes').select('*').eq('tenant_id', tenantId);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.beneficiario) query = query.eq('beneficiario', filters.beneficiario);
  if (filters.data_prevista_de) query = query.gte('data_prevista', filters.data_prevista_de);
  if (filters.data_prevista_ate) query = query.lte('data_prevista', filters.data_prevista_ate);

  query = query.order('data_prevista', { ascending: true });

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function update(tenantId, id, patch) {
  if (!tenantId) throw new Error('tenantId é obrigatório em comissoesRepository.update');

  const { data, error } = await supabase
    .from('comissoes')
    .update(patch)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Cancela as parcelas de uma venda (menos as já recebidas).
async function cancelByVenda(tenantId, vendaId) {
  if (!tenantId) throw new Error('tenantId é obrigatório em comissoesRepository.cancelByVenda');

  const { error } = await supabase
    .from('comissoes')
    .update({ status: 'cancelada' })
    .eq('tenant_id', tenantId)
    .eq('venda_id', vendaId)
    .neq('status', 'recebida');

  if (error) throw error;
}

module.exports = {
  createMany,
  findById,
  listByVenda,
  list,
  update,
  cancelByVenda,
};
