const { supabase } = require('../config/supabase');

const CAMPOS =
  'id, tenant_id, destinatario_id, tipo, cliente_id, apolice_id, titulo, mensagem_pronta, ' +
  'canal_sugerido, telefone_destino, agendada_para, status, visualizada_em, enviada_em, ' +
  'descartada_em, origem_tipo, origem_id, criado_em';

const WRITABLE = [
  'destinatario_id',
  'tipo',
  'cliente_id',
  'apolice_id',
  'titulo',
  'mensagem_pronta',
  'canal_sugerido',
  'telefone_destino',
  'agendada_para',
  'agendada_para_dia',
  'status',
  'visualizada_em',
  'enviada_em',
  'descartada_em',
  'origem_tipo',
  'origem_id',
];

function pickWritable(payload) {
  const out = {};
  for (const c of WRITABLE) if (payload[c] !== undefined) out[c] = payload[c];
  return out;
}

async function create(tenantId, payload) {
  if (!tenantId) throw new Error('tenantId é obrigatório em notificacoesCorretorRepository.create');
  const row = { ...pickWritable(payload), tenant_id: tenantId };
  const { data, error } = await supabase.from('notificacoes_corretor').insert(row).select(CAMPOS).single();
  if (error) throw error;
  return data;
}

async function findById(tenantId, id) {
  if (!tenantId) throw new Error('tenantId é obrigatório em notificacoesCorretorRepository.findById');
  const { data, error } = await supabase
    .from('notificacoes_corretor')
    .select(CAMPOS)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function list(tenantId, filtros = {}) {
  if (!tenantId) throw new Error('tenantId é obrigatório em notificacoesCorretorRepository.list');
  let q = supabase.from('notificacoes_corretor').select(CAMPOS).eq('tenant_id', tenantId);
  if (filtros.destinatario_id) q = q.eq('destinatario_id', filtros.destinatario_id);
  if (filtros.status) q = q.eq('status', filtros.status);
  if (filtros.tipo) q = q.eq('tipo', filtros.tipo);
  if (filtros.de) q = q.gte('agendada_para', filtros.de);
  if (filtros.ate) q = q.lte('agendada_para', filtros.ate);
  q = q.order('agendada_para', { ascending: false });
  if (filtros.limit) q = q.limit(filtros.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// Feed principal: pendentes que já deveriam ter aparecido (agendada_para <= agora).
async function listPendentes(tenantId, destinatarioId) {
  if (!tenantId) throw new Error('tenantId é obrigatório em notificacoesCorretorRepository.listPendentes');
  const agora = new Date().toISOString();
  let q = supabase
    .from('notificacoes_corretor')
    .select(CAMPOS)
    .eq('tenant_id', tenantId)
    .eq('status', 'pendente')
    .lte('agendada_para', agora);
  if (destinatarioId) q = q.eq('destinatario_id', destinatarioId);
  q = q.order('agendada_para', { ascending: true });
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function update(tenantId, id, patch) {
  if (!tenantId) throw new Error('tenantId é obrigatório em notificacoesCorretorRepository.update');
  const { data, error } = await supabase
    .from('notificacoes_corretor')
    .update(pickWritable(patch))
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select(CAMPOS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Contagem pro badge do menu (pendentes já visíveis).
async function countPendentes(tenantId, destinatarioId) {
  if (!tenantId) throw new Error('tenantId é obrigatório em notificacoesCorretorRepository.countPendentes');
  const agora = new Date().toISOString();
  let q = supabase
    .from('notificacoes_corretor')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'pendente')
    .lte('agendada_para', agora);
  if (destinatarioId) q = q.eq('destinatario_id', destinatarioId);
  const { count, error } = await q;
  if (error) throw error;
  return count || 0;
}

module.exports = { create, findById, list, listPendentes, update, countPendentes };
