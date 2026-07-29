// Testes dos 3 crons geradores de notificação (aniversário, boleto, follow-up).
// Repositories são monkeypatchados (sem tocar no banco), mesmo estilo de escopo.test.js.
// Rodar: npm test
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const notificacoesGeradorService = require('../src/services/notificacoesGeradorService');
const carteiraClientesRepository = require('../src/repositories/carteiraClientesRepository');
const usersRepository = require('../src/repositories/usersRepository');
const notificacaoService = require('../src/services/notificacaoService');

const { isBissexto, ehAniversarioHoje, diaVencimentoDaquiA, hojeNoFuso, instanteNoFuso } = notificacoesGeradorService;

// --- funções puras -------------------------------------------------------------

test('isBissexto identifica anos bissextos corretamente', () => {
  assert.equal(isBissexto(2024), true); // divisível por 4
  assert.equal(isBissexto(2023), false);
  assert.equal(isBissexto(1900), false); // divisível por 100, não por 400
  assert.equal(isBissexto(2000), true); // divisível por 400
});

test('ehAniversarioHoje: match normal de dia/mês', () => {
  assert.equal(ehAniversarioHoje('1990-07-29', '2026-07-29'), true);
  assert.equal(ehAniversarioHoje('1990-07-28', '2026-07-29'), false);
});

test('ehAniversarioHoje: 29/fev cai em 28/fev em ano não bissexto', () => {
  assert.equal(ehAniversarioHoje('1996-02-29', '2026-02-28'), true); // 2026 não é bissexto
  assert.equal(ehAniversarioHoje('1996-02-29', '2026-03-01'), false); // não antecipa nem posterga além do dia 28
});

test('ehAniversarioHoje: 29/fev bate normalmente em ano bissexto', () => {
  assert.equal(ehAniversarioHoje('1996-02-29', '2024-02-29'), true); // 2024 é bissexto
  assert.equal(ehAniversarioHoje('1996-02-29', '2024-02-28'), false); // não antecipa em ano bissexto
});

test('ehAniversarioHoje: sem data de nascimento nunca bate', () => {
  assert.equal(ehAniversarioHoje(null, '2026-07-29'), false);
});

test('diaVencimentoDaquiA calcula com rollover de mês', () => {
  assert.equal(diaVencimentoDaquiA('2026-07-29', 3), 1); // 29+3 = 1º de agosto
  assert.equal(diaVencimentoDaquiA('2026-07-10', 3), 13);
});

test('hojeNoFuso / instanteNoFuso produzem data e instante coerentes', () => {
  const hoje = hojeNoFuso();
  assert.match(hoje, /^\d{4}-\d{2}-\d{2}$/);
  const instante = instanteNoFuso('2026-07-29', '09:00');
  assert.equal(instante.toISOString(), '2026-07-29T12:00:00.000Z'); // 09:00 -03:00 = 12:00 UTC
});

// --- gerarAniversario / gerarBoleto / gerarFollowUp -----------------------------

const TENANT_ID = 't1';
const DONO = { id: 'dono1', tenant_id: TENANT_ID, role: 'corretor' };

function mockRepositorios({ aniversariantes = [], boletos = [], followUp = [] } = {}) {
  const originais = {
    findCorretorDoTenant: usersRepository.findCorretorDoTenant,
    listAniversariantes: carteiraClientesRepository.listAniversariantes,
    listComBoletoConfigurado: carteiraClientesRepository.listComBoletoConfigurado,
    listNovosCriadosEntre: carteiraClientesRepository.listNovosCriadosEntre,
    criarNotificacao: notificacaoService.criarNotificacao,
  };
  const chamadas = { criarNotificacao: [] };

  usersRepository.findCorretorDoTenant = async () => DONO;
  carteiraClientesRepository.listAniversariantes = async () => aniversariantes;
  carteiraClientesRepository.listComBoletoConfigurado = async () => boletos;
  carteiraClientesRepository.listNovosCriadosEntre = async () => followUp;
  notificacaoService.criarNotificacao = async (args) => {
    chamadas.criarNotificacao.push(args);
    return { criada: true, notificacao: { id: `notif${chamadas.criarNotificacao.length}` } };
  };

  const restaurar = () => {
    usersRepository.findCorretorDoTenant = originais.findCorretorDoTenant;
    carteiraClientesRepository.listAniversariantes = originais.listAniversariantes;
    carteiraClientesRepository.listComBoletoConfigurado = originais.listComBoletoConfigurado;
    carteiraClientesRepository.listNovosCriadosEntre = originais.listNovosCriadosEntre;
    notificacaoService.criarNotificacao = originais.criarNotificacao;
  };
  return { chamadas, restaurar };
}

