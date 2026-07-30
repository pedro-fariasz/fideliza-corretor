const { supabase } = require('../config/supabase');

// Log leve de negócio (migration 013). tenant_id é sempre injetado pelo backend.
const WRITABLE_COLUMNS = ['usuario_id', 'entidade', 'entidade_id', 'acao', 'detalhes'];

function pickWritable(payload) {
  const out = {};
  for (const col of WRITABLE_COLUMNS) {
    if (payload[col] !== undefined) out[col] = payload[col];
  }
  return out;
}

async function create(tenantId, payload) {
  if (!tenantId) throw new Error('tenantId é obrigatório em atividadesRepository.create');

  const row = { ...pickWritable(payload), tenant_id: tenantId };

  const { data, error } = await supabase.from('atividades').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

// Feed cronológico do tenant (aba Inteligência). Isolamento por tenant_id
// (WHERE tenant_id) — a service role BYPASSA a RLS, então o filtro é obrigatório.
// JOIN com users (usuario_id -> users.id) para trazer usuario_nome; quando
// usuario_id é null (autor foi o cron), o nome vira 'sistema'.
async function list(tenantId, { limit = 20, entidade, entidadeId, de, ate } = {}) {
  if (!tenantId) throw new Error('tenantId é obrigatório em atividadesRepository.list');

  let q = supabase
    .from('atividades')
    .select('id, entidade, entidade_id, acao, detalhes, usuario_id, criado_em, users(nome)')
    .eq('tenant_id', tenantId)
    .order('criado_em', { ascending: false })
    .limit(limit);

  if (entidade) q = q.eq('entidade', entidade);
  if (entidadeId) q = q.eq('entidade_id', entidadeId);
  if (de) q = q.gte('criado_em', de);
  if (ate) q = q.lte('criado_em', ate);

  const { data, error } = await q;
  if (error) throw error;

  return (data || []).map((r) => ({
    id: r.id,
    entidade: r.entidade,
    entidade_id: r.entidade_id,
    acao: r.acao,
    detalhes: r.detalhes,
    usuario_id: r.usuario_id,
    usuario_nome: r.users && r.users.nome ? r.users.nome : 'sistema',
    criado_em: r.criado_em,
  }));
}

module.exports = { create, list };
