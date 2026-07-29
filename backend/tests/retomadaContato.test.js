// Testes do job de retomada de contato (POST /api/jobs/retomada-contato).
// Repositories são monkeypatchados (sem tocar no banco), mesmo estilo de escopo.test.js.
// Rodar: npm test
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const carteiraService = require('../src/services/carteiraService');
const carteiraClientesRepository = require('../src/repositories/carteiraClientesRepository');
const usersRepository = require('../src/repositories/usersRepository');
const compromissosRepository = require('../src/repositories/compromissosRepository');
const atividadesRepository = require('../src/repositories/atividadesRepository');

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

const CLIENTES_POR_TENANT = {
  [TENANT_A]: [
    { id: 'cliA1', nome: 'Cliente A1', motivo_cancelamento: 'financeiro' },
    { id: 'cliA2', nome: 'Cliente A2', motivo_cancelamento: 'insatisfacao' },
  ],
  [TENANT_B]: [{ id: 'cliB1', nome: 'Cliente B1', motivo_cancelamento: 'outro' }],
};

function mockRepositorios() {
  const originais = {
    listParaRetomada: carteiraClientesRepository.listParaRetomada,
    update: carteiraClientesRepository.update,
    findCorretorDoTenant: usersRepository.findCorretorDoTenant,
    compromissosCreate: compromissosRepository.create,
    atividadesCreate: atividadesRepository.create,
  };

  const chamadas = { update: [], compromissosCreate: [], atividadesCreate: [] };

  carteiraClientesRepository.listParaRetomada = async (tenantId) => CLIENTES_POR_TENANT[tenantId] || [];
  carteiraClientesRepository.update = async (tenantId, id, patch) => {
    chamadas.update.push({ tenantId, id, patch });
    return { id, tenant_id: tenantId, ...patch };
  };
  usersRepository.findCorretorDoTenant = async (tenantId) => ({ id: `dono-${tenantId}`, tenant_id: tenantId, role: 'corretor' });
  compromissosRepository.create = async (tenantId, payload) => {
    chamadas.compromissosCreate.push({ tenantId, payload });
    return { id: `compromisso${chamadas.compromissosCreate.length}`, tenant_id: tenantId, ...payload };
  };
  atividadesRepository.create = async (tenantId, payload) => {
    chamadas.atividadesCreate.push({ tenantId, payload });
    return { id: `atividade${chamadas.atividadesCreate.length}`, tenant_id: tenantId, ...payload };
  };

  const restaurar = () => {
    carteiraClientesRepository.listParaRetomada = originais.listParaRetomada;
    carteiraClientesRepository.update = originais.update;
    usersRepository.findCorretorDoTenant = originais.findCorretorDoTenant;
    compromissosRepository.create = originais.compromissosCreate;
    atividadesRepository.create = originais.atividadesCreate;
  };

  return { chamadas, restaurar };
}

test('cria um compromisso por cliente vencido e retorna { processados: N }', async () => {
  const { chamadas, restaurar } = mockRepositorios();
  try {
    const resultado = await carteiraService.retomarContatos(TENANT_A);

    assert.deepEqual(resultado, { processados: 2 });
    assert.equal(chamadas.compromissosCreate.length, 2);
    assert.equal(chamadas.compromissosCreate[0].payload.usuario_id, `dono-${TENANT_A}`);
    assert.equal(chamadas.compromissosCreate[0].payload.origem, 'sistema_retomada');
    assert.match(chamadas.compromissosCreate[0].payload.titulo, /Retomar contato com Cliente A1/);
  } finally {
    restaurar();
  }
});

test('zera tentar_recuperar_em de cada cliente processado', async () => {
  const { chamadas, restaurar } = mockRepositorios();
  try {
    await carteiraService.retomarContatos(TENANT_A);

    assert.equal(chamadas.update.length, 2);
    for (const { patch } of chamadas.update) {
      assert.equal(patch.tentar_recuperar_em, null);
    }
  } finally {
    restaurar();
  }
});

test('registra atividades acao=retomada_agendada por cliente', async () => {
  const { chamadas, restaurar } = mockRepositorios();
  try {
    await carteiraService.retomarContatos(TENANT_A);

    assert.equal(chamadas.atividadesCreate.length, 2);
    for (const { payload } of chamadas.atividadesCreate) {
      assert.equal(payload.entidade, 'cliente');
      assert.equal(payload.acao, 'retomada_agendada');
    }
  } finally {
    restaurar();
  }
});

test('processa cada tenant isoladamente — não mistura clientes de outro tenant no lote', async () => {
  const { chamadas, restaurar } = mockRepositorios();
  try {
    await carteiraService.retomarContatos(TENANT_B);

    assert.equal(chamadas.compromissosCreate.length, 1);
    assert.equal(chamadas.compromissosCreate[0].tenantId, TENANT_B);
    assert.match(chamadas.compromissosCreate[0].payload.titulo, /Cliente B1/);
    assert.equal(chamadas.update[0].tenantId, TENANT_B);
  } finally {
    restaurar();
  }
});

test('nenhum cliente vencido => processados: 0, sem tocar compromissos/atividades', async () => {
  const { chamadas, restaurar } = mockRepositorios();
  try {
    const resultado = await carteiraService.retomarContatos('tenant-sem-pendencia');

    assert.deepEqual(resultado, { processados: 0 });
    assert.equal(chamadas.compromissosCreate.length, 0);
    assert.equal(chamadas.atividadesCreate.length, 0);
  } finally {
    restaurar();
  }
});
