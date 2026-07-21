const { supabase } = require('../config/supabase');

const CAMPOS = 'id, tenant_id, categoria, etapa_chave, texto, is_padrao, criado_em, atualizado_em';

async function list(tenantId, filters = {}) {
  let q = supabase.from('posvendas_mensagens').select(CAMPOS).eq('tenant_id', tenantId);
  if (filters.categoria) q = q.eq('categoria', filters.categoria);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function find(tenantId, categoria, etapaChave) {
  const { data, error } = await supabase
    .from('posvendas_mensagens').select(CAMPOS)
    .eq('tenant_id', tenantId).eq('categoria', categoria).eq('etapa_chave', etapaChave)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Cria ou atualiza a mensagem (categoria, etapa_chave) — respeita o índice único.
async function upsert(tenantId, categoria, etapaChave, texto, isPadrao) {
  if (!tenantId) throw new Error('tenantId é obrigatório em posvendasMensagensRepository.upsert');
  const row = {
    tenant_id: tenantId,
    categoria,
    etapa_chave: etapaChave,
    texto,
    is_padrao: isPadrao === true,
  };
  const { data, error } = await supabase
    .from('posvendas_mensagens')
    .upsert(row, { onConflict: 'tenant_id,categoria,etapa_chave' })
    .select(CAMPOS)
    .single();
  if (error) throw error;
  return data;
}

async function createMany(tenantId, mensagens) {
  if (!tenantId) throw new Error('tenantId é obrigatório em posvendasMensagensRepository.createMany');
  if (!mensagens || mensagens.length === 0) return [];
  const rows = mensagens.map((m) => ({
    tenant_id: tenantId,
    categoria: m.categoria,
    etapa_chave: m.etapa_chave,
    texto: m.texto,
    is_padrao: m.is_padrao !== false,
  }));
  const { data, error } = await supabase
    .from('posvendas_mensagens')
    .upsert(rows, { onConflict: 'tenant_id,categoria,etapa_chave' })
    .select(CAMPOS);
  if (error) throw error;
  return data || [];
}

async function removeByCategoria(tenantId, categoria) {
  const { error } = await supabase
    .from('posvendas_mensagens').delete().eq('tenant_id', tenantId).eq('categoria', categoria);
  if (error) throw error;
}

module.exports = { list, find, upsert, createMany, removeByCategoria };
