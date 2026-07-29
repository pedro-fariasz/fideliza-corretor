const { supabase } = require('../config/supabase');

// =============================================================================
// usersRepository — perfil de aplicação (tabela users). Credenciais ficam no
// Supabase Auth. users.id === id do usuário no Supabase Auth.
// =============================================================================

const CAMPOS = 'id, tenant_id, email, nome, role, status, papel_conta, cargo, lider_id, ativo, ultimo_acesso, criado_em';

async function findById(id) {
  const { data, error } = await supabase
    .from('users')
    .select(CAMPOS)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function findByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select(CAMPOS)
    .eq('email', email)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Usuário dentro de um tenant específico (usado pela gestão de equipe).
async function findByIdInTenant(tenantId, id) {
  const { data, error } = await supabase
    .from('users')
    .select(CAMPOS)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Cria o perfil. `id` é o UUID vindo do Supabase Auth.
async function create({ id, tenantId, email, nome, role, status, papelConta, cargo, liderId, ativo }) {
  const row = { id, tenant_id: tenantId, email, nome, role, status };
  if (papelConta !== undefined) row.papel_conta = papelConta;
  if (cargo !== undefined) row.cargo = cargo;
  if (liderId !== undefined) row.lider_id = liderId;
  if (ativo !== undefined) row.ativo = ativo;

  const { data, error } = await supabase.from('users').insert(row).select(CAMPOS).single();
  if (error) throw error;
  return data;
}

// O corretor dono do tenant (role='corretor'). Cada tenant de corretor tem
// exatamente um. Uso restrito a JOBS internos (cron), nunca em rota de usuário.
async function findCorretorDoTenant(tenantId) {
  const { data, error } = await supabase
    .from('users')
    .select(CAMPOS)
    .eq('tenant_id', tenantId)
    .eq('role', 'corretor')
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Lista os usuários de uma conta (gestão de equipe).
async function listByTenant(tenantId) {
  const { data, error } = await supabase
    .from('users')
    .select(CAMPOS)
    .eq('tenant_id', tenantId)
    .order('criado_em', { ascending: true });

  if (error) throw error;
  return data || [];
}

// Ids dos subordinados DIRETOS de um líder (lider_id = liderId).
async function listSubordinadoIds(tenantId, liderId) {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('lider_id', liderId);

  if (error) throw error;
  return (data || []).map((u) => u.id);
}

// Atualiza campos da conta (nome, cargo, lider_id, papel_conta, ativo), no tenant.
async function updateConta(tenantId, id, patch) {
  const permitido = {};
  for (const k of ['nome', 'cargo', 'lider_id', 'papel_conta', 'ativo']) {
    if (patch[k] !== undefined) permitido[k] = patch[k];
  }
  const { data, error } = await supabase
    .from('users')
    .update(permitido)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select(CAMPOS)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function setUltimoAcesso(id) {
  const { error } = await supabase
    .from('users')
    .update({ ultimo_acesso: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
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
  findByIdInTenant,
  findCorretorDoTenant,
  create,
  listByTenant,
  listSubordinadoIds,
  updateConta,
  setUltimoAcesso,
  findPreAprovada,
  listPendentes,
  setStatusInterno,
};
