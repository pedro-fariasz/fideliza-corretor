// Testes do cancelamento de cliente da carteira (POST /api/carteira/:id/cancelar).
// Repositories são monkeypatchados (sem tocar no banco), mesmo estilo de escopo.test.js.
// Rodar: npm test
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const carteiraService = require('../src/services/carteiraService');
const carteiraClientesRepository = require('../src/repositories/carteiraClientesRepository');
const leadsRepository = require('../src/repositories/leadsRepository');
const tagsRepository = require('../src/repositories/tagsRepository');
const leadTagsRepository = require('../src/repositories/leadTagsRepository');
const atividadesRepository = require('../src/repositories/atividadesRepository');

const TENANT_ID = 't1';
const OUTRO_TENANT_ID = 't2';

const CLIENTE = { id: 'cliente1', tenant_id: TENANT_ID, nome: 'Ciclana', telefone: '11988887777', email: 'ciclana@example.com' };

function mockRepositorios() {
  const originais = {
    carteiraFindById: carteiraClientesRepository.findById,
    carteiraUpdate: carteiraClientesRepository.update,
    leadsCreate: leadsRepository.create,
    tagsFindByNome: tagsRepository.findByNome,
    tagsCreate: tagsRepository.create,
    leadTagsAplicar: leadTagsRepository.aplicar,
    atividadesCreate: atividadesRepository.create,
  };

  const chamadas = {
    carteiraUpdate: [],
    leadsCreate: [],
    tagsCreate: [],
    leadTagsAplicar: [],
    atividadesCreate: [],
  };

  carteiraClientesRepository.findById = async (tenantId, id) =>
    tenantId === TENANT_ID && id === CLIENTE.id ? CLIENTE : null;
  carteiraClientesRepository.update = async (tenantId, id, patch) => {
    chamadas.carteiraUpdate.push({ tenantId, id, patch });
    return { ...CLIENTE, ...patch };
  };
  leadsRepository.create = async (tenantId, payload) => {
    const lead = { id: `leadfrio${chamadas.leadsCreate.length + 1}`, tenant_id: tenantId, ...payload };
    chamadas.leadsCreate.push({ tenantId, payload, lead });
    return lead;
  };
  tagsRepository.findByNome = async () => null; // tag "risco" ainda não existe
  tagsRepository.create = async (tenantId, payload) => {
    const tag = { id: 'tag-risco', tenant_id: tenantId, ...payload };
    chamadas.tagsCreate.push({ tenantId, payload });
    return tag;
  };
  leadTagsRepository.aplicar = async (tenantId, leadId, tagId) => {
    chamadas.leadTagsAplicar.push({ tenantId, leadId, tagId });
    return [{ tenant_id: tenantId, lead_id: leadId, tag_id: tagId }];
  };
  atividadesRepository.create = async (tenantId, payload) => {
    chamadas.atividadesCreate.push({ tenantId, payload });
    return { id: `atividade${chamadas.atividadesCreate.length}`, tenant_id: tenantId, ...payload };
  };

  const restaurar = () => {
    carteiraClientesRepository.findById = originais.carteiraFindById;
    carteiraClientesRepository.update = originais.carteiraUpdate;
    leadsRepository.create = originais.leadsCreate;
    tagsRepository.findByNome = originais.tagsFindByNome;
    tagsRepository.create = originais.tagsCreate;
    leadTagsRepository.aplicar = originais.leadTagsAplicar;
    atividadesRepository.create = originais.atividadesCreate;
  };

  return { chamadas, restaurar };
}

test('cenário A (financeiro) — cancela e agenda tentar_recuperar_em em +60 dias', async () => {
  const { chamadas, restaurar } = mockRepositorios();
  try {
    const resultado = await carteiraService.cancelarCliente(
      TENANT_ID,
      CLIENTE.id,
      { motivo_cancelamento: 'financeiro', observacao: 'atrasou 3 boletos' },
      { id: 'user1' }
    );

    assert.deepEqual(resultado, { ok: true, cliente_id: CLIENTE.id, cenario: 'A' });

    assert.equal(chamadas.carteiraUpdate.length, 1);
    const { patch } = chamadas.carteiraUpdate[0];
    assert.equal(patch.motivo_cancelamento, 'financeiro');
    assert.equal(patch.status, 'cancelado');
    assert.ok(patch.tentar_recuperar_em);
    assert.equal(patch.tentar_recuperar_em > new Date().toISOString().slice(0, 10), true);

    assert.equal(chamadas.leadsCreate.length, 0); // nenhum lead novo neste cenário
    assert.equal(chamadas.atividadesCreate.length, 1);
    assert.equal(chamadas.atividadesCreate[0].payload.acao, 'cliente_cancelado_recuperavel');
  } finally {
    restaurar();
  }
});

