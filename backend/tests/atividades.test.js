// Testes do feed de atividades (GET /api/atividades).
// - Repository: isolamento por tenant, filtros, limite e JOIN em users
//   (com um fake do supabase, mesmo espírito de "sem tocar no banco").
// - Service: sanitização de limit/entidade/datas.
// Rodar: npm test
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const supaMod = require('../src/config/supabase');
const atividadesRepository = require('../src/repositories/atividadesRepository');
const atividadesService = require('../src/services/atividadesService');

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000000';
const TENANT_B = 'bbbbbbbb-0000-0000-0000-000000000000';

// Linhas "no banco" dos dois tenants. `users` já embutido (simula o JOIN do PostgREST).
const ROWS = [
  { id: 'a1', tenant_id: TENANT_A, usuario_id: 'u1', users: { nome: 'Ana' }, entidade: 'lead', entidade_id: 'l1', acao: 'lead_criado', detalhes: {}, criado_em: '2026-07-20T10:00:00Z' },
  { id: 'a2', tenant_id: TENANT_A, usuario_id: null, users: null, entidade: 'sistema', entidade_id: null, acao: 'cron_rodou', detalhes: null, criado_em: '2026-07-21T10:00:00Z' },
  { id: 'a3', tenant_id: TENANT_A, usuario_id: 'u1', users: { nome: 'Ana' }, entidade: 'venda', entidade_id: 'v1', acao: 'venda_fechada', detalhes: {}, criado_em: '2026-07-19T10:00:00Z' },
  { id: 'b1', tenant_id: TENANT_B, usuario_id: 'u9', users: { nome: 'Bruno' }, entidade: 'lead', entidade_id: 'l9', acao: 'lead_criado', detalhes: {}, criado_em: '2026-07-22T10:00:00Z' },
];

// Fake do query builder do supabase: acumula filtros e só resolve no await,
// aplicando eq/gte/lte -> order -> limit (ordem de encadeamento não importa,
// como no PostgREST real).
function fakeFrom() {
  const ops = { eq: [], gte: [], lte: [], order: null, limit: null };
  const builder = {
    select() { return builder; },
    eq(col, val) { ops.eq.push([col, val]); return builder; },
    gte(col, val) { ops.gte.push([col, val]); return builder; },
    lte(col, val) { ops.lte.push([col, val]); return builder; },
    order(col, o) { ops.order = [col, o]; return builder; },
    limit(n) { ops.limit = n; return builder; },
    then(resolve) {
      let data = ROWS.slice();
      for (const [c, v] of ops.eq) data = data.filter((r) => r[c] === v);
      for (const [c, v] of ops.gte) data = data.filter((r) => String(r[c]) >= String(v));
      for (const [c, v] of ops.lte) data = data.filter((r) => String(r[c]) <= String(v));
      if (ops.order) {
        const [c, o] = ops.order;
        data.sort((a, b) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (o && o.ascending ? 1 : -1));
      }
      if (ops.limit != null) data = data.slice(0, ops.limit);
      resolve({ data, error: null });
    },
  };
  return builder;
}

function comFakeSupabase(fn) {
  const orig = supaMod.supabase.from;
  supaMod.supabase.from = () => fakeFrom();
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      supaMod.supabase.from = orig;
    });
}

test('repository.list: isolamento por tenant — tenant A não vê atividade do tenant B', async () => {
  await comFakeSupabase(async () => {
    const out = await atividadesRepository.list(TENANT_A, { limit: 50 });
    const ids = out.map((a) => a.id);
    assert.deepEqual(ids.sort(), ['a1', 'a2', 'a3']);
    assert.ok(!ids.includes('b1'), 'não pode vazar atividade do tenant B');

    const outB = await atividadesRepository.list(TENANT_B, { limit: 50 });
    assert.deepEqual(outB.map((a) => a.id), ['b1']);
  });
});

test('repository.list: ordena por criado_em DESC e resolve usuario_nome (JOIN)', async () => {
  await comFakeSupabase(async () => {
    const out = await atividadesRepository.list(TENANT_A, { limit: 50 });
    assert.deepEqual(out.map((a) => a.id), ['a2', 'a1', 'a3']); // 21 > 20 > 19
    assert.equal(out[0].usuario_nome, 'sistema'); // usuario_id null
    assert.equal(out[1].usuario_nome, 'Ana');
    // shape do retorno
    assert.deepEqual(Object.keys(out[1]).sort(), ['acao', 'criado_em', 'detalhes', 'entidade', 'entidade_id', 'id', 'usuario_id', 'usuario_nome'].sort());
  });
});

test('repository.list: filtro por entidade', async () => {
  await comFakeSupabase(async () => {
    const out = await atividadesRepository.list(TENANT_A, { entidade: 'venda', limit: 50 });
    assert.deepEqual(out.map((a) => a.id), ['a3']);
  });
});

test('repository.list: limite respeitado', async () => {
  await comFakeSupabase(async () => {
    const out = await atividadesRepository.list(TENANT_A, { limit: 1 });
    assert.equal(out.length, 1);
    assert.equal(out[0].id, 'a2'); // o mais recente
  });
});

test('repository.list: filtro de/ate sobre criado_em', async () => {
  await comFakeSupabase(async () => {
    const out = await atividadesRepository.list(TENANT_A, { de: '2026-07-20', limit: 50 });
    assert.deepEqual(out.map((a) => a.id).sort(), ['a1', 'a2']); // exclui a3 (07-19)
  });
});

test('service.listar: sanitiza limit (default 20, máx 100) e entidade inválida', async () => {
  const orig = atividadesRepository.list;
  const chamadas = [];
  atividadesRepository.list = async (tenantId, filtros) => {
    chamadas.push({ tenantId, filtros });
    return [];
  };
  try {
    await atividadesService.listar(TENANT_A, { limit: '999', entidade: 'hacker' });
    await atividadesService.listar(TENANT_A, { limit: 'abc' });
    await atividadesService.listar(TENANT_A, { limit: '5', entidade: 'venda', de: '2026-07-01', ate: 'nao-e-data' });

    assert.equal(chamadas[0].filtros.limit, 100); // clamp máximo
    assert.equal(chamadas[0].filtros.entidade, undefined); // entidade fora do CHECK cai fora
    assert.equal(chamadas[1].filtros.limit, 20); // default quando inválido
    assert.equal(chamadas[2].filtros.limit, 5);
    assert.equal(chamadas[2].filtros.entidade, 'venda');
    assert.equal(chamadas[2].filtros.de, '2026-07-01');
    assert.equal(chamadas[2].filtros.ate, undefined); // data inválida ignorada
  } finally {
    atividadesRepository.list = orig;
  }
});
