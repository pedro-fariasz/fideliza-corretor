// Testes do escopo hierárquico (Fase 0). Rodar: npm test
// usersRepository.listSubordinadoIds é monkeypatchado (sem tocar no banco).
// O client Supabase exige env no import — valores dummy bastam (não há chamada real).
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const usersRepository = require('../src/repositories/usersRepository');
const { resolverDonoIds, donoPermitido } = require('../src/services/escopoService');

const gerente = { id: 'g1', tenantId: 't1', papel_conta: 'corretor', cargo: 'gerente' };
const lider = { id: 'l1', tenantId: 't1', papel_conta: 'corretor', cargo: 'lider' };
const vendedor = { id: 'v1', tenantId: 't1', papel_conta: 'corretor', cargo: 'vendedor' };
const admin = { id: 'a1', tenantId: 't1', papel_conta: 'administrador' };
const secretaria = { id: 's1', tenantId: 't1', papel_conta: 'secretaria' };

test('administrador e gerente => null (vê tudo do tenant)', async () => {
  assert.equal(await resolverDonoIds(admin, 'leads', 'ler'), null);
  assert.equal(await resolverDonoIds(gerente, 'vendas', 'ler'), null);
});

test('vendedor => apenas o próprio id', async () => {
  assert.deepEqual(await resolverDonoIds(vendedor, 'leads', 'ler'), ['v1']);
  assert.deepEqual(await resolverDonoIds(vendedor, 'vendas', 'ler'), ['v1']);
});

test('líder => próprios + subordinados diretos', async () => {
  const original = usersRepository.listSubordinadoIds;
  usersRepository.listSubordinadoIds = async () => ['v1', 'v2'];
  try {
    const ids = await resolverDonoIds(lider, 'leads', 'ler');
    assert.deepEqual([...ids].sort(), ['l1', 'v1', 'v2']);
  } finally {
    usersRepository.listSubordinadoIds = original;
  }
});

test('secretária lendo leads (all_sem_valor) => null (sem filtro de dono)', async () => {
  assert.equal(await resolverDonoIds(secretaria, 'leads', 'ler'), null);
});

test('sem acesso (none) => [] (não vê nada)', async () => {
  // secretária não tem vendas
  assert.deepEqual(await resolverDonoIds(secretaria, 'vendas', 'ler'), []);
});

test('donoPermitido: null libera; array restringe', () => {
  assert.equal(donoPermitido(null, 'qualquer'), true);
  assert.equal(donoPermitido(['a', 'b'], 'a'), true);
  assert.equal(donoPermitido(['a', 'b'], 'c'), false);
  assert.equal(donoPermitido([], 'a'), false);
});
