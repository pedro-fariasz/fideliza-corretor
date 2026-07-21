// Testes do motor de pós-venda (Fase 2): gatilhos, template e cross-sell.
// Puros (sem banco), no mesmo estilo de carteira.test.js. Rodar: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  addDays,
  diasEntre,
  aniversarioMaisRecente,
  calcularEtapaAtual,
  progresso,
  renderTemplate,
  sugerirCrossSell,
} = require('../src/services/posvendasEngine');
const {
  ETAPAS_PADRAO,
  MENSAGENS_PADRAO,
  mensagemPadrao,
  categoriaPosvendaDeProduto,
} = require('../src/config/posvendasDefaults');

const HOJE = '2026-07-21';

// Etapas de fábrica com ids fictícios (o engine só usa chave/ordem/gatilho).
const ETAPAS = ETAPAS_PADRAO.map((e, i) => ({ ...e, id: `etapa-${i}`, ativo: true }));

test('addDays / diasEntre — aritmética de datas em UTC', () => {
  assert.equal(addDays('2026-07-21', 1), '2026-07-22');
  assert.equal(addDays('2026-07-31', 1), '2026-08-01');
  assert.equal(addDays('2026-07-21', -60), '2026-05-22');
  assert.equal(diasEntre('2026-07-21', '2026-07-22'), 1);
  assert.equal(diasEntre('2026-07-21', '2026-07-21'), 0);
});

test('apólice criada hoje NÃO está em Boas-vindas hoje (gatilho é D+1)', () => {
  const etapa = calcularEtapaAtual({
    dataInicio: HOJE,
    dataVencimento: '2027-07-21',
    dataNascimento: null,
    etapas: ETAPAS,
    hoje: HOJE,
  });
  assert.equal(etapa, null); // nada disparou ainda
});

test('apólice de ontem aparece em Boas-vindas hoje (D+1), sem intervenção', () => {
  const ontem = addDays(HOJE, -1);
  const etapa = calcularEtapaAtual({
    dataInicio: ontem,
    dataVencimento: '2027-07-21',
    dataNascimento: null,
    etapas: ETAPAS,
    hoje: HOJE,
  });
  assert.equal(etapa.chave, 'boas_vindas');
});

test('alterar o gatilho de Boas-vindas para D+0 reflete na mesma passada', () => {
  const etapas = ETAPAS.map((e) => (e.chave === 'boas_vindas' ? { ...e, gatilho_dias: 0 } : e));
  const etapa = calcularEtapaAtual({
    dataInicio: HOJE,
    dataVencimento: '2027-07-21',
    dataNascimento: null,
    etapas,
    hoje: HOJE,
  });
  assert.equal(etapa.chave, 'boas_vindas'); // agora dispara no dia da venda
});

test('etapa atual = a de maior data de gatilho já disparada', () => {
  // Venda há 50 dias: já passou por Boas-vindas (D+1), Satisfação (D+30) e Expansão (D+45).
  const inicio = addDays(HOJE, -50);
  const etapa = calcularEtapaAtual({
    dataInicio: inicio,
    dataVencimento: addDays(HOJE, 300),
    dataNascimento: null,
    etapas: ETAPAS,
    hoje: HOJE,
  });
  assert.equal(etapa.chave, 'expansao');
});

test('Pré-Renovação dispara em D-60 do vencimento', () => {
  const etapa = calcularEtapaAtual({
    dataInicio: addDays(HOJE, -120),
    dataVencimento: addDays(HOJE, 60), // faltam 60 dias => D-60
    dataNascimento: null,
    etapas: ETAPAS,
    hoje: HOJE,
  });
  assert.equal(etapa.chave, 'pre_renovacao');
});

test('aniversarioMaisRecente escolhe a ocorrência já passada', () => {
  assert.equal(aniversarioMaisRecente('1990-03-10', HOJE), '2026-03-10'); // já passou em 2026
  assert.equal(aniversarioMaisRecente('1990-12-25', HOJE), '2025-12-25'); // ainda não em 2026
});

test('Aniversário só vale dentro da janela (15 dias)', () => {
  // Aniversário hoje => entra na etapa Aniversário (maior "recência").
  const naData = calcularEtapaAtual({
    dataInicio: addDays(HOJE, -200),
    dataVencimento: addDays(HOJE, 200),
    dataNascimento: '1985-07-21',
    etapas: ETAPAS,
    hoje: HOJE,
  });
  assert.equal(naData.chave, 'aniversario');

  // Aniversário há 30 dias (fora da janela) => cai na etapa sequencial normal.
  const foraJanela = calcularEtapaAtual({
    dataInicio: addDays(HOJE, -200),
    dataVencimento: addDays(HOJE, 200),
    dataNascimento: '1985-06-21',
    etapas: ETAPAS,
    hoje: HOJE,
  });
  assert.notEqual(foraJanela.chave, 'aniversario');
});

test('progresso reflete a posição da etapa na esteira', () => {
  const boas = { chave: 'boas_vindas' };
  const aniv = { chave: 'aniversario' };
  assert.equal(progresso(boas, ETAPAS), Math.round((1 / 6) * 100));
  assert.equal(progresso(aniv, ETAPAS), 100);
  assert.equal(progresso(null, ETAPAS), 0);
});

test('renderTemplate substitui as variáveis e some com as ausentes', () => {
  const texto = 'Olá [NOME], seu [PRODUTO] vence em [VENCIMENTO]. Valor [VALOR]. — [CORRETOR]';
  const out = renderTemplate(texto, {
    NOME: 'Ana', PRODUTO: 'Seguro Auto', VENCIMENTO: '10/08/2026', VALOR: 'R$ 1.200,00', CORRETOR: 'João',
  });
  assert.equal(out, 'Olá Ana, seu Seguro Auto vence em 10/08/2026. Valor R$ 1.200,00. — João');

  // Variável sem valor não vaza o "[VAR]".
  assert.equal(renderTemplate('Oi [NOME] [VENCIMENTO]', { NOME: 'Ana' }), 'Oi Ana ');
});

test('cross-sell: exclui o que o cliente já tem e ordena por comissão', () => {
  const produtos = [
    { id: 'p1', ativo: true, percentual: 5 },
    { id: 'p2', ativo: true, percentual: 12 },
    { id: 'p3', ativo: true, percentual: 8 },
    { id: 'p4', ativo: false, percentual: 20 }, // inativo não entra
  ];
  const jaTem = ['p1'];
  const sug = sugerirCrossSell(produtos, jaTem);
  assert.deepEqual(sug.map((p) => p.id), ['p2', 'p3']); // p1 excluído, p4 inativo, ordenado desc
});

test('defaults de fábrica: 6 etapas e uma mensagem por etapa', () => {
  assert.equal(ETAPAS_PADRAO.length, 6);
  for (const e of ETAPAS_PADRAO) {
    assert.ok(MENSAGENS_PADRAO[e.chave], `falta mensagem padrão para ${e.chave}`);
    assert.equal(mensagemPadrao('geral', e.chave), MENSAGENS_PADRAO[e.chave]);
  }
});

test('mapeamento produtos.categoria -> categoria de pós-venda', () => {
  assert.equal(categoriaPosvendaDeProduto('imobiliario'), 'venda_imovel');
  assert.equal(categoriaPosvendaDeProduto('seguro'), 'seguro');
  assert.equal(categoriaPosvendaDeProduto('saude'), 'saude');
  assert.equal(categoriaPosvendaDeProduto('consorcio'), 'consorcio');
  assert.equal(categoriaPosvendaDeProduto(null), 'geral');
});
