// =============================================================================
// escopoService — resolve o ESCOPO HIERÁRQUICO de dados dentro do tenant.
// Traduz o nível da matriz de permissões numa lista de dono_ids que o usuário
// pode enxergar (ou null quando pode ver tudo do tenant).
//
// Uso nos services: const donoIds = await resolverDonoIds(user, 'leads');
//   -> repo.list(tenantId, { ...filtros, donoIds })  (repo aplica .in(coluna, ids))
// =============================================================================
const usersRepository = require('../repositories/usersRepository');
const { escopoDe } = require('../config/permissoes');

// null  => sem filtro de dono (vê tudo do tenant)
// []    => não vê nada (defensivo; o requirePermissao já barra 'none')
// [ids] => vê só esses donos
async function resolverDonoIds(user, recurso, acao = 'ler') {
  const nivel = escopoDe(user, recurso, acao);
  if (nivel === 'none') return [];
  if (nivel === 'all' || nivel === 'all_sem_valor') return null;
  if (nivel === 'own') return [user.id];
  if (nivel === 'scope') {
    // líder: os próprios + subordinados diretos (lider_id = user.id).
    const subs = await usersRepository.listSubordinadoIds(user.tenantId, user.id);
    return Array.from(new Set([user.id, ...subs]));
  }
  return [user.id];
}

// O usuário pode acessar um registro cujo dono é `donoId`?
// donoIds === null significa "vê tudo" (sem restrição de dono).
function donoPermitido(donoIds, donoId) {
  if (donoIds === null) return true;
  return Array.isArray(donoIds) && donoIds.includes(donoId);
}

module.exports = { resolverDonoIds, donoPermitido };
