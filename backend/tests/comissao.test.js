// Testes do motor de comissão — rodar com: npm test  (usa o runner nativo do Node)
// Os 3 casos obrigatórios vêm do PRD §6.5 / INSTRUCOES-PROJETO.md.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { calcularComissoes, dividirTotalEmParcelas } = require('../src/services/comissaoService');

function soma(parcelas) {
  return Math.round(parcelas.reduce((acc, p) => acc + p.valor_parcela, 0) * 100) / 100;
}

// -----------------------------------------------------------------------------
// Caso 1 — Consórcio: 30 parcelas de 1,5%, R$ 100.000 → 30 comissões de R$ 50.
// -----------------------------------------------------------------------------
test('Caso 1 — consórcio limitada 30x 1,5% de R$100k → 30 parcelas de R$50', () => {
  const parcelas = calcularComissoes({
    valor: 100000,
    dataVenda: '2026-03-10',
    produto: {
      tipo_comissao: 'limitada',
      percentual: 1.5,
      parcelas_limite: 30,
      inicio_pagamento: 'mes_seguinte',
    },
  });

  assert.equal(parcelas.length, 30);
  for (const p of parcelas) assert.equal(p.valor_parcela, 50);
  assert.equal(soma(parcelas), 1500); // comissão total = 100000 * 1,5%
  // 1ª parcela: dia 5 do mês seguinte à venda (março → abril).
  assert.equal(parcelas[0].data_prevista, '2026-04-05');
  // 2ª parcela: mês seguinte, mesmo dia.
  assert.equal(parcelas[1].data_prevista, '2026-05-05');
  // última (30ª): abril/2026 + 29 meses = setembro/2028.
  assert.equal(parcelas[29].data_prevista, '2028-09-05');
  assert.equal(parcelas[0].beneficiario, 'corretor');
});

// -----------------------------------------------------------------------------
// Caso 2 — Seguro auto: 1 parcela de 20%, R$ 3.000 → 1 comissão de R$ 600.
// -----------------------------------------------------------------------------
test('Caso 2 — seguro venda única 1x 20% de R$3k → 1 parcela de R$600', () => {
  const parcelas = calcularComissoes({
    valor: 3000,
    dataVenda: '2026-03-10',
    produto: {
      tipo_comissao: 'limitada',
      percentual: 20,
      parcelas_limite: 1,
      inicio_pagamento: 'mes_seguinte',
    },
  });

  assert.equal(parcelas.length, 1);
  assert.equal(parcelas[0].valor_parcela, 600);
  assert.equal(parcelas[0].num_parcela, 1);
  assert.equal(parcelas[0].total_parcelas, 1);
  assert.equal(parcelas[0].data_prevista, '2026-04-05');
});

// -----------------------------------------------------------------------------
// Caso 3 — Plano de saúde recorrente 5%, R$ 800/mês → 12 comissões de R$ 40.
// -----------------------------------------------------------------------------
test('Caso 3 — saúde recorrente 5% de R$800/mês → 12 parcelas de R$40', () => {
  const parcelas = calcularComissoes({
    valor: 800,
    dataVenda: '2026-03-10',
    produto: {
      tipo_comissao: 'recorrente',
      percentual: 5,
      inicio_pagamento: 'mes_seguinte',
    },
  });

  assert.equal(parcelas.length, 12);
  for (const p of parcelas) assert.equal(p.valor_parcela, 40);
  assert.equal(soma(parcelas), 480);
  assert.equal(parcelas[0].data_prevista, '2026-04-05');
  assert.equal(parcelas[11].data_prevista, '2027-03-05'); // 12ª parcela
});

// -----------------------------------------------------------------------------
// Início do pagamento "mesmo mês" — com dia já passado e não passado.
// -----------------------------------------------------------------------------
test('mesmo_mes — dia de pagamento ainda não passou → cai no mês da venda', () => {
  const parcelas = calcularComissoes({
    valor: 12000,
    dataVenda: '2026-03-03', // dia 3, pagamento dia 15 (ainda não passou)
    produto: {
      tipo_comissao: 'limitada',
      percentual: 10,
      parcelas_limite: 12,
      inicio_pagamento: 'mesmo_mes',
      dia_pagamento: 15,
    },
  });
  assert.equal(parcelas[0].data_prevista, '2026-03-15');
  assert.equal(parcelas[1].data_prevista, '2026-04-15');
  assert.equal(parcelas[11].data_prevista, '2027-02-15');
  assert.equal(soma(parcelas), 1200); // 12000 * 10%
});

test('mesmo_mes — dia de pagamento já passou → joga pro mês seguinte', () => {
  const parcelas = calcularComissoes({
    valor: 12000,
    dataVenda: '2026-03-20', // dia 20, pagamento dia 15 (já passou)
    produto: {
      tipo_comissao: 'limitada',
      percentual: 10,
      parcelas_limite: 3,
      inicio_pagamento: 'mesmo_mes',
      dia_pagamento: 15,
    },
  });
  assert.equal(parcelas[0].data_prevista, '2026-04-15');
  assert.equal(parcelas[2].data_prevista, '2026-06-15');
});

// -----------------------------------------------------------------------------
// Arredondamento — soma das parcelas fecha o total mesmo com divisão inexata.
// -----------------------------------------------------------------------------
test('arredondamento — resto vai na última parcela e a soma fecha', () => {
  // 100 / 3 = 33,333... → 33,33 + 33,33 + 33,34
  const valores = dividirTotalEmParcelas(100, 3);
  assert.deepEqual(valores, [33.33, 33.33, 33.34]);
  assert.equal(Math.round(valores.reduce((a, b) => a + b, 0) * 100) / 100, 100);
});

test('vira de ano corretamente (dezembro → janeiro)', () => {
  const parcelas = calcularComissoes({
    valor: 1000,
    dataVenda: '2026-12-10',
    produto: {
      tipo_comissao: 'limitada',
      percentual: 10,
      parcelas_limite: 3,
      inicio_pagamento: 'mes_seguinte',
    },
  });
  assert.equal(parcelas[0].data_prevista, '2027-01-05');
  assert.equal(parcelas[1].data_prevista, '2027-02-05');
  assert.equal(parcelas[2].data_prevista, '2027-03-05');
});
