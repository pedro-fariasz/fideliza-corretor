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

module.exports = { create, remove };
