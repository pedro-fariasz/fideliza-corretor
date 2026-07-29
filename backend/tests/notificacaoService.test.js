// Testes do notificacaoService (central de avisos pra corretora).
// Repositories são monkeypatchados (sem tocar no banco), mesmo estilo de escopo.test.js.
// Rodar: npm test
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const notificacaoService = require('../src/services/notificacaoService');
const notificacoesCorretorRepository = require('../src/repositories/notificacoesCorretorRepository');
const usersRepository = require('../src/repositories/usersRepository');
const atividadesRepository = require('../src/repositories/atividadesRepository');

const { gerarLinkWhatsapp, renderizarTemplate, normalizarTelefoneE164 } = notificacaoService;

// --- gerarLinkWhatsapp / normalizarTelefoneE164 ------------------------------

test('normalizarTelefoneE164: DDD+número sem DDI ganha 55', () => {
  assert.equal(normalizarTelefoneE164('11988887777'), '+5511988887777');
  assert.equal(normalizarTelefoneE164('(11) 98888-7777'), '+5511988887777');
});

test('normalizarTelefoneE164: já com 55 mantém', () => {
  assert.equal(normalizarTelefoneE164('5511988887777'), '+5511988887777');
});

test('normalizarTelefoneE164: telefone inválido/curto demais retorna null', () => {
  assert.equal(normalizarTelefoneE164('12345'), null);
  assert.equal(normalizarTelefoneE164(''), null);
  assert.equal(normalizarTelefoneE164(null), null);
});

test('gerarLinkWhatsapp monta a URL wa.me com a mensagem codificada', () => {
  const link = gerarLinkWhatsapp('11988887777', 'Olá! Tudo bem?');
  assert.equal(link, 'https://wa.me/5511988887777?text=Ol%C3%A1!%20Tudo%20bem%3F');
});

test('gerarLinkWhatsapp retorna null pra telefone inválido', () => {
  assert.equal(gerarLinkWhatsapp('123', 'oi'), null);
});

// --- renderizarTemplate --------------------------------------------------------

test('renderizarTemplate substitui todas as variáveis suportadas', () => {
  const texto = 'Oi {nome}! Plano {operadora}, boleto dia {vencimento_boleto}. — {nome_corretor}';
  const out = renderizarTemplate(texto, {
    nome: 'Fulano',
    operadora: 'Amil',
    vencimento_boleto: 10,
    nome_corretor: 'Ciclana',
  });
  assert.equal(out, 'Oi Fulano! Plano Amil, boleto dia 10. — Ciclana');
});

test('renderizarTemplate: variável ausente vira string vazia (nunca "undefined")', () => {
  const out = renderizarTemplate('Oi {nome}, seu plano é {plano_nome}.', { nome: 'Fulano' });
  assert.equal(out, 'Oi Fulano, seu plano é .');
  assert.doesNotMatch(out, /undefined/);
});

test('renderizarTemplate: texto vazio/nulo retorna string vazia', () => {
  assert.equal(renderizarTemplate(null, { nome: 'x' }), '');
  assert.equal(renderizarTemplate('', { nome: 'x' }), '');
});

test('renderizarTemplate: token desconhecido não é tocado', () => {
  const out = renderizarTemplate('Oi {nome}, {codigo_secreto}', { nome: 'Fulano' });
  assert.equal(out, 'Oi Fulano, {codigo_secreto}');
});

// --- criarNotificacao -----------------------------------------------------------

const TENANT_ID = 't1';
const CORRETOR = { id: 'user1', nome: 'Ciclana Corretora' };
const CLIENTE = { id: 'cliente1', nome: 'Fulano de Tal', telefone: '11988887777', operadora: 'Amil' };

function mockRepositorios() {
  const originais = {
    create: notificacoesCorretorRepository.create,
    findById: usersRepository.findById,
    atividadesCreate: atividadesRepository.create,
  };
  const chamadas = { create: [], atividadesCreate: [] };

  let seq = 0;
  notificacoesCorretorRepository.create = async (tenantId, payload) => {
    seq += 1;
    const row = { id: `notif${seq}`, tenant_id: tenantId, ...payload };
    chamadas.create.push({ tenantId, payload, row });
    return row;
  };
  usersRepository.findById = async (id) => (id === CORRETOR.id ? CORRETOR : null);
  atividadesRepository.create = async (tenantId, payload) => {
    chamadas.atividadesCreate.push({ tenantId, payload });
    return { id: 'atividade1', tenant_id: tenantId, ...payload };
  };

  const restaurar = () => {
    notificacoesCorretorRepository.create = originais.create;
    usersRepository.findById = originais.findById;
    atividadesRepository.create = originais.atividadesCreate;
  };
  return { chamadas, restaurar };
}

test('criarNotificacao renderiza o template, gera telefone_destino e registra atividades', async () => {
  const { chamadas, restaurar } = mockRepositorios();
  try {
    const resultado = await notificacaoService.criarNotificacao({
      tenant_id: TENANT_ID,
      destinatario_id: CORRETOR.id,
      tipo: 'aniversario_cliente',
      cliente: CLIENTE,
      titulo: 'Aniversário',
      template: 'Feliz aniversário, {nome}! — {nome_corretor}',
      agendada_para: '2026-07-29T12:00:00.000Z',
      origem_tipo: 'cron_aniversario',
    });

    assert.equal(resultado.criada, true);
    assert.equal(resultado.notificacao.mensagem_pronta, 'Feliz aniversário, Fulano de Tal! — Ciclana Corretora');
    assert.equal(resultado.notificacao.telefone_destino, '+5511988887777');
    assert.equal(resultado.notificacao.agendada_para_dia, '2026-07-29');

    assert.equal(chamadas.atividadesCreate.length, 1);
    assert.equal(chamadas.atividadesCreate[0].payload.acao, 'notificacao_criada');
    assert.deepEqual(chamadas.atividadesCreate[0].payload.detalhes, {
      tipo: 'aniversario_cliente',
      notificacao_id: resultado.notificacao.id,
    });
  } finally {
    restaurar();
  }
});

