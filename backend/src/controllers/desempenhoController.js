const desempenhoService = require('../services/desempenhoService');
const usersRepository = require('../repositories/usersRepository');
const { resolverDonoIds } = require('../services/escopoService');

async function painel(req, res, next) {
  try {
    const filtros = {
      periodo: req.query.periodo ? String(req.query.periodo) : undefined,
      vendedor_id: req.query.vendedor_id ? String(req.query.vendedor_id) : undefined,
    };
    return res.json(await desempenhoService.obter(req.tenantId, filtros, req.user));
  } catch (err) {
    return next(err);
  }
}

// Vendedores que o usuário pode filtrar (dentro do seu escopo).
async function vendedores(req, res, next) {
  try {
    const perm = await resolverDonoIds(req.user, 'desempenho', 'ler'); // null|[]|[ids]
    const users = await usersRepository.listByTenant(req.tenantId);
    const lista = users
      .filter((u) => u.ativo !== false && (u.papel_conta === 'corretor' || u.papel_conta === 'administrador'))
      .filter((u) => perm === null || (Array.isArray(perm) && perm.includes(u.id)))
      .map((u) => ({ id: u.id, nome: u.nome || u.email }));
    return res.json(lista);
  } catch (err) {
    return next(err);
  }
}

module.exports = { painel, vendedores };
