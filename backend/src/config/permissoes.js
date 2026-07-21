// =============================================================================
// Matriz de permissões — FONTE DA VERDADE do controle de acesso (Fase 0).
// Checada SEMPRE no servidor. Esconder botão no front não é controle de acesso.
//
// Dois eixos, ortogonais:
//   * papel_conta: administrador | corretor | secretaria
//   * cargo (só p/ 'corretor'): vendedor | lider | gerente
//
// "Perfil efetivo" resolve os dois num rótulo só, que indexa a matriz:
//   administrador | gerente | lider | vendedor | secretaria
//
// Cada célula é um NÍVEL DE ESCOPO:
//   'all'            -> tudo do tenant
//   'scope'          -> próprios + subordinados (líder)
//   'own'            -> apenas os próprios
//   'all_sem_valor'  -> lê tudo, mas sem valores monetários (secretária)
//   'none'           -> sem acesso (403)
// =============================================================================

const PERFIS = ['administrador', 'gerente', 'lider', 'vendedor', 'secretaria'];

// Resolve o perfil efetivo a partir de papel_conta + cargo.
function perfilEfetivo(user) {
  if (!user) return 'none';
  if (user.papel_conta === 'secretaria') return 'secretaria';
  if (user.papel_conta === 'administrador') return 'administrador';
  // papel_conta === 'corretor' (ou legado sem papel): decide pelo cargo.
  if (user.cargo === 'gerente') return 'gerente';
  if (user.cargo === 'lider') return 'lider';
  return 'vendedor';
}

// helper p/ montar linhas da matriz sem repetição
const linha = (administrador, gerente, lider, vendedor, secretaria) => ({
  administrador,
  gerente,
  lider,
  vendedor,
  secretaria,
});

// recurso -> acao ('ler' | 'escrever') -> perfil -> nível de escopo
const MATRIZ = {
  dashboard_financeiro: {
    ler: linha('all', 'all', 'scope', 'own', 'none'),
  },
  leads: {
    ler: linha('all', 'all', 'scope', 'own', 'all_sem_valor'),
    escrever: linha('all', 'all', 'scope', 'own', 'none'),
  },
  funil: {
    ler: linha('all', 'all', 'scope', 'own', 'none'),
    escrever: linha('all', 'all', 'scope', 'own', 'none'),
  },
  vendas: {
    ler: linha('all', 'all', 'scope', 'own', 'none'),
    escrever: linha('all', 'all', 'scope', 'own', 'none'),
  },
  comissoes: {
    ler: linha('all', 'all', 'scope', 'own', 'none'),
    escrever: linha('all', 'all', 'scope', 'own', 'none'),
  },
  carteira: {
    ler: linha('all', 'all', 'scope', 'own', 'none'),
    escrever: linha('all', 'all', 'scope', 'own', 'none'),
  },
  posvendas: {
    ler: linha('all', 'all', 'scope', 'own', 'none'),
    escrever: linha('all', 'all', 'scope', 'own', 'none'),
  },
  bi_carteira: {
    ler: linha('all', 'all', 'scope', 'own', 'none'),
  },
  desempenho: {
    ler: linha('all', 'all', 'scope', 'own', 'none'),
  },
  agenda: {
    ler: linha('all', 'all', 'all', 'own', 'all'),
    escrever: linha('all', 'all', 'all', 'own', 'all'),
  },
  produtos: {
    ler: linha('all', 'all', 'none', 'none', 'none'),
    escrever: linha('all', 'all', 'none', 'none', 'none'),
  },
  usuarios: {
    ler: linha('all', 'none', 'none', 'none', 'none'),
    escrever: linha('all', 'none', 'none', 'none', 'none'),
  },
  assinatura: {
    ler: linha('all', 'none', 'none', 'none', 'none'),
    escrever: linha('all', 'none', 'none', 'none', 'none'),
  },
};

// Nível de escopo do usuário para (recurso, acao). 'none' se não existir.
function escopoDe(user, recurso, acao = 'ler') {
  const r = MATRIZ[recurso];
  if (!r || !r[acao]) return 'none';
  const perfil = perfilEfetivo(user);
  return r[acao][perfil] || 'none';
}

// Tem acesso? (qualquer nível diferente de 'none')
function pode(user, recurso, acao = 'ler') {
  return escopoDe(user, recurso, acao) !== 'none';
}

// A secretária nunca vê valores monetários.
function podeVerValores(user) {
  return perfilEfetivo(user) !== 'secretaria';
}

module.exports = {
  PERFIS,
  MATRIZ,
  perfilEfetivo,
  escopoDe,
  pode,
  podeVerValores,
};
