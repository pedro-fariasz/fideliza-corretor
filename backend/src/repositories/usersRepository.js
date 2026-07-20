const { supabase } = require('../config/supabase');

// =============================================================================
// usersRepository — perfil de aplicação (tabela users). Credenciais ficam no
// Supabase Auth. users.id === id do usuário no Supabase Auth.
// =============================================================================

async function findById(id) {
  const { data, error } = await supabase
    .from('users')
    .select('id, tenant_id, email, nome, role, status')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function findByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('id, tenant_id, email, nome, role, status')
    .eq('email', email)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Cria o perfil. `id` é o UUID vindo do Supabase Auth.
async function create({ id, tenantId, email, nome, role, status }) {
  const { data, error } = await supabase
    .from('users')
    .insert({ id, tenant_id: tenantId, email, nome, role, status })
    .select('id, tenant_id, email, nome, role, status')
    .single();

  if (error) throw error;
  return data;
}

// Consulta a allowlist de pré-aprovação (migration 003).
async function findPreAprovada(email) {
  const { data, error } = await supabase
    .from('equipe_pre_aprovada')
    .select('email, role')
    .eq('email', email)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Funcionários aguardando aprovação manual.
async function listPendentes() {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, nome, role, status, criado_em')
    .eq('status', 'pendente')
    .in('role', ['funcionario', 'admin'])
    .order('criado_em', { ascending: true });

  if (error) throw error;
  return data || [];
}

// Muda o status de um usuário interno (aprovação/recusa). Restringe a papéis
// internos por segurança — nunca mexe em corretor por esta via.
async function setStatusInterno(id, status, aprovadoPor) {
  const patch = { status };
  if (status === 'ativo') {
    patch.aprovado_por = aprovadoPor;
    patch.aprovado_em = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('users')
    .update(patch)
    .eq('id', id)
    .in('role', ['funcionario', 'admin'])
    .select('id, email, nome, role, status')
    .maybeSingle();

  if (error) throw error;
  return data;
}

module.exports = {
  findById,
  findByEmail,
  create,
  findPreAprovada,
  listPendentes,
  setStatusInterno,
};
