// Testes das métricas de carteira e health score (Fase 1). Rodar: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  classificarVencimento,
  pipelineContadores,
  calcularMetricas,
  faixaScore,
  calcularHealthScore,
} = require('../src/services/carteiraMetricsService');

const HOJE = '2026-07-21';

test('classificarVencimento distribui pela distância até o vencimento', () => {
  assert.equal(classificarVencimento({ status: 'ativa', data_vencimento: '2026-07-10' }, HOJE), 'vencida');
  assert.equal(classificarVencimento({ status: 'ativa', data_vencimento: '2026-07-30' }, HOJE), 'urgente'); // 9d
  assert.equal(classificarVencimento({ status: 'ativa', data_vencimento: '2026-08-20' }, HOJE), 'atencao'); // 30d
  assert.equal(classificarVencimento({ status: 'ativa', data_vencimento: '2026-12-01' }, HOJE), 'em_dia');
  assert.equal(classificarVencimento({ status: 'cancelada', data_vencimento: '2026-12-01' }, HOJE), 'cancelada');
});

test('pipelineContadores soma por coluna', () => {
  const apolices = [
    { status: 'ativa', data_vencimento: '2026-07-10' }, // vencida
    { status: 'ativa', data_vencimento: '2026-07-25' }, // urgente
    { status: 'ativa', data_vencimento: '2026-08-15' }, // atencao
    { status: 'ativa', data_vencimento: '2027-01-01' }, // em_dia
    { status: 'cancelada', data_vencimento: '2026-01-01' },
  ];
  const c = pipelineContadores(apolices, HOJE);
  assert.equal(c.total, 5);
  assert.equal(c.vencidas, 1);
  assert.equal(c.urgentes, 1);
  assert.equal(c.em_atencao, 1);
  assert.equal(c.em_dia, 1);
  assert.equal(c.canceladas, 1);
});

test('calcularMetricas — dataset conhecido bate com cálculo manual', () => {
  const m = calcularMetricas({
    vencidasNoPeriodo: 10,
    renovadasNoPeriodo: 8, // TRC 80%
    clientesAtivos: 10,
    clientesAtivosInicioPeriodo: 10,
    clientesCanceladosNoPeriodo: 1, // TCC 10%
    npsList: [10, 10, 9, 5, 0], // prom 3, detr 2 => 20
    comissaoTotal: 5000, // RPC 500
    apolicesAtivas: 18, // PPC 1.8
    ltvPorCliente: [2000, 2000], // LTV 2000
    tmrDias: 0,
  });
  assert.equal(m.trc, 80);
  assert.equal(m.nps, 20);
  assert.equal(m.ppc, 1.8);
  assert.equal(m.tcc, 10);
  assert.equal(m.rpc, 500);
  assert.equal(m.ltv, 2000);
  assert.equal(m.tmr, 0);
  assert.equal(m.score_geral, 90);
  assert.equal(faixaScore(m.score_geral), 'verde');
});

test('NPS sem dados não zera o score (re-normaliza os pesos)', () => {
  const m = calcularMetricas({
    vencidasNoPeriodo: 10,
    renovadasNoPeriodo: 8,
    clientesAtivos: 10,
    clientesAtivosInicioPeriodo: 10,
    clientesCanceladosNoPeriodo: 1,
    npsList: [], // sem NPS
    comissaoTotal: 5000,
    apolicesAtivas: 18,
    ltvPorCliente: [2000, 2000],
    tmrDias: 0,
  });
  assert.equal(m.nps, null);
  assert.equal(m.score_geral, 98); // maior que 90: o peso do NPS (baixo) saiu da conta
});

test('métricas sem base retornam null (estado vazio), score null', () => {
  const m = calcularMetricas({});
  assert.equal(m.trc, null);
  assert.equal(m.score_geral, null);
  assert.equal(faixaScore(m.score_geral), 'sem_dados');
});

test('health score — cliente saudável ~100', () => {
  const h = calcularHealthScore({ diasAteVencimento: 60, numRenovacoes: 3, numProdutos: 2, nps: 10, interacoes90d: 5 });
  assert.equal(h.score, 100);
  assert.equal(h.faixa, 'saudavel');
});

test('health score — cliente em risco (<40)', () => {
  const h = calcularHealthScore({ diasAteVencimento: 0, numRenovacoes: 0, numProdutos: 1, nps: null, interacoes90d: 0 });
  assert.ok(h.score < 40, `esperado <40, veio ${h.score}`);
  assert.equal(h.faixa, 'risco');
});
