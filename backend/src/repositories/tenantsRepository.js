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

// Dados do tenant atual para o app (GET /api/tenants/me). O id vem do JWT.
async function findById(id) {
  if (!id) throw new Error('id é obrigatório em tenantsRepository.findById');
  const { data, error } = await supabase
    .from('tenants')
    .select('id, nome, whatsapp_conectado, vertical')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Conecta/desconecta o WhatsApp do tenant (placeholder até a integração
// oficial Meta Cloud API existir — v2.5, ver CLAUDE.md). Nunca guarda o token
// bruto: só o estado de conexão.
async function setWhatsappConectado(id, conectado) {
  if (!id) throw new Error('id é obrigatório em tenantsRepository.setWhatsappConectado');
  const { data, error } = await supabase
    .from('tenants')
    .update({ whatsapp_conectado: conectado })
    .eq('id', id)
    .select('id, nome, whatsapp_conectado, vertical')
    .maybeSingle();
  if (error) throw error;
  return data;
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

module.exports = { create, remove, findById, setWhatsappConectado, listCorretorIds };
