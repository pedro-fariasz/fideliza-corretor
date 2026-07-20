const { supabase } = require('../config/supabase');
const { PLATFORM_TENANT_ID } = require('../config/constants');
const usersRepository = require('../repositories/usersRepository');
const tenantsRepository = require('../repositories/tenantsRepository');

// =============================================================================
// authService — cadastro dos dois fluxos. Login em si é feito pelo Supabase
// Auth direto no frontend; aqui só criamos a credencial + o perfil (users) e,
// no caso do corretor, o tenant.
// =============================================================================

function validarCadastro({ nome, email, senha }) {
  const erros = [];
  if (!nome || !nome.trim()) erros.push('Informe o nome.');
  if (!email || !email.trim()) erros.push('Informe o e-mail.');
  if (!senha || senha.length < 8) erros.push('A senha deve ter ao menos 8 caracteres.');
  if (erros.length) {
    const err = new Error(erros.join(' '));
    err.statusCode = 400;
    throw err;
  }
}

// Cria a credencial no Supabase Auth (e-mail já confirmado — sem etapa extra).
async function criarAuthUser(email, senha) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password: senha,
    email_confirm: true,
  });

  if (error) {
    const jaExiste =
      /already been registered|already exists|duplicate/i.test(error.message || '');
    const err = new Error(
      jaExiste ? 'Já existe uma conta com este e-mail.' : 'Não foi possível criar o acesso.'
    );
    err.statusCode = jaExiste ? 409 : 400;
    throw err;
  }
  return data.user;
}

async function removerAuthUser(id) {
  try {
    await supabase.auth.admin.deleteUser(id);
  } catch (e) {
    console.error('[authService] falha ao reverter usuário do Auth', { id, error: e.message });
  }
}

// --- FLUXO 1: CORRETOR — acesso liberado na hora, cria o próprio tenant ------
async function signupCorretor({ nome, email, senha }) {
  validarCadastro({ nome, email, senha });
  const emailNorm = email.trim().toLowerCase();

  const authUser = await criarAuthUser(emailNorm, senha);

  let tenant;
  try {
    tenant = await tenantsRepository.create({ nome: nome.trim(), email: emailNorm });
    await usersRepository.create({
      id: authUser.id,
      tenantId: tenant.id,
      email: emailNorm,
      nome: nome.trim(),
      role: 'corretor',
      status: 'ativo',
    });
  } catch (e) {
    // Rollback: não deixa credencial órfã se o perfil/tenant falhar.
    if (tenant) await tenantsRepository.remove(tenant.id);
    await removerAuthUser(authUser.id);
    console.error('[authService] signupCorretor falhou', { email: emailNorm, error: e.message });
    const err = new Error('Não foi possível concluir o cadastro. Tente novamente.');
    err.statusCode = 500;
    throw err;
  }

  return { role: 'corretor', status: 'ativo' };
}

// --- FLUXO 2: EQUIPE INTERNA — pendente por padrão; ativo se pré-aprovado ----
async function signupEquipe({ nome, email, senha }) {
  validarCadastro({ nome, email, senha });
  const emailNorm = email.trim().toLowerCase();

  // Allowlist (migration 003): resolve o bootstrap do 1º admin e permite
  // pré-aprovar futuros membros.
  const pre = await usersRepository.findPreAprovada(emailNorm);
  const role = pre ? pre.role : 'funcionario';
  const status = pre ? 'ativo' : 'pendente';

  const authUser = await criarAuthUser(emailNorm, senha);

  try {
    await usersRepository.create({
      id: authUser.id,
      tenantId: PLATFORM_TENANT_ID,
      email: emailNorm,
      nome: nome.trim(),
      role,
      status,
    });
  } catch (e) {
    await removerAuthUser(authUser.id);
    console.error('[authService] signupEquipe falhou', { email: emailNorm, error: e.message });
    const err = new Error('Não foi possível concluir o cadastro. Tente novamente.');
    err.statusCode = 500;
    throw err;
  }

  return { role, status };
}

module.exports = { signupCorretor, signupEquipe };
