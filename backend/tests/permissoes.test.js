// Testes da matriz de permissões (Fase 0). Rodar: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { perfilEfetivo, pode, escopoDe, podeVerValores } = require('../src/config/permissoes');

const admin = { papel_conta: 'administrador' };
const gerente = { papel_conta: 'corretor', cargo: 'gerente' };
const lider = { papel_conta: 'corretor', cargo: 'lider' };
const vendedor = { papel_conta: 'corretor', cargo: 'vendedor' };
const secretaria = { papel_conta: 'secretaria' };

test('perfilEfetivo resolve papel_conta + cargo', () => {
  assert.equal(perfilEfetivo(admin), 'administrador');
  assert.equal(perfilEfetivo(gerente), 'gerente');
  assert.equal(perfilEfetivo(lider), 'lider');
  assert.equal(perfilEfetivo(vendedor), 'vendedor');
  assert.equal(perfilEfetivo(secretaria), 'secretaria');
  // corretor sem cargo cai em vendedor (mais restrito)
  assert.equal(perfilEfetivo({ papel_conta: 'corretor' }), 'vendedor');
});

test('escopo de leitura de leads por perfil', () => {
  assert.equal(escopoDe(admin, 'leads', 'ler'), 'all');
  assert.equal(escopoDe(gerente, 'leads', 'ler'), 'all');
  assert.equal(escopoDe(lider, 'leads', 'ler'), 'scope');
  assert.equal(escopoDe(vendedor, 'leads', 'ler'), 'own');
  assert.equal(escopoDe(secretaria, 'leads', 'ler'), 'all_sem_valor');
});

test('secretária: lê leads, mas nada financeiro e nenhum valor', () => {
  assert.equal(pode(secretaria, 'leads', 'ler'), true);
  assert.equal(pode(secretaria, 'leads', 'escrever'), false);
  assert.equal(pode(secretaria, 'vendas', 'ler'), false);
  assert.equal(pode(secretaria, 'comissoes', 'ler'), false);
  assert.equal(pode(secretaria, 'dashboard_financeiro', 'ler'), false);
  assert.equal(pode(secretaria, 'funil', 'ler'), false);
  assert.equal(pode(secretaria, 'agenda', 'escrever'), true); // agenda da equipe é ok
  assert.equal(podeVerValores(secretaria), false);
});

test('vendedor: só os próprios; sem produtos-escrita, sem usuários', () => {
  assert.equal(escopoDe(vendedor, 'vendas', 'ler'), 'own');
  assert.equal(escopoDe(vendedor, 'comissoes', 'ler'), 'own');
  assert.equal(pode(vendedor, 'produtos', 'escrever'), false);
  assert.equal(pode(vendedor, 'usuarios', 'ler'), false);
  assert.equal(pode(vendedor, 'assinatura', 'ler'), false);
  assert.equal(podeVerValores(vendedor), true);
});

test('líder: escopo (próprios + subordinados) nos recursos de dados', () => {
  assert.equal(escopoDe(lider, 'vendas', 'ler'), 'scope');
  assert.equal(escopoDe(lider, 'funil', 'escrever'), 'scope');
  assert.equal(pode(lider, 'produtos', 'escrever'), false); // líder não gere produtos
});

test('gerente: vê tudo da conta, mas não gere usuários nem assinatura', () => {
  assert.equal(escopoDe(gerente, 'vendas', 'ler'), 'all');
  assert.equal(pode(gerente, 'produtos', 'escrever'), true);
  assert.equal(pode(gerente, 'usuarios', 'ler'), false);
  assert.equal(pode(gerente, 'assinatura', 'ler'), false);
});

test('administrador: acesso total, incluindo usuários e assinatura', () => {
  assert.equal(pode(admin, 'usuarios', 'escrever'), true);
  assert.equal(pode(admin, 'assinatura', 'ler'), true);
  assert.equal(escopoDe(admin, 'vendas', 'ler'), 'all');
  assert.equal(pode(admin, 'produtos', 'escrever'), true);
});

test('recurso inexistente => sem acesso', () => {
  assert.equal(pode(admin, 'recurso_que_nao_existe', 'ler'), false);
  assert.equal(escopoDe(admin, 'recurso_que_nao_existe', 'ler'), 'none');
});
