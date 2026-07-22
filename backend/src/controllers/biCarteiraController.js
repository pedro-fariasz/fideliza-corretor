const biCarteiraService = require('../services/biCarteiraService');
const usersRepository = require('../repositories/usersRepository');
const { resolverDonoIds } = require('../services/escopoService');

async function painel(req, res, next) {
  try {
    const filtros = {
      periodo: req.query.periodo ? String(req.query.periodo) : undefined,
      escopo: req.query.escopo ? String(req.query.escopo) : undefined,
      corretor_id: req.query.corretor_id ? String(req.query.corretor_id) : undefined,
    };
    return res.json(await biCarteiraService.obter(req.tenantId, filtros, req.user));
  } catch (err) {
    return next(err);
  }
}

// Corretores que o usuário pode filtrar (dentro do seu escopo). Alimenta o
// seletor "Corretor específico" da tela de BI.
async function corretores(req, res, next) {
  try {
    const perm = await resolverDonoIds(req.user, 'bi_carteira', 'ler'); // null|[]|[ids]
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

module.exports = { painel, corretores };
