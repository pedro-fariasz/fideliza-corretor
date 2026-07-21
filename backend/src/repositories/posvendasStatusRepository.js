const { supabase } = require('../config/supabase');

const CAMPOS =
  'id, tenant_id, apolice_id, etapa_id, entrou_em, concluido_em, concluido_por, observacao, criado_em';

async function create(tenantId, payload) {
  if (!tenantId) throw new Error('tenantId é obrigatório em posvendasStatusRepository.create');
  const row = {
    tenant_id: tenantId,
    apolice_id: payload.apolice_id,
    etapa_id: payload.etapa_id,
    entrou_em: payload.entrou_em || new Date().toISOString(),
    observacao: payload.observacao || null,
  };
  const { data, error } = await supabase.from('posvendas_status').insert(row).select(CAMPOS).single();
  if (error) throw error;
  return data;
}

// Status atual (linha mais recente) de uma apólice.
async function findAtual(tenantId, apoliceId) {
  const { data, error } = await supabase
    .from('posvendas_status').select(CAMPOS)
    .eq('tenant_id', tenantId).eq('apolice_id', apoliceId)
    .order('entrou_em', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

// Status atual de todas as apólices do tenant (uma linha por apólice: a mais
// recente). Retorna um mapa apolice_id -> status. Feito em app-layer porque o
// PostgREST não faz DISTINCT ON direto aqui.
async function mapAtualPorApolice(tenantId, apoliceIds) {
  let q = supabase.from('posvendas_status').select(CAMPOS).eq('tenant_id', tenantId);
  if (Array.isArray(apoliceIds)) {
    if (apoliceIds.length === 0) return {};
    q = q.in('apolice_id', apoliceIds);
  }
  q = q.order('entrou_em', { ascending: false });
  const { data, error } = await q;
  if (error) throw error;
  const map = {};
  for (const row of data || []) {
    if (!map[row.apolice_id]) map[row.apolice_id] = row; // primeira = mais recente
  }
  return map;
}

async function update(tenantId, id, patch) {
  const out = {};
  if (patch.concluido_em !== undefined) out.concluido_em = patch.concluido_em;
  if (patch.concluido_por !== undefined) out.concluido_por = patch.concluido_por;
  if (patch.observacao !== undefined) out.observacao = patch.observacao;
  const { data, error } = await supabase
    .from('posvendas_status').update(out)
    .eq('tenant_id', tenantId).eq('id', id).select(CAMPOS).maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = { create, findAtual, mapAtualPorApolice, update };
