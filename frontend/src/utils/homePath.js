// Para onde mandar o usuário logado, conforme papel/status.
export function homePathFor(profile) {
  if (!profile) return '/login';
  if (profile.role === 'corretor') return '/';
  // funcionario / admin (equipe interna)
  if (profile.status !== 'ativo') return '/equipe/pendente';
  return '/equipe/painel';
}
