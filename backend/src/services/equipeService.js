const { supabase } = require('../config/supabase');
const usersRepository = require('../repositories/usersRepository');
const leadsRepository = require('../repositories/leadsRepository');
const vendasRepository = require('../repositories/vendasRepository');
const compromissosRepository = require('../repositories/compromissosRepository');

// =============================================================================
// equipeService — gestão de usuários DENTRO de uma conta (tenant).
// Só o administrador da conta chega aqui (gate por requirePermissao('usuarios')).
// Todos os usuários da conta têm role='corretor' (eixo de plataforma); o que
// muda é o papel_conta (administrador|corretor|secretaria) + cargo.
// =============================================================================

const CARGOS = ['vendedor', 'lider', 'gerente'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}
class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

function validarNovo({ nome, email, senha, confirmarSenha }) {
  const erros = [];
  if (!nome || nome.trim().length < 3) erros.push('Informe o nome (mín. 3 caracteres).');
  if (!email || !EMAIL_RE.test(email.trim())) erros.push('Informe um e-mail válido.');
  if (!senha || senha.length < 8) erros.push('A senha deve ter ao menos 8 caracteres.');
  if (senha !== confirmarSenha) erros.push('As senhas não coincidem.');
  if (erros.length) throw new ValidationError(erros.join(' '));
}

async function criarAuthUser(email, senha) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password: senha,
    email_confirm: true,
  });
  if (error) {
    const jaExiste = /already|exists|duplicate/i.test(error.message || '');
    const err = new ValidationError(
      jaExiste ? 'Já existe uma conta com este e-mail.' : 'Não foi possível criar o acesso.'
    );
    if (jaExiste) err.statusCode = 409;
    throw err;
  }
  return data.user;
}

async function removerAuthUser(id) {
  try {
    await supabase.auth.admin.deleteUser(id);
  } catch (e) {
    console.error('[equipeService] falha ao reverter usuário do Auth', { id, error: e.message });
  }
}

// Cria o usuário (Auth + perfil) e faz rollback se o perfil falhar.
async function criarUsuario(tenantId, { nome, email, senha, papelConta, cargo, liderId }) {
  const emailNorm = email.trim().toLowerCase();
  const authUser = await criarAuthUser(emailNorm, senha);
  try {
    return await usersRepository.create({
      id: authUser.id,
      tenantId,
      email: emailNorm,
      nome: nome.trim(),
      role: 'corretor', // eixo de plataforma: todo usuário de conta é 'corretor'
      status: 'ativo',
      papelConta,
      cargo: cargo || null,
      liderId: liderId || null,
      ativo: true,
    });
  } catch (e) {
    await removerAuthUser(authUser.id);
    console.error('[equipeService.criarUsuario] falhou', { tenant_id: tenantId, error: e.message });
    throw new ValidationError('Não foi possível concluir o cadastro do usuário.');
  }
}

async function validarLider(tenantId, liderId) {
  if (!liderId) return;
  const lider = await usersRepository.findByIdInTenant(tenantId, liderId);
  if (!lider) throw new ValidationError('Líder informado não pertence a esta conta.');
  if (!['lider', 'gerente'].includes(lider.cargo)) {
    throw new ValidationError('O usuário indicado como líder precisa ter cargo de Líder ou Gerente.');
  }
}

async function criarCorretor(tenantId, input) {
  validarNovo(input);
  const cargo = input.cargo || 'vendedor';
  if (!CARGOS.includes(cargo)) {
    throw new ValidationError(`cargo inválido. Valores aceitos: ${CARGOS.join(', ')}.`);
  }
  if (cargo === 'vendedor') await validarLider(tenantId, input.lider_id);
  return criarUsuario(tenantId, {
    nome: input.nome,
    email: input.email,
    senha: input.senha,
    papelConta: 'corretor',
    cargo,
    liderId: cargo === 'vendedor' ? input.lider_id : null,
  });
}

