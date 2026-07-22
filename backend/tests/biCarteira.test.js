// Testes do BI de Carteira (Fase 3): snapshot, merge, finalização e insights.
// Puros (sem banco), no estilo de carteira.test.js. Rodar: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  faixaHealth,
  probabilidadeChurn,
  segmentoChurn,
  snapshotDeCorretor,
  mergeSnapshots,
  finalizar,
} = require('../src/services/biCarteiraMetrics');
const insights = require('../src/services/biInsightsService');

const HOJE = '2026-07-21';

// Dataset conhecido: 1 corretor, 3 apólices ativas (uma vencida/risco), com
// comissões projetadas, para bater com cálculo manual.
function datasetBase() {
  return {
    apolices: [
      { id: 'a1', cliente_id: 'c1', produto_id: 'p1', corretor_id: 'v1', venda_id: 's1', valor: 1000, status: 'ativa', data_inicio: '2026-07-01', data_vencimento: '2026-08-10', health_score: 80 },
      { id: 'a2', cliente_id: 'c2', produto_id: 'p1', corretor_id: 'v1', venda_id: 's2', valor: 2000, status: 'ativa', data_inicio: '2026-06-01', data_vencimento: '2026-07-25', health_score: 30 },
      { id: 'a3', cliente_id: 'c3', produto_id: 'p2', corretor_id: 'v1', venda_id: 's3', valor: 500, status: 'ativa', data_inicio: '2026-05-01', data_vencimento: '2027-01-01', health_score: 60 },
    ],
    clientes: [
      { id: 'c1', nome: 'Ana', nps: 10, health_score: 80 },
      { id: 'c2', nome: 'Bruno', nps: 4, health_score: 30 },
      { id: 'c3', nome: 'Carla', nps: null, health_score: 60 },
    ],
    comissoes: [
      { venda_id: 's1', valor_parcela: 200, status: 'projetada' },
      { venda_id: 's2', valor_parcela: 400, status: 'projetada' },
      { venda_id: 's3', valor_parcela: 100, status: 'projetada' },
    ],
    produtos: [
      { id: 'p1', categoria: 'seguro', percentual: 20, ativo: true },
      { id: 'p2', categoria: 'saude', percentual: 5, ativo: true },
    ],
    // c1 teve contato hoje (sai do risco por vencimento); c2/c3 sem contato.
    interacaoRecentePorCliente: { c1: HOJE },
    de: '2000-01-01', ate: HOJE, hoje: HOJE,
  };
}

test('faixaHealth classifica pelas faixas do brief', () => {
  assert.equal(faixaHealth(85), 'saudavel');
  assert.equal(faixaHealth(55), 'atencao');
  assert.equal(faixaHealth(20), 'risco');
});

test('probabilidadeChurn: health baixo + vencido => alto; health alto + longe => baixo', () => {
  assert.ok(probabilidadeChurn(20, -5) > 0.7, 'risco alto esperado');
  assert.equal(segmentoChurn(probabilidadeChurn(20, -5)), 'alto');
  assert.ok(probabilidadeChurn(90, 120) < 0.4, 'risco baixo esperado');
  assert.equal(segmentoChurn(probabilidadeChurn(90, 120)), 'baixo');
});

test('snapshot: distribuição de health, receita por categoria e receita garantida/risco', () => {
  const s = snapshotDeCorretor(datasetBase());
  // health: a1=80 saudável, a2=30 risco, a3=60 atenção
  assert.deepEqual(s.health_distribuicao, { saudavel: 1, atencao: 1, risco: 1 });
  // categoria: seguro = 1000+2000, saude = 500
  assert.equal(s.receita_por_categoria.seguro, 3000);
  assert.equal(s.receita_por_categoria.saude, 500);
  // garantida = prevista de apólices health>=70 => só a1 (200)
  assert.equal(s.cards.receita_garantida, 200);
  // risco = a2 (health<40 => 400). a1 saudável não; a3 health 60 e vence longe => não.
  assert.equal(s.cards.receita_risco, 400);
});

test('snapshot: projeção de renovações por janela de dias', () => {
  const s = snapshotDeCorretor(datasetBase());
  // a2 vence 2026-07-25 (4d => 0-30), a1 2026-08-10 (20d => 0-30), a3 longe.
  assert.equal(s.projecao_renovacoes.j0_30.qtd, 2);
  assert.equal(s.projecao_renovacoes.j0_30.valor, 600); // 400 + 200
  assert.equal(s.cards.vencimentos_30d, 2);
});

test('finalizar recalcula as 7 métricas e monta os cards de topo', () => {
  const s = snapshotDeCorretor(datasetBase());
  const p = finalizar(mergeSnapshots([s]), HOJE);
  assert.equal(p.base.clientes_ativos, 3);
  assert.equal(p.base.apolices_ativas, 3);
  // NPS: promotores(10)=1, detratores(4)=1, neutro nulo ignorado => (1-1)/2*100 = 0
  assert.equal(p.cards.nps, 0);
  assert.equal(p.cards.receita_garantida, 200);
  assert.ok(p.cards.score_saude != null);
});

test('merge soma dois corretores (base, cards e distribuição)', () => {
  const s1 = snapshotDeCorretor(datasetBase());
  const s2 = snapshotDeCorretor(datasetBase());
  const m = mergeSnapshots([s1, s2]);
  assert.equal(m.cards.receita_garantida, 400); // 200 + 200
  assert.equal(m.health_distribuicao.saudavel, 2);
  assert.equal(m.base.apolicesAtivas, 6);
});

test('estado vazio: sem snapshots, finalizar não quebra e zera os cards', () => {
  const p = finalizar(mergeSnapshots([]), HOJE);
  assert.equal(p.base.apolices_ativas, 0);
  assert.equal(p.cards.receita_garantida, 0);
  assert.equal(p.metricas.score_geral, null);
});

test('insights: cada insight gerado tem CTA (regra "sem ação é decoração")', () => {
  const s = snapshotDeCorretor(datasetBase());
  const p = finalizar(mergeSnapshots([s]), HOJE);
  const lista = insights.gerar(p);
  assert.ok(lista.length > 0, 'esperava ao menos um insight neste dataset');
  for (const i of lista) {
    assert.ok(i.cta && i.cta.label && i.cta.acao, `insight ${i.id} sem CTA`);
    assert.ok(i.texto && i.texto.length > 0);
  }
});

test('insights: vencimentos em risco disparam alerta com valor', () => {
  const s = snapshotDeCorretor(datasetBase());
  const p = finalizar(mergeSnapshots([s]), HOJE);
  const venc = insights.gerar(p).find((i) => i.id === 'vencimentos_risco');
  assert.ok(venc, 'esperava insight de vencimentos em risco');
  assert.equal(venc.severidade, 'alerta');
  assert.equal(venc.cta.acao, 'vencimentos');
});

test('cross-sell: cliente sem o 2º produto entra no ranking', () => {
  const s = snapshotDeCorretor(datasetBase());
  // c1 e c2 têm p1 (falta p2); c3 tem p2 (falta p1) => todos têm 1 faltante.
  assert.ok(s.crosssell.length >= 1);
  for (const item of s.crosssell) assert.equal(item.faltam, 1);
});
