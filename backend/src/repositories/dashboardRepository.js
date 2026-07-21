const { supabase } = require('../config/supabase');

// Todas as consultas filtram por tenant_id. Somas são feitas em JS (o Supabase
// não soma sem RPC) — ok para o volume do MVP; migrar para RPC/materialized
// view se um tenant crescer muito.

async function contarLeadsCriados(tenantId, { deIso, ateIso, donoId }) {
  let q = supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('criado_em', deIso)
    .lte('criado_em', ateIso);
  if (donoId) q = q.eq('dono_id', donoId);
  const { count, error } = await q;
  if (error) throw error;
  return count || 0;
}

async function contarTotalLeads(tenantId, { donoId, status } = {}) {
  let q = supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);
  if (donoId) q = q.eq('dono_id', donoId);
  if (status) q = q.eq('status', status);
  const { count, error } = await q;
  if (error) throw error;
  return count || 0;
}

async function vendasConcluidas(tenantId, { de, ate, vendedorId }) {
  let q = supabase
    .from('vendas')
    .select('valor')
    .eq('tenant_id', tenantId)
    .eq('status', 'concluida')
    .gte('data_venda', de)
    .lte('data_venda', ate);
  if (vendedorId) q = q.eq('vendedor_id', vendedorId);
  const { data, error } = await q;
  if (error) throw error;
  const quantidade = (data || []).length;
  const valorTotal = (data || []).reduce((acc, v) => acc + Number(v.valor || 0), 0);
  return { quantidade, valor_total: Math.round(valorTotal * 100) / 100 };
}

// Soma das parcelas com data_prevista no período (exclui canceladas).
async function comissaoPrevista(tenantId, { de, ate }) {
  const { data, error } = await supabase
    .from('comissoes')
    .select('valor_parcela')
    .eq('tenant_id', tenantId)
    .neq('status', 'cancelada')
    .gte('data_prevista', de)
    .lte('data_prevista', ate);
  if (error) throw error;
  const total = (data || []).reduce((acc, c) => acc + Number(c.valor_parcela || 0), 0);
  return Math.round(total * 100) / 100;
}

// Soma das parcelas efetivamente recebidas no período.
async function comissaoRecebida(tenantId, { de, ate }) {
  const { data, error } = await supabase
    .from('comissoes')
    .select('valor_parcela')
    .eq('tenant_id', tenantId)
    .eq('status', 'recebida')
    .gte('data_recebida', de)
    .lte('data_recebida', ate);
  if (error) throw error;
  const total = (data || []).reduce((acc, c) => acc + Number(c.valor_parcela || 0), 0);
  return Math.round(total * 100) / 100;
}

// Contagem de leads ativos por estágio (funil resumido).
async function funilResumo(tenantId, { donoId } = {}) {
  let q = supabase
    .from('leads')
    .select('estagio')
    .eq('tenant_id', tenantId)
    .eq('status', 'ativo');
  if (donoId) q = q.eq('dono_id', donoId);
  const { data, error } = await q;
  if (error) throw error;

  const contagem = {};
  for (const row of data || []) {
    contagem[row.estagio] = (contagem[row.estagio] || 0) + 1;
  }
  return contagem;
}

async function vendasRecentes(tenantId, limit = 5) {
  const { data, error } = await supabase
    .from('vendas')
    .select('id, lead_id, produto_id, valor, forma_pagamento, data_venda, status')
    .eq('tenant_id', tenantId)
    .order('data_venda', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function leadsRecentes(tenantId, limit = 5) {
  const { data, error } = await supabase
    .from('leads')
    .select('id, nome, interesse, origem_especifica, estagio, valor_estimado, criado_em')
    .eq('tenant_id', tenantId)
    .order('criado_em', { ascending: false })
    .limit(limit);
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
