// Testes do Desempenho de Equipe (Fase 4): concentração, destaques, ranking,
// totais e série mensal. Puros (sem banco). Rodar: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  indiceConcentracao,
  destaques,
  totais,
  ranking,
  serieMensal,
} = require('../src/services/desempenhoMetrics');

const HOJE = '2026-07-21';

const vend = (nome, valor, extra = {}) => ({
  vendedor_id: nome, nome, vendas: extra.vendas ?? 1, valor,
  ticket_medio: extra.ticket_medio ?? valor, comissao_projetada: extra.comissao_projetada ?? 0,
  comissao_recebida: extra.comissao_recebida ?? 0, taxa_conversao: extra.taxa_conversao ?? 0,
  taxa_renovacao: extra.taxa_renovacao ?? 0,
});

test('índice de concentração com 1 vendedor = 100%', () => {
  assert.equal(indiceConcentracao([vend('A', 5000)]), 100);
});

test('índice de concentração com 3 vendedores = 100% (todos entram no top 3)', () => {
  const v = [vend('A', 3000), vend('B', 2000), vend('C', 1000)];
  assert.equal(indiceConcentracao(v), 100);
});

test('índice de concentração com 10 vendedores = top 3 ÷ total', () => {
  const v = [];
  for (let i = 1; i <= 10; i += 1) v.push(vend(`V${i}`, i * 100)); // 100..1000, total 5500
  // top3 = 1000+900+800 = 2700; 2700/5500 = 49.09 -> 49.1
  assert.equal(indiceConcentracao(v), 49.1);
});

test('índice de concentração sem faturamento = 0 (evita divisão por zero)', () => {
  assert.equal(indiceConcentracao([vend('A', 0), vend('B', 0)]), 0);
  assert.equal(indiceConcentracao([]), 0);
});

test('destaques: melhor vendedor, maior ticket e maior renovação', () => {
  const v = [
    vend('Ana', 5000, { ticket_medio: 1000, taxa_renovacao: 60 }),
    vend('Bruno', 3000, { ticket_medio: 3000, taxa_renovacao: 90 }),
  ];
  const d = destaques(v);
  assert.equal(d.melhor_vendedor.nome, 'Ana');   // maior valor
  assert.equal(d.maior_ticket.nome, 'Bruno');    // maior ticket
  assert.equal(d.maior_renovacao.nome, 'Bruno'); // maior renovação
});

test('destaques com lista vazia não quebra', () => {
  const d = destaques([]);
  assert.equal(d.melhor_vendedor, null);
});

test('totais consolida vendas, valor e ticket médio global', () => {
  const v = [vend('A', 4000, { vendas: 2 }), vend('B', 2000, { vendas: 2 })];
  const t = totais(v);
  assert.equal(t.vendas, 4);
  assert.equal(t.valor, 6000);
  assert.equal(t.ticket_medio, 1500); // 6000 / 4
});

test('ranking ordena por valor desc por padrão', () => {
  const v = [vend('A', 1000), vend('B', 5000), vend('C', 3000)];
  assert.deepEqual(ranking(v).map((x) => x.nome), ['B', 'C', 'A']);
});

test('série mensal separa faturamento, comissão projetada e recebida', () => {
  const vendas = [
    { data_venda: '2026-07-05', valor: 1000, status: 'concluida' },
    { data_venda: '2026-06-10', valor: 2000, status: 'concluida' },
    { data_venda: '2026-07-08', valor: 500, status: 'cancelada' }, // ignorada
  ];
  const comissoes = [
    { data_prevista: '2026-07-15', valor_parcela: 200, status: 'projetada' },
    { data_prevista: '2026-06-15', data_recebida: '2026-06-20', valor_parcela: 400, status: 'recebida' },
  ];
  const serie = serieMensal(vendas, comissoes, HOJE, 6);
  assert.equal(serie.length, 6);
  const jul = serie.find((s) => s.mes === '2026-07');
  const jun = serie.find((s) => s.mes === '2026-06');
  assert.equal(jul.faturamento, 1000); // cancelada não conta
  assert.equal(jul.comissao_projetada, 200);
  assert.equal(jun.faturamento, 2000);
  assert.equal(jun.comissao_recebida, 400);
});
