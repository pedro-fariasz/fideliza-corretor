const { supabase } = require('../config/supabase');

const CAMPOS =
  'id, tenant_id, corretor_id, periodo, referencia_mes, trc, ltv, nps, ppc, tcc, rpc, tmr, score_geral, dados_json, calculado_em';

// Remove os snapshots de BI do tenant (linhas com periodo preenchido). Não toca
// em eventuais linhas legadas da Fase 1 (periodo nulo).
async function deleteSnapshots(tenantId) {
  if (!tenantId) throw new Error('tenantId é obrigatório em biCarteiraRepository.deleteSnapshots');
  const { error } = await supabase
    .from('carteira_agregados').delete().eq('tenant_id', tenantId).not('periodo', 'is', null);
  if (error) throw error;
}

async function insertMany(tenantId, linhas) {
  if (!tenantId) throw new Error('tenantId é obrigatório em biCarteiraRepository.insertMany');
  if (!linhas || linhas.length === 0) return [];
  const rows = linhas.map((l) => ({
    tenant_id: tenantId,
    corretor_id: l.corretor_id || null,
    periodo: l.periodo,
    referencia_mes: l.referencia_mes || null,
    trc: l.metricas?.trc ?? null,
    ltv: l.metricas?.ltv ?? null,
    nps: l.metricas?.nps ?? null,
    ppc: l.metricas?.ppc ?? null,
    tcc: l.metricas?.tcc ?? null,
    rpc: l.metricas?.rpc ?? null,
    tmr: l.metricas?.tmr ?? null,
    score_geral: l.metricas?.score_geral ?? null,
    dados_json: l.dados_json,
    calculado_em: new Date().toISOString(),
  }));
  const { data, error } = await supabase.from('carteira_agregados').insert(rows).select(CAMPOS);
  if (error) throw error;
  return data || [];
}

// Lê snapshots de um período. corretorIds === null => o snapshot da CONTA
// (corretor_id nulo). Array => os snapshots desses corretores.
async function list(tenantId, { periodo, corretorIds }) {
  if (!tenantId) throw new Error('tenantId é obrigatório em biCarteiraRepository.list');
  let q = supabase.from('carteira_agregados').select(CAMPOS).eq('tenant_id', tenantId).eq('periodo', periodo);
  if (corretorIds === null || corretorIds === undefined) {
    q = q.is('corretor_id', null);
  } else {
    if (corretorIds.length === 0) return [];
    q = q.in('corretor_id', corretorIds);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

module.exports = { deleteSnapshots, insertMany, list };