test('cliente sem telefone gera notificação sem telefone_destino (sem link)', async () => {
  const { restaurar } = mockRepositorios();
  try {
    const resultado = await notificacaoService.criarNotificacao({
      tenant_id: TENANT_ID,
      destinatario_id: CORRETOR.id,
      tipo: 'follow_up_pos_venda',
      cliente: { id: 'cliente2', nome: 'Sem Telefone' },
      titulo: 'Follow-up',
      template: 'Oi {nome}!',
      agendada_para: '2026-07-29T12:00:00.000Z',
      origem_tipo: 'cron_follow_up',
    });

    assert.equal(resultado.criada, true);
    assert.equal(resultado.notificacao.telefone_destino, null);
  } finally {
    restaurar();
  }
});

test('conflito de UNIQUE (mesmo evento no mesmo dia) não cria de novo e não quebra', async () => {
  const { chamadas, restaurar } = mockRepositorios();
  notificacoesCorretorRepository.create = async () => {
    const err = new Error('duplicate key value violates unique constraint');
    err.code = '23505';
    throw err;
  };
  try {
    const resultado = await notificacaoService.criarNotificacao({
      tenant_id: TENANT_ID,
      destinatario_id: CORRETOR.id,
      tipo: 'aniversario_cliente',
      cliente: CLIENTE,
      titulo: 'Aniversário',
      template: 'Feliz aniversário, {nome}!',
      agendada_para: '2026-07-29T12:00:00.000Z',
      origem_tipo: 'cron_aniversario',
    });

    assert.deepEqual(resultado, { criada: false, motivo: 'ja_existe' });
    assert.equal(chamadas.atividadesCreate.length, 0); // nem chegou a registrar atividade
  } finally {
    restaurar();
  }
});

test('falha ao registrar atividades não derruba a criação da notificação', async () => {
  const { restaurar } = mockRepositorios();
  atividadesRepository.create = async () => {
    throw new Error('falha simulada de banco');
  };
  try {
    const resultado = await notificacaoService.criarNotificacao({
      tenant_id: TENANT_ID,
      destinatario_id: CORRETOR.id,
      tipo: 'aniversario_cliente',
      cliente: CLIENTE,
      titulo: 'Aniversário',
      template: 'Feliz aniversário, {nome}!',
      agendada_para: '2026-07-29T12:00:00.000Z',
      origem_tipo: 'cron_aniversario',
    });
    assert.equal(resultado.criada, true);
  } finally {
    restaurar();
  }
});

// --- leitura / ações (marcar-enviada, marcar-visualizada, descartar, badge) ----

function mockLeitura() {
  const originais = {
    findById: notificacoesCorretorRepository.findById,
    update: notificacoesCorretorRepository.update,
    countPendentes: notificacoesCorretorRepository.countPendentes,
  };
  const registro = { id: 'notifX', tenant_id: TENANT_ID, destinatario_id: CORRETOR.id, status: 'pendente', cliente_id: 'cliente1' };
  const chamadas = { update: [] };

  notificacoesCorretorRepository.findById = async (tenantId, id) =>
    tenantId === TENANT_ID && id === registro.id ? { ...registro } : null;
  notificacoesCorretorRepository.update = async (tenantId, id, patch) => {
    chamadas.update.push({ tenantId, id, patch });
    Object.assign(registro, patch);
    return { ...registro };
  };
  notificacoesCorretorRepository.countPendentes = async () => 3;

  const restaurar = () => {
    notificacoesCorretorRepository.findById = originais.findById;
    notificacoesCorretorRepository.update = originais.update;
    notificacoesCorretorRepository.countPendentes = originais.countPendentes;
  };
  return { registro, chamadas, restaurar };
}

test('notificação de outro tenant/usuário retorna NotFoundError (404)', async () => {
  const { restaurar } = mockLeitura();
  try {
    await assert.rejects(
      () => notificacaoService.marcarEnviada('outro-tenant', CORRETOR.id, 'notifX'),
      (err) => {
        assert.equal(err.name, 'NotFoundError');
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
    await assert.rejects(
      () => notificacaoService.marcarEnviada(TENANT_ID, 'outro-usuario', 'notifX'),
      (err) => {
        assert.equal(err.name, 'NotFoundError');
        return true;
      }
    );
  } finally {
    restaurar();
  }
});

test('marcarVisualizada é idempotente: só muda de pendente; enviada/descartada ficam como estão', async () => {
  const { registro, chamadas, restaurar } = mockLeitura();
  try {
    await notificacaoService.marcarVisualizada(TENANT_ID, CORRETOR.id, registro.id);
    assert.equal(registro.status, 'visualizada');
    assert.equal(chamadas.update.length, 1);

    registro.status = 'enviada'; // simula já ter sido enviada depois
    await notificacaoService.marcarVisualizada(TENANT_ID, CORRETOR.id, registro.id);
    assert.equal(registro.status, 'enviada'); // não regride
    assert.equal(chamadas.update.length, 1); // não chamou update de novo
  } finally {
    restaurar();
  }
});

test('badge conta pendentes do usuário atual', async () => {
  const { restaurar } = mockLeitura();
  try {
    const resultado = await notificacaoService.badge(TENANT_ID, CORRETOR.id);
    assert.deepEqual(resultado, { pendentes: 3 });
  } finally {
    restaurar();
  }
});
