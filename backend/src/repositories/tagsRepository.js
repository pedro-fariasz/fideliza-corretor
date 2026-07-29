const { supabase } = require('../config/supabase');

async function findByNome(tenantId, nome) {
  if (!tenantId) throw new Error('tenantId é obrigatório em tagsRepository.findByNome');

  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('tenant_id', tenantId)
    .ilike('nome', nome)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function create(tenantId, { nome, cor }) {
  if (!tenantId) throw new Error('tenantId é obrigatório em tagsRepository.create');

  const row = { tenant_id: tenantId, nome, cor: cor || '#1E5EFF' };
  const { data, error } = await supabase.from('tags').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

// Idempotente: reaproveita a tag existente (case-insensitive, migration 013 tem
// UNIQUE(tenant_id, LOWER(nome))) ou cria. Cobre a corrida de duas chamadas
// concorrentes tentando criar a mesma tag pela primeira vez.
// Chama via module.exports (não as funções locais) para que testes consigam
// substituir findByNome/create por dublês.
async function obterOuCriar(tenantId, nome, cor) {
  const existente = await module.exports.findByNome(tenantId, nome);
  if (existente) return existente;

  try {
    return await module.exports.create(tenantId, { nome, cor });
  } catch (err) {
    if (err.code === '23505') {
      const jaCriada = await module.exports.findByNome(tenantId, nome);
      if (jaCriada) return jaCriada;
    }
    throw err;
  }
}

module.exports = { findByNome, create, obterOuCriar };