test('gerarAniversario só cria notificação pra quem faz aniversário hoje', async () => {
  const hojeISO = hojeNoFuso();
  const [, mes, dia] = hojeISO.split('-');
  const nascimentoHoje = `1990-${mes}-${dia}`;
  const clientes = [
    { id: 'c1', nome: 'Faz hoje', data_nascimento: nascimentoHoje, telefone: '11988887777' },
    { id: 'c2', nome: 'Não faz hoje', data_nascimento: '1990-01-01', telefone: '11988887778' },
  ];
  const { chamadas, restaurar } = mockRepositorios({ aniversariantes: clientes });
  try {
    const resultado = await notificacoesGeradorService.gerarAniversario(TENANT_ID);
    assert.equal(resultado.criadas, 1);
    assert.equal(chamadas.criarNotificacao.length, 1);
    assert.equal(chamadas.criarNotificacao[0].cliente.id, 'c1');
    assert.equal(chamadas.criarNotificacao[0].tipo, 'aniversario_cliente');
    assert.equal(chamadas.criarNotificacao[0].destinatario_id, DONO.id);
  } finally {
    restaurar();
  }
});

test('gerarAniversario sem corretor no tenant não cria nada e não quebra', async () => {
  const { chamadas, restaurar } = mockRepositorios({ aniversariantes: [{ id: 'c1', data_nascimento: '1990-01-01' }] });
  usersRepository.findCorretorDoTenant = async () => null;
  try {
    const resultado = await notificacoesGeradorService.gerarAniversario(TENANT_ID);
    assert.deepEqual(resultado, { criadas: 0 });
    assert.equal(chamadas.criarNotificacao.length, 0);
  } finally {
    restaurar();
  }
});

test('gerarBoleto cria notificação só pra quem vence em 3 dias (com rollover de mês)', async () => {
  const hojeISO = hojeNoFuso();
  const diaAlvo = diaVencimentoDaquiA(hojeISO, 3);
  const diaFora = ((diaAlvo + 14) % 28) + 1; // um dia bem diferente do alvo
  const clientes = [
    { id: 'c1', nome: 'Vence em 3 dias', vencimento_boleto: diaAlvo, telefone: '11988887777', operadora: 'Amil' },
    { id: 'c2', nome: 'Vence outro dia', vencimento_boleto: diaFora, telefone: '11988887778' },
  ];
  const { chamadas, restaurar } = mockRepositorios({ boletos: clientes });
  try {
    const resultado = await notificacoesGeradorService.gerarBoleto(TENANT_ID);
    assert.equal(resultado.criadas, 1);
    assert.equal(chamadas.criarNotificacao[0].cliente.id, 'c1');
    assert.equal(chamadas.criarNotificacao[0].tipo, 'boleto_disponivel');
  } finally {
    restaurar();
  }
});

test('gerarFollowUp cria notificação pros clientes retornados pela janela de 7 dias', async () => {
  const clientes = [{ id: 'c1', nome: 'Novo há 7 dias', telefone: '11988887777', operadora: 'Amil' }];
  const { chamadas, restaurar } = mockRepositorios({ followUp: clientes });
  try {
    const resultado = await notificacoesGeradorService.gerarFollowUp(TENANT_ID);
    assert.equal(resultado.criadas, 1);
    assert.equal(chamadas.criarNotificacao[0].tipo, 'follow_up_pos_venda');
    assert.equal(chamadas.criarNotificacao[0].cliente.id, 'c1');
  } finally {
    restaurar();
  }
});

test('falha ao criar notificação de um cliente não impede o restante do lote', async () => {
  const clientes = [
    { id: 'c1', nome: 'Quebra', vencimento_boleto: 1 },
    { id: 'c2', nome: 'Segue o baile', vencimento_boleto: 1 },
  ];
  const hojeISO = hojeNoFuso();
  const diaAlvo = diaVencimentoDaquiA(hojeISO, 3);
  clientes[0].vencimento_boleto = diaAlvo;
  clientes[1].vencimento_boleto = diaAlvo;

  const { chamadas, restaurar } = mockRepositorios({ boletos: clientes });
  let chamada = 0;
  notificacaoService.criarNotificacao = async (args) => {
    chamada += 1;
    chamadas.criarNotificacao.push(args);
    if (chamada === 1) throw new Error('falha simulada');
    return { criada: true, notificacao: { id: 'notifX' } };
  };
  try {
    const resultado = await notificacoesGeradorService.gerarBoleto(TENANT_ID);
    assert.equal(resultado.criadas, 1); // só a segunda contou
    assert.equal(chamadas.criarNotificacao.length, 2); // mas as duas foram tentadas
  } finally {
    restaurar();
  }
});
