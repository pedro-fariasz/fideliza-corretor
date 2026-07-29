const { supabase } = require('../config/supabase');

const CAMPOS =
  'id, tenant_id, lead_id, nome, cpf_cnpj, telefone, email, empresa, data_nascimento, nps, health_score, ' +
  'tipo_cliente, data_promovido_base, motivo_cancelamento, tentar_recuperar_em, plataforma_descarga_id, status, ' +
  'criado_em, atualizado_em';
const WRITABLE = [
  'lead_id',
  'nome',
  'cpf_cnpj',
  'telefone',
  'email',
  'empresa',
  'data_nascimento',
  'nps',
  'health_score',
  'tipo_cliente',
  'data_promovido_base',
  'motivo_cancelamento',
  'tentar_recuperar_em',
  'plataforma_descarga_id',
  'status',
];

function pickWritable(payload) {
  const out = {};
  for (const c of WRITABLE) if (payload[c] !== undefined) out[c] = payload[c];
  return out;
}

async function create(tenantId, payload) {
  if (!tenantId) throw new Error('tenantId é obrigatório em carteiraClientesRepository.create');
  const row = { ...pickWritable(payload), tenant_id: tenantId };
  const { data, error } = await supabase.from('carteira_clientes').insert(row).select(CAMPOS).single();
  if (error) throw error;
  return data;
}

async function findById(tenantId, id) {
  const { data, error } = await supabase
    .from('carteira_clientes').select(CAMPOS)
    .eq('tenant_id', tenantId).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function findByLead(tenantId, leadId) {
  if (!leadId) return null;
  const { data, error } = await supabase
    .from('carteira_clientes').select(CAMPOS)
    .eq('tenant_id', tenantId).eq('lead_id', leadId).maybeSingle();
  if (error) throw error;
  return data;
}

async function list(tenantId, filters = {}) {
  let q = supabase.from('carteira_clientes').select(CAMPOS).eq('tenant_id', tenantId);
  if (filters.busca) q = q.ilike('nome', `%${filters.busca}%`);
  q = q.order('criado_em', { ascending: false });
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function update(tenantId, id, patch) {
  const { data, error } = await supabase
    .from('carteira_clientes').update(pickWritable(patch))
    .eq('tenant_id', tenantId).eq('id', id).select(CAMPOS).maybeSingle();
  if (error) throw error;
  return data;
}

// Clientes prontos para a esteira de retomada de contato (job de recuperação).
async function listParaRetomada(tenantId) {
  const hoje = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('carteira_clientes')
    .select(CAMPOS)
    .eq('tenant_id', tenantId)
    .not('tentar_recuperar_em', 'is', null)
    .lte('tentar_recuperar_em', hoje);
  if (error) throw error;
  return data || [];
}

module.exports = { create, findById, findByLead, list, update, listParaRetomada };