test('cenário B (trocou_corretor) — cria lead frio com tag "risco" e sem retomada', async () => {
  const { chamadas, restaurar } = mockRepositorios();
  try {
    const resultado = await carteiraService.cancelarCliente(
      TENANT_ID,
      CLIENTE.id,
      { motivo_cancelamento: 'trocou_corretor' },
      { id: 'user1' }
    );

    assert.equal(resultado.ok, true);
    assert.equal(resultado.cenario, 'B');
    assert.ok(resultado.novo_lead_id);

    const { patch } = chamadas.carteiraUpdate[0];
    assert.equal(patch.status, 'cancelado');
    assert.equal(patch.tentar_recuperar_em, null);

    assert.equal(chamadas.leadsCreate.length, 1);
    const leadPayload = chamadas.leadsCreate[0].payload;
    assert.equal(leadPayload.origem_canal, 'indicacao');
    assert.equal(leadPayload.indicado_por_cliente_id, CLIENTE.id);
    assert.equal(leadPayload.estagio, 'prospectos');
    assert.match(leadPayload.observacoes, /trocou_corretor/);

    assert.equal(chamadas.tagsCreate.length, 1);
    assert.equal(chamadas.tagsCreate[0].payload.nome, 'risco');
    assert.equal(chamadas.leadTagsAplicar.length, 1);
    assert.equal(chamadas.leadTagsAplicar[0].leadId, resultado.novo_lead_id);

    assert.equal(chamadas.atividadesCreate[0].payload.acao, 'cliente_virou_lead_frio');
    assert.equal(chamadas.atividadesCreate[0].payload.detalhes.novo_lead_id, resultado.novo_lead_id);
  } finally {
    restaurar();
  }
});

test('cenário C (falecimento) — cancela sem gerar lead nem alerta de retomada', async () => {
  const { chamadas, restaurar } = mockRepositorios();
  try {
    const resultado = await carteiraService.cancelarCliente(
      TENANT_ID,
      CLIENTE.id,
      { motivo_cancelamento: 'falecimento' },
      { id: 'user1' }
    );

    assert.deepEqual(resultado, { ok: true, cliente_id: CLIENTE.id, cenario: 'C' });

    const { patch } = chamadas.carteiraUpdate[0];
    assert.equal(patch.motivo_cancelamento, 'falecimento');
    assert.equal(patch.status, 'cancelado');
    assert.equal(patch.tentar_recuperar_em, null);

    assert.equal(chamadas.leadsCreate.length, 0);
    assert.equal(chamadas.atividadesCreate[0].payload.acao, 'cliente_falecimento');
  } finally {
    restaurar();
  }
});

test('motivo_cancelamento inválido lança ValidationError (400)', async () => {
  const { restaurar } = mockRepositorios();
  try {
    await assert.rejects(
      () => carteiraService.cancelarCliente(TENANT_ID, CLIENTE.id, { motivo_cancelamento: 'nao_existe' }, { id: 'user1' }),
      (err) => {
        assert.equal(err.name, 'ValidationError');
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  } finally {
    restaurar();
  }
});

test('isolamento de tenant: não cancela cliente de outro tenant (404)', async () => {
  const { chamadas, restaurar } = mockRepositorios();
  try {
    await assert.rejects(
      () =>
        carteiraService.cancelarCliente(OUTRO_TENANT_ID, CLIENTE.id, { motivo_cancelamento: 'financeiro' }, { id: 'user2' }),
      (err) => {
        assert.equal(err.name, 'NotFoundError');
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
    assert.equal(chamadas.carteiraUpdate.length, 0);
  } finally {
    restaurar();
  }
});
