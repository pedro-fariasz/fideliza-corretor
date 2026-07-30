// Testes da criação de venda: ponte lead -> cliente e ponte venda -> apólice.
// Repositories são monkeypatchados (sem tocar no banco), mesmo estilo de escopo.test.js.
// Rodar: npm test
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const vendasService = require('../src/services/vendasService');
const apolicesService = require('../src/services/apolicesService');
const vendasRepository = require('../src/repositories/vendasRepository');
const produtosRepository = require('../src/repositories/produtosRepository');
const leadsRepository = require('../src/repositories/leadsRepository');
const interacoesRepository = require('../src/repositories/interacoesRepository');
const comissoesRepository = require('../src/repositories/comissoesRepository');
const carteiraClientesRepository = require('../src/repositories/carteiraClientesRepository');
const apolicesRepository = require('../src/repositories/apolicesRepository');
const atividadesRepository = require('../src/repositories/atividadesRepository');

const TENANT_ID = 't1';

const PRODUTO = {
  id: 'prod1',
  nome: 'Plano Saúde PME',
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
    vendasRemove: vendasRepository.remove,
    comissoesCreateMany: comissoesRepository.createMany,
    interacoesCreate: interacoesRepository.create,
    carteiraFindByLead: carteiraClientesRepository.findByLead,
    carteiraCreate: carteiraClientesRepository.create,
    apolicesFindByVenda: apolicesRepository.findByVenda,
    apolicesCreate: apolicesRepository.create,
    atividadesCreate: atividadesRepository.create,
  };

  const chamadas = {
    carteiraCreate: [],
    apolicesCreate: [],
    vendasRemove: [],
    atividadesCreate: [],
  };

  let vendaSeq = 0;
  let apoliceSeq = 0;
  let clienteAtual = clienteExistenteInicial;
  const apolicesPorVenda = new Map(); // idempotência por venda_id

  produtosRepository.findById = async () => PRODUTO;
  leadsRepository.findById = async (_tenantId, id) => (leadExistente && leadExistente.id === id ? leadExistente : null);
  leadsRepository.update = async () => leadExistente;
  vendasRepository.create = async (tenantId, payload) => {
    vendaSeq += 1;
    return { id: `venda${vendaSeq}`, tenant_id: tenantId, status: 'concluida', ...payload };
  };
  vendasRepository.remove = async (tenantId, id) => {
    chamadas.vendasRemove.push({ tenantId, id });
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
  apolicesRepository.findByVenda = async (_tenantId, vendaId) => apolicesPorVenda.get(vendaId) || null;
  apolicesRepository.create = async (tenantId, payload) => {
    apoliceSeq += 1;
    const apolice = { id: `apolice${apoliceSeq}`, tenant_id: tenantId, ...payload };
    apolicesPorVenda.set(payload.venda_id, apolice);
    chamadas.apolicesCreate.push({ tenantId, payload, apolice });
    return apolice;
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
    vendasRepository.remove = originais.vendasRemove;
    comissoesRepository.createMany = originais.comissoesCreateMany;
    interacoesRepository.create = originais.interacoesCreate;
    carteiraClientesRepository.findByLead = originais.carteiraFindByLead;
    carteiraClientesRepository.create = originais.carteiraCreate;
    apolicesRepository.findByVenda = originais.apolicesFindByVenda;
    apolicesRepository.create = originais.apolicesCreate;
    atividadesRepository.create = originais.atividadesCreate;
  };

  return { chamadas, restaurar };
}

const acoes = (chamadas) => chamadas.atividadesCreate.map((a) => a.payload.acao);

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
  } finally {
    restaurar();
  }
});

test('registra atividade acao=promovido_de_lead ao promover o lead', async () => {
  const { chamadas, restaurar } = mockRepositorios();
  try {
    const venda = await vendasService.criar(TENANT_ID, { produto_id: 'prod1', lead_id: 'lead1', valor: 1000 });

    const promovido = chamadas.atividadesCreate.find((a) => a.payload.acao === 'promovido_de_lead');
    assert.ok(promovido, 'deve existir atividade promovido_de_lead');
    assert.equal(promovido.payload.entidade, 'cliente');
    assert.equal(promovido.payload.entidade_id, chamadas.carteiraCreate[0].cliente.id);
    assert.deepEqual(promovido.payload.detalhes, { lead_id: 'lead1', venda_id: venda.id });
  } finally {
    restaurar();
  }
});