async function criarSecretaria(tenantId, input) {
  validarNovo(input);
  return criarUsuario(tenantId, {
    nome: input.nome,
    email: input.email,
    senha: input.senha,
    papelConta: 'secretaria',
    cargo: null,
    liderId: null,
  });
}

async function listar(tenantId) {
  return usersRepository.listByTenant(tenantId);
}

async function contarAdmins(tenantId) {
  const todos = await usersRepository.listByTenant(tenantId);
  return todos.filter((u) => u.papel_conta === 'administrador' && u.ativo).length;
}

async function editar(tenantId, id, input) {
  const alvo = await usersRepository.findByIdInTenant(tenantId, id);
  if (!alvo) throw new NotFoundError('Usuário não encontrado.');

  const patch = {};
  if (input.nome !== undefined) {
    if (!input.nome || input.nome.trim().length < 3) throw new ValidationError('Nome inválido.');
    patch.nome = input.nome.trim();
  }
  if (input.papel_conta !== undefined) {
    if (!['administrador', 'corretor', 'secretaria'].includes(input.papel_conta)) {
      throw new ValidationError('papel_conta inválido.');
    }
    // Não deixar a conta ficar sem administrador.
    if (alvo.papel_conta === 'administrador' && input.papel_conta !== 'administrador') {
      if ((await contarAdmins(tenantId)) <= 1) {
        throw new ValidationError('A conta precisa ter ao menos um administrador.');
      }
    }
    patch.papel_conta = input.papel_conta;
  }
  if (input.cargo !== undefined) {
    if (input.cargo !== null && !CARGOS.includes(input.cargo)) throw new ValidationError('cargo inválido.');
    patch.cargo = input.cargo;
  }
  if (input.lider_id !== undefined) {
    if (input.lider_id === id) throw new ValidationError('Um usuário não pode ser líder de si mesmo.');
    if (input.lider_id) await validarLider(tenantId, input.lider_id);
    patch.lider_id = input.lider_id || null;
  }
  if (input.ativo !== undefined) patch.ativo = !!input.ativo;

  const atualizado = await usersRepository.updateConta(tenantId, id, patch);
  if (!atualizado) throw new NotFoundError('Usuário não encontrado.');
  return atualizado;
}

// Desativa um usuário (não apaga dados) e, opcionalmente, transfere a carteira.
async function desativar(tenantId, id, { transferirParaId } = {}, solicitanteId) {
  const alvo = await usersRepository.findByIdInTenant(tenantId, id);
  if (!alvo) throw new NotFoundError('Usuário não encontrado.');
  if (id === solicitanteId) throw new ValidationError('Você não pode desativar a si mesmo.');
  if (alvo.papel_conta === 'administrador' && (await contarAdmins(tenantId)) <= 1) {
    throw new ValidationError('A conta precisa ter ao menos um administrador ativo.');
  }

  if (transferirParaId) {
    if (transferirParaId === id) throw new ValidationError('Escolha outro usuário para receber a carteira.');
    const destino = await usersRepository.findByIdInTenant(tenantId, transferirParaId);
    if (!destino || destino.ativo === false) {
      throw new ValidationError('Usuário de destino da carteira inválido ou inativo.');
    }
    await leadsRepository.reassignDono(tenantId, id, transferirParaId);
    await vendasRepository.reassignVendedor(tenantId, id, transferirParaId);
    await compromissosRepository.reassignUsuario(tenantId, id, transferirParaId);
  }

  const atualizado = await usersRepository.updateConta(tenantId, id, { ativo: false });
  if (!atualizado) throw new NotFoundError('Usuário não encontrado.');
  return { ...atualizado, carteira_transferida_para: transferirParaId || null };
}

module.exports = {
  criarCorretor,
  criarSecretaria,
  listar,
  editar,
  desativar,
  ValidationError,
  NotFoundError,
};
