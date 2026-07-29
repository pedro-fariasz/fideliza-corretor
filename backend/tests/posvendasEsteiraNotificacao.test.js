// Teste da integração esteira de pós-venda -> notificacoes_corretor (Parte 5).
// Repositories/services são monkeypatchados (sem tocar no banco), mesmo estilo
// de escopo.test.js. Rodar: npm test
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const posvendasService = require('../src/services/posvendasService');
const apolicesRepository = require('../src/repositories/apolicesRepository');
const carteiraClientesRepository = require('../src/repositories/carteiraClientesRepository');
const produtosRepository = require('../src/repositories/produtosRepository');
const statusRepo = require('../src/repositories/posvendasStatusRepository');
const mensagensRepo = require('../src/repositories/posvendasMensagensRepository');
const configService = require('../src/services/posvendasConfigService');
const usersRepository = require('../src/repositories/usersRepository');
const interacoesRepository = require('../src/repositories/interacoesRepository');
const notificacaoService = require('../src/services/notificacaoService');

const TENANT_ID = 't1';

// Apólice cuja vigência começou há muito tempo, pra garantir que o gatilho
// "venda D+1" (boas_vindas) já disparou independente de quando o teste rodar.
const APOLICE = {
  id: 'apolice1',
  tenant_id: TENANT_ID,
  cliente_id: 'cliente1',
  produto_id: 'produto1',
  corretor_id: null,
  data_inicio: '2020-01-01',
  data_vencimento: '2030-01-01',
  valor: 199.9,
  status: 'ativa',
};
const CLIENTE = { id: 'cliente1', nome: 'Fulano', telefone: '11988887777', lead_id: null };
const PRODUTO = { id: 'produto1', nome: 'Plano Ouro', categoria: 'saude' };
const ETAPA = { id: 'etapa1', chave: 'boas_vindas', nome: 'Boas-vindas', ordem: 1, gatilho_tipo: 'venda', gatilho_dias: 1, ativo: true };
const DONO = { id: 'dono1', nome: 'Ciclana Corretora' };

function mockRepositorios({ mensagem } = {}) {
  const originais = {
    apolicesList: apolicesRepository.list,
    clientesList: carteiraClientesRepository.list,
    produtosList: produtosRepository.list,
    mapAtualPorApolice: statusRepo.mapAtualPorApolice,
    statusCreate: statusRepo.create,
    etapasEfetivas: configService.etapasEfetivas,
    mensagensFind: mensagensRepo.find,
    findCorretorDoTenant: usersRepository.findCorretorDoTenant,
    findByIdInTenant: usersRepository.findByIdInTenant,
    interacoesCreate: interacoesRepository.create,
    criarNotificacao: notificacaoService.criarNotificacao,
  };

  const chamadas = { statusCreate: [], criarNotificacao: [] };

  apolicesRepository.list = async () => [APOLICE];
  carteiraClientesRepository.list = async () => [CLIENTE];
  produtosRepository.list = async () => [PRODUTO];
  statusRepo.mapAtualPorApolice = async () => ({}); // apólice ainda não está em nenhuma etapa
  statusRepo.create = async (tenantId, payload) => {
    const row = { id: 'status1', tenant_id: tenantId, ...payload };
    chamadas.statusCreate.push(row);
    return row;
  };
  configService.etapasEfetivas = async () => [ETAPA];
  mensagensRepo.find = async () => (mensagem !== undefined ? mensagem : { texto: 'Olá [NOME]! Seu [PRODUTO] tá ativo. — [CORRETOR]' });
  usersRepository.findCorretorDoTenant = async () => DONO;
  usersRepository.findByIdInTenant = async () => DONO;
  interacoesRepository.create = async () => ({ id: 'interacao1' });
  notificacaoService.criarNotificacao = async (args) => {
    chamadas.criarNotificacao.push(args);
    return { criada: true, notificacao: { id: 'notif1' } };
  };

  const restaurar = () => {
    apolicesRepository.list = originais.apolicesList;
    carteiraClientesRepository.list = originais.clientesList;
    produtosRepository.list = originais.produtosList;
    statusRepo.mapAtualPorApolice = originais.mapAtualPorApolice;
    statusRepo.create = originais.statusCreate;
    configService.etapasEfetivas = originais.etapasEfetivas;
    mensagensRepo.find = originais.mensagensFind;
    usersRepository.findCorretorDoTenant = originais.findCorretorDoTenant;
    usersRepository.findByIdInTenant = originais.findByIdInTenant;
    interacoesRepository.create = originais.interacoesCreate;
    notificacaoService.criarNotificacao = originais.criarNotificacao;
  };
  return { chamadas, restaurar };
}

test('apólice que entra numa nova etapa gera notificacoes_corretor com o texto renderizado', async () => {
  const { chamadas, restaurar } = mockRepositorios();
  try {
    const resultado = await posvendasService.recalcularEtapas(TENANT_ID);

    assert.equal(resultado.apolices_movidas, 1);
    assert.equal(chamadas.statusCreate.length, 1);

    assert.equal(chamadas.criarNotificacao.length, 1);
    const chamada = chamadas.criarNotificacao[0];
    assert.equal(chamada.tenant_id, TENANT_ID);
    assert.equal(chamada.tipo, 'esteira_posvendas');
    assert.equal(chamada.destinatario_id, DONO.id);
    assert.equal(chamada.cliente.id, CLIENTE.id);
    assert.equal(chamada.apolice.id, APOLICE.id);
    assert.equal(chamada.origem_id, 'status1');
    // template [VAR] da posvendas_mensagens já vem TOTALMENTE renderizado (sem colchetes).
    assert.equal(chamada.template, 'Olá Fulano! Seu Plano Ouro tá ativo. — Ciclana Corretora');
  } finally {
    restaurar();
  }
});

test('sem template cadastrado em posvendas_mensagens, não cria notificação (mas move a apólice)', async () => {
  const { chamadas, restaurar } = mockRepositorios({ mensagem: null });
  try {
    const resultado = await posvendasService.recalcularEtapas(TENANT_ID);

    assert.equal(resultado.apolices_movidas, 1); // a esteira anda normalmente
    assert.equal(chamadas.statusCreate.length, 1);
    assert.equal(chamadas.criarNotificacao.length, 0); // mas sem notificação vazia
  } finally {
    restaurar();
  }
});

test('falha ao gerar a notificação da esteira não derruba o recálculo da etapa', async () => {
  const { chamadas, restaurar } = mockRepositorios();
  notificacaoService.criarNotificacao = async () => {
    throw new Error('falha simulada');
  };
  try {
    const resultado = await posvendasService.recalcularEtapas(TENANT_ID);
    assert.equal(resultado.apolices_movidas, 1);
    assert.equal(chamadas.statusCreate.length, 1);
  } finally {
    restaurar();
  }
});

test('apólice sem corretor_id usa o corretor dono do tenant como destinatário', async () => {
  const { chamadas, restaurar } = mockRepositorios();
  try {
    await posvendasService.recalcularEtapas(TENANT_ID);
    assert.equal(chamadas.criarNotificacao[0].destinatario_id, DONO.id);
  } finally {
    restaurar();
  }
});