test('venda concluída com lead gera a apólice automaticamente (ponte venda->apólice)', async () => {
  const { chamadas, restaurar } = mockRepositorios();
  try {
    const venda = await vendasService.criar(TENANT_ID, {
      produto_id: 'prod1',
      lead_id: 'lead1',
      valor: 1500,
      forma_pagamento: 'pix',
      data_venda: '2026-07-10',
    });

    assert.equal(chamadas.apolicesCreate.length, 1, 'deve criar exatamente 1 apólice');
    const { payload } = chamadas.apolicesCreate[0];
    assert.equal(payload.venda_id, venda.id);
    assert.equal(payload.cliente_id, chamadas.carteiraCreate[0].cliente.id);
    assert.equal(payload.produto_id, 'prod1');
    assert.equal(payload.valor, 1500);
    assert.equal(payload.forma_pagamento, 'pix');
    assert.equal(payload.data_inicio, '2026-07-10');
    assert.equal(payload.data_vencimento, '2027-07-10'); // + vigencia_meses (12)
    assert.equal(payload.status, 'ativa');

    // registra atividade apolice_criada
    const criada = chamadas.atividadesCreate.find((a) => a.payload.acao === 'apolice_criada');
    assert.ok(criada, 'deve registrar atividade apolice_criada');
    assert.equal(criada.payload.entidade, 'apolice');
    assert.equal(criada.payload.entidade_id, chamadas.apolicesCreate[0].apolice.id);
    assert.deepEqual(criada.payload.detalhes, {
      venda_id: venda.id,
      cliente_id: chamadas.carteiraCreate[0].cliente.id,
      produto_id: 'prod1',
    });
  } finally {
    restaurar();
  }
});

test('gerarDeVenda 2x para a MESMA venda cria só 1 apólice (idempotente)', async () => {
  const { chamadas, restaurar } = mockRepositorios();
  try {
    const venda = { id: 'vendaX', tenant_id: TENANT_ID, vendedor_id: null, valor: 900, forma_pagamento: 'boleto', data_venda: '2026-06-01' };
    const a1 = await apolicesService.gerarDeVenda(TENANT_ID, { venda, produto: PRODUTO, cliente_id: 'cli1' });
    const a2 = await apolicesService.gerarDeVenda(TENANT_ID, { venda, produto: PRODUTO, cliente_id: 'cli1' });

    assert.equal(chamadas.apolicesCreate.length, 1, '2ª chamada não deve criar outra apólice');
    assert.equal(a1.id, a2.id);
  } finally {
    restaurar();
  }
});

test('falha ao gerar apólice DERRUBA a venda (rollback + propaga erro)', async () => {
  const { chamadas, restaurar } = mockRepositorios();
  apolicesRepository.create = async () => {
    throw new Error('falha simulada ao criar apólice');
  };
  try {
    await assert.rejects(
      () => vendasService.criar(TENANT_ID, { produto_id: 'prod1', lead_id: 'lead1', valor: 1000 }),
      /falha simulada ao criar apólice/
    );
    assert.equal(chamadas.vendasRemove.length, 1, 'venda órfã deve ser removida (rollback)');
  } finally {
    restaurar();
  }
});

test('venda sem lead_id não cria cliente nem apólice e não quebra', async () => {
  const { chamadas, restaurar } = mockRepositorios();
  try {
    const venda = await vendasService.criar(TENANT_ID, { produto_id: 'prod1', valor: 1000 });

    assert.ok(venda.id);
    assert.equal(chamadas.carteiraCreate.length, 0);
    assert.equal(chamadas.apolicesCreate.length, 0);
    assert.equal(acoes(chamadas).length, 0);
  } finally {
    restaurar();
  }
});
