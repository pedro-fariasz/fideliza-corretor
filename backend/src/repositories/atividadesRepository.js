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

module.exports = { create };
