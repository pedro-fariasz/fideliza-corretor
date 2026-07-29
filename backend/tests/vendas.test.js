// Testes da ponte lead -> cliente na criação de venda (Relacionamento & Pós-Venda).
// Repositories são monkeypatchados (sem tocar no banco), mesmo estilo de escopo.test.js.
// Rodar: npm test
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const vendasService = require('../src/services/vendasService');
const vendasRepository = require('../src/repositories/vendasRepository');
const produtosRepository = require('../src/repositories/produtosRepository');
const leadsRepository = require('../src/repositories/leadsRepository');
const interacoesRepository = require('../src/repositories/interacoesRepository');
const comissoesRepository = require('../src/repositories/comissoesRepository');
const carteiraClientesRepository = require('../src/repositories/carteiraClientesRepository');
const atividadesRepository = require('../src/repositories/atividadesRepository');

const TENANT_ID = 't1';

const PRODUTO = {
  id: 'prod1',
  nome: 'Consórcio Imóvel',
  tipo_comissao: 'limitada',
  percentual: 10,
  parcelas_limite: 1,
  inicio_pagamento: 'mesmo_mes',
  dia_pagamento: 5,
  vigencia_meses: 12,
};

const LEAD = {
  id: 'lead1',
  nome: 'Fulano de Tal',
  cpf_cnpj: '111.111.111-11',
  telefone: '11999990000',
  email: 'fulano@example.com',
  dono_id: null,
};

// Substitui todas as funções usadas por vendasService.criar por dublês em
// memória; restaura os originais ao final de cada teste (finally).
function mockRepositorios({ leadExistente = LEAD, clienteExistenteInicial = null } = {}) {
  const originais = {
    produtosFindById: produtosRepository.findById,
    leadsFindById: leadsRepository.findById,
    leadsUpdate: leadsRepository.update,
    vendasCreate: vendasRepository.create,
    comissoesCreateMany: comissoesRepository.createMany,
    interacoesCreate: interacoesRepository.create,
    carteiraFindByLead: carteiraClientesRepository.findByLead,
    carteiraCreate: carteiraClientesRepository.create,
    atividadesCreate: atividadesRepository.create,
  };

  const chamadas = {
    carteiraCreate: [],
    atividadesCreate: [],
  };

  let vendaSeq = 0;
  let clienteAtual = clienteExistenteInicial;

  produtosRepository.findById = async () => PRODUTO;
  leadsRepository.findById = async (_tenantId, id) => (leadExistente && leadExistente.id === id ? leadExistente : null);
  leadsRepository.update = async () => leadExistente;
  vendasRepository.create = async (tenantId, payload) => {
    vendaSeq += 1;
    return { id: `venda${vendaSeq}`, tenant_id: tenantId, status: 'concluida', ...payload };
  };
  comissoesRepository.createMany = async () => [];
  interacoesRepository.create = async () => ({ id: 'interacao1' });
  carteiraClientesRepository.findByLead = async () => clienteAtual;
  carteiraClientesRepository.create = async (tenantId, payload) => {
    const cliente = { id: `cliente${chamadas.carteiraCreate.length + 1}`, tenant_id: tenantId, ...payload };
    chamadas.carteiraCreate.push({ tenantId, payload, cliente });
    clienteAtual = cliente;
    return cliente;
  };
  atividadesRepository.create = async (tenantId, payload) => {
    chamadas.atividadesCreate.push({ tenantId, payload });
    return { id: `atividade${chamadas.atividadesCreate.length}`, tenant_id: tenantId, ...payload };
  };

  const restaurar = () => {
    produtosRepository.findById = originais.produtosFindById;
    leadsRepository.findById = originais.leadsFindById;
    leadsRepository.update = originais.leadsUpdate;
    vendasRepository.create = originais.vendasCreate;
    comissoesRepository.createMany = originais.comissoesCreateMany;
    interacoesRepository.create = originais.interacoesCreate;
    carteiraClientesRepository.findByLead = originais.carteiraFindByLead;
    carteiraClientesRepository.create = originais.carteiraCreate;
    atividadesRepository.create = originais.atividadesCreate;
  };

  return { chamadas, restaurar };
}

test('venda concluída com lead promove o lead a cliente novo em carteira_clientes', async () => {
  const { chamadas, restaurar } = mockRepositorios();
  try {
    await vendasService.criar(TENANT_ID, { produto_id: 'prod1', lead_id: 'lead1', valor: 1000 });

    assert.equal(chamadas.carteiraCreate.length, 1);
    const { payload } = chamadas.carteiraCreate[0];
    assert.equal(payload.lead_id, 'lead1');
    assert.equal(payload.nome, LEAD.nome);
    assert.equal(payload.cpf_cnpj, LEAD.cpf_cnpj);
    assert.equal(payload.tipo_cliente, 'novo');
    assert.equal(payload.data_promovido_base, null);
    assert.equal(payload.plataforma_descarga_id, null);
  } finally {
    restaurar();
  }
});

test('registra atividades com acao=promovido_de_lead ao promover o lead', async () => {
  const { chamadas, restaurar } = mockRepositorios();
  try {
    const venda = await vendasService.criar(TENANT_ID, { produto_id: 'prod1', lead_id: 'lead1', valor: 1000 });

    assert.equal(chamadas.atividadesCreate.length, 1);
    const { payload } = chamadas.atividadesCreate[0];
    assert.equal(payload.entidade, 'cliente');
    assert.equal(payload.acao, 'promovido_de_lead');
    assert.equal(payload.entidade_id, chamadas.carteiraCreate[0].cliente.id);
    assert.deepEqual(payload.detalhes, { lead_id: 'lead1', venda_id: venda.id });
  } finally {
    restaurar();
  }
});

test('criar venda 2x para o mesmo lead cria apenas 1 cliente (idempotente)', async () => {
  const { chamadas, restaurar } = mockRepositorios();
  try {
    await vendasService.criar(TENANT_ID, { produto_id: 'prod1', lead_id: 'lead1', valor: 1000 });
    await vendasService.criar(TENANT_ID, { produto_id: 'prod1', lead_id: 'lead1', valor: 2000 });

    assert.equal(chamadas.carteiraCreate.length, 1);
  } finally {
    restaurar();
  }
});

test('venda sem lead_id não cria cliente e não quebra', async () => {
  const { chamadas, restaurar } = mockRepositorios();
  try {
    const venda = await vendasService.criar(TENANT_ID, { produto_id: 'prod1', valor: 1000 });

    assert.ok(venda.id);
    assert.equal(chamadas.carteiraCreate.length, 0);
    assert.equal(chamadas.atividadesCreate.length, 0);
  } finally {
    restaurar();
  }
});

test('falha ao promover lead não derruba a venda (não propaga erro)', async () => {
  const { restaurar } = mockRepositorios();
  // Sobrescreve por cima do dublê já instalado: simula o banco falhando na
  // promoção; a venda em si (já criada antes dessa etapa) precisa sobreviver.
  carteiraClientesRepository.findByLead = async () => {
    throw new Error('falha simulada de banco');
  };
  try {
    const venda = await vendasService.criar(TENANT_ID, { produto_id: 'prod1', lead_id: 'lead1', valor: 1000 });
    assert.ok(venda.id);
  } finally {
    restaurar();
  }
});
