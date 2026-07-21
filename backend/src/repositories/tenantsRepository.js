const { supabase } = require('../config/supabase');

// =============================================================================
// tenantsRepository — cada corretor é um tenant (raiz do isolamento).
// =============================================================================

async function create({ nome, email }) {
  const { data, error } = await supabase
    .from('tenants')
    .insert({ nome, email })
    .select('id, nome, email, plano, status')
    .single();

  if (error) throw error;
  return data;
}

async function remove(id) {
  const { error } = await supabase.from('tenants').delete().eq('id', id);
  if (error) throw error;
}

// Ids de todos os tenants de corretor (exclui o tenant de plataforma interno).
// Uso restrito a JOBS internos (cron), nunca em rota de usuário.
async function listCorretorIds() {
  const { PLATFORM_TENANT_ID } = require('../config/constants');
  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .neq('id', PLATFORM_TENANT_ID);
  if (error) throw error;
  return (data || []).map((t) => t.id);
}

module.exports = { create, remove, listCorretorIds };
