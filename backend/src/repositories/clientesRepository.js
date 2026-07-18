const { supabase } = require('../config/supabase');

// Colunas permitidas para gravação no banco. score_completude é escrito
// só pelo backend (nunca aceito do cliente).
const WRITABLE_COLUMNS = [
  'nome',
  'telefone_whatsapp',
  'data_inicio_plano',
  'operadora',
  'data_aniversario',
  'email',
  'tipo_plano',
  'nivel_sinistralidade',
  'data_encerramento',
  'carencia_meses',
  'qtd_dependentes',
  'cpf',
  'plano_nome',
  'valor_mensalidade',
  'vencimento_boleto',
  'ultimo_contato_em',
  'notas',
  'status',
  'aceita_felicitacao_aniversario',
];

function pickWritable(payload) {
  const out = {};
  for (const col of WRITABLE_COLUMNS) {
    if (payload[col] !== undefined) out[col] = payload[col];
  }
  return out;
}

async function create(tenantId, payload) {
  if (!tenantId) throw new Error('tenantId é obrigatório em clientesRepository.create');

  const row = { ...pickWritable(payload), tenant_id: tenantId };
  if (payload.score_completude !== undefined) row.score_completude = payload.score_completude;

  const { data, error } = await supabase
    .from('clientes')
    .insert(row)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function findById(tenantId, id) {
  if (!tenantId) throw new Error('tenantId é obrigatório em clientesRepository.findById');

  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function list(tenantId, filters = {}) {
  if (!tenantId) throw new Error('tenantId é obrigatório em clientesRepository.list');

  let query = supabase
    .from('clientes')
    .select('*')
    .eq('tenant_id', tenantId);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.operadora) query = query.eq('operadora', filters.operadora);
  if (filters.incompletos) query = query.lt('score_completude', 60);

  query = query.order('criado_em', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function update(tenantId, id, payload) {
  if (!tenantId) throw new Error('tenantId é obrigatório em clientesRepository.update');

  const patch = pickWritable(payload);
  if (payload.score_completude !== undefined) patch.score_completude = payload.score_completude;

  const { data, error } = await supabase
    .from('clientes')
    .update(patch)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function softDelete(tenantId, id) {
  if (!tenantId) throw new Error('tenantId é obrigatório em clientesRepository.softDelete');

  const { data, error } = await supabase
    .from('clientes')
    .update({ status: 'cancelado' })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data;
}

module.exports = {
  create,
  findById,
  list,
  update,
  softDelete,
};
