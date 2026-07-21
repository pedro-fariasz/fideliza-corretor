const { supabase } = require('../config/supabase');

// Todas as consultas filtram por tenant_id. `donoIds`/`vendaIds` (array|null)
// aplicam o escopo hierárquico: null = sem restrição (vê tudo do tenant);
// array vazio = não vê nada. Somas são feitas em JS (ok p/ o volume do MVP).

function aplicarDono(query, coluna, donoIds) {
  if (Array.isArray(donoIds)) query = query.in(coluna, donoIds);
  return query;
}

async function contarLeadsCriados(tenantId, { deIso, ateIso, donoIds }) {
  if (Array.isArray(donoIds) && donoIds.length === 0) return 0;
  let q = supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('criado_em', deIso)
    .lte('criado_em', ateIso);
  q = aplicarDono(q, 'dono_id', donoIds);
  const { count, error } = await q;
  if (error) throw error;
  return count || 0;
}

async function contarTotalLeads(tenantId, { donoIds, status } = {}) {
  if (Array.isArray(donoIds) && donoIds.length === 0) return 0;
  let q = supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);
  if (status) q = q.eq('status', status);
  q = aplicarDono(q, 'dono_id', donoIds);
  const { count, error } = await q;
  if (error) throw error;
  return count || 0;
}

async function vendasConcluidas(tenantId, { de, ate, donoIds }) {
  if (Array.isArray(donoIds) && donoIds.length === 0) return { quantidade: 0, valor_total: 0 };
  let q = supabase
    .from('vendas')
    .select('valor')
    .eq('tenant_id', tenantId)
    .eq('status', 'concluida')
    .gte('data_venda', de)
    .lte('data_venda', ate);
  q = aplicarDono(q, 'vendedor_id', donoIds);
  const { data, error } = await q;
  if (error) throw error;
  const quantidade = (data || []).length;
  const valorTotal = (data || []).reduce((acc, v) => acc + Number(v.valor || 0), 0);
  return { quantidade, valor_total: Math.round(valorTotal * 100) / 100 };
}

// Comissões escopadas por vendaIds (array|null). Array vazio => 0.
async function comissaoPrevista(tenantId, { de, ate, vendaIds }) {
  if (Array.isArray(vendaIds) && vendaIds.length === 0) return 0;
  let q = supabase
    .from('comissoes')
    .select('valor_parcela')
    .eq('tenant_id', tenantId)
    .neq('status', 'cancelada')
    .gte('data_prevista', de)
    .lte('data_prevista', ate);
  if (Array.isArray(vendaIds)) q = q.in('venda_id', vendaIds);
  const { data, error } = await q;
  if (error) throw error;
  const total = (data || []).reduce((acc, c) => acc + Number(c.valor_parcela || 0), 0);
  return Math.round(total * 100) / 100;
}

async function comissaoRecebida(tenantId, { de, ate, vendaIds }) {
  if (Array.isArray(vendaIds) && vendaIds.length === 0) return 0;
  let q = supabase
    .from('comissoes')
    .select('valor_parcela')
    .eq('tenant_id', tenantId)
    .eq('status', 'recebida')
    .gte('data_recebida', de)
    .lte('data_recebida', ate);
  if (Array.isArray(vendaIds)) q = q.in('venda_id', vendaIds);
  const { data, error } = await q;
  if (error) throw error;
  const total = (data || []).reduce((acc, c) => acc + Number(c.valor_parcela || 0), 0);
  return Math.round(total * 100) / 100;
}

async function funilResumo(tenantId, { donoIds } = {}) {
  if (Array.isArray(donoIds) && donoIds.length === 0) return {};
  let q = supabase
    .from('leads')
    .select('estagio')
    .eq('tenant_id', tenantId)
    .eq('status', 'ativo');
  q = aplicarDono(q, 'dono_id', donoIds);
  const { data, error } = await q;
  if (error) throw error;
  const contagem = {};
  for (const row of data || []) contagem[row.estagio] = (contagem[row.estagio] || 0) + 1;
  return contagem;
}

async function vendasRecentes(tenantId, { limit = 5, donoIds } = {}) {
  if (Array.isArray(donoIds) && donoIds.length === 0) return [];
  let q = supabase
    .from('vendas')
    .select('id, lead_id, produto_id, valor, forma_pagamento, data_venda, status')
    .eq('tenant_id', tenantId)
    .order('data_venda', { ascending: false })
    .limit(limit);
  q = aplicarDono(q, 'vendedor_id', donoIds);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function leadsRecentes(tenantId, { limit = 5, donoIds } = {}) {
  if (Array.isArray(donoIds) && donoIds.length === 0) return [];
  let q = supabase
    .from('leads')
    .select('id, nome, interesse, origem_especifica, estagio, valor_estimado, criado_em')
    .eq('tenant_id', tenantId)
    .order('criado_em', { ascending: false })
    .limit(limit);
  q = aplicarDono(q, 'dono_id', donoIds);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

module.exports = {
  contarLeadsCriados,
  contarTotalLeads,
  vendasConcluidas,
  comissaoPrevista,
  comissaoRecebida,
  funilResumo,
  vendasRecentes,
  leadsRecentes,
};
