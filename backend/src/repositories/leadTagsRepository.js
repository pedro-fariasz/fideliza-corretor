const { supabase } = require('../config/supabase');

// Aplica uma tag a um lead. Idempotente (PK composta lead_id+tag_id) — reaplicar
// a mesma tag não duplica nem quebra.
async function aplicar(tenantId, leadId, tagId) {
  if (!tenantId) throw new Error('tenantId é obrigatório em leadTagsRepository.aplicar');

  const row = { tenant_id: tenantId, lead_id: leadId, tag_id: tagId };
  const { data, error } = await supabase
    .from('lead_tags')
    .upsert(row, { onConflict: 'lead_id,tag_id', ignoreDuplicates: true })
    .select('*');

  if (error) throw error;
  return data;
}

module.exports = { aplicar };
