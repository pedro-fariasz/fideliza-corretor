// =============================================================================
// posvendasService — orquestra a esteira de pós-venda com o banco.
//   - pipeline / lista: agrupa apólices pela etapa ATUAL (calculada ao vivo)
//   - recalcularEtapas: job diário que move as apólices e registra interações
//   - marcarFeito: congela a etapa até o próximo gatilho
//   - crossSell / mensagemRenderizada: apoio às telas
//
// Escopo hierárquico via recurso 'posvendas' (herda a Fase 0). Isolamento por
// tenant_id em toda query (repositories).
// =============================================================================
const apolicesRepository = require('../repositories/apolicesRepository');
const carteiraClientesRepository = require('../repositories/carteiraClientesRepository');
const produtosRepository = require('../repositories/produtosRepository');
const usersRepository = require('../repositories/usersRepository');
const interacoesRepository = require('../repositories/interacoesRepository');
const statusRepo = require('../repositories/posvendasStatusRepository');
const mensagensRepo = require('../repositories/posvendasMensagensRepository');
const configService = require('./posvendasConfigService');
const engine = require('./posvendasEngine');
const defaults = require('../config/posvendasDefaults');
const notificacaoService = require('./notificacaoService');
const { resolverDonoIds, donoPermitido } = require('./escopoService');

const hoje = () => new Date().toISOString().slice(0, 10);

class NotFoundError extends Error {
  constructor(m) { super(m); this.name = 'NotFoundError'; this.statusCode = 404; }
}

function formatBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
}
function formatData(iso) {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

// --- Contexto compartilhado (uma passada de queries) -------------------------
async function montarContexto(tenantId, usuario, { donoIds } = {}) {
  const apolices = await apolicesRepository.list(tenantId, { donoIds });
  const clientes = await carteiraClientesRepository.list(tenantId, {});
  const produtos = await produtosRepository.list(tenantId, {});
  const statusMap = await statusRepo.mapAtualPorApolice(tenantId, apolices.map((a) => a.id));

  const clienteById = {};
  for (const c of clientes) clienteById[c.id] = c;
  const produtoById = {};
  for (const p of produtos) produtoById[p.id] = p;

  // Etapas efetivas por produto (cache: 1 resolução por produto distinto).
  const etapasPorProduto = {};
  const distintos = Array.from(new Set(apolices.map((a) => a.produto_id).filter(Boolean)));
  for (const pid of distintos) {
    const p = produtoById[pid];
    const categoria = defaults.categoriaPosvendaDeProduto(p ? p.categoria : null);
    etapasPorProduto[pid] = { categoria, etapas: await configService.etapasEfetivas(tenantId, categoria, pid) };
  }

  return { apolices, clienteById, produtoById, statusMap, etapasPorProduto };
}

// Enriquece uma apólice com a etapa atual + dados do card.
function montarCard(a, ctx, h) {
  const cliente = ctx.clienteById[a.cliente_id] || {};
  const conf = ctx.etapasPorProduto[a.produto_id] || { etapas: [] };
  const etapa = engine.calcularEtapaAtual({
    dataInicio: a.data_inicio,
    dataVencimento: a.data_vencimento,
    dataNascimento: cliente.data_nascimento,
    etapas: conf.etapas,
    hoje: h,
  });
  const status = ctx.statusMap[a.id];
  const mesmaEtapa = etapa && status && status.etapa_id === etapa.id;
  const diasNaEtapa = etapa
    ? mesmaEtapa
      ? engine.diasEntre(String(status.entrou_em).slice(0, 10), h)
      : engine.diasEntre(etapa._gatilho_data, h)
    : null;

  return {
    id: a.id,
    cliente_id: a.cliente_id,
    cliente_nome: cliente.nome || (a.cliente && a.cliente.nome) || 'Cliente',
    produto_id: a.produto_id,
    produto_nome: (a.produto && a.produto.nome) || '',
    corretor_id: a.corretor_id,
    valor: a.valor,
    data_vencimento: a.data_vencimento,
    health_score: a.health_score,
    nps: cliente.nps ?? null,
    etapa_chave: etapa ? etapa.chave : null,
    etapa_nome: etapa ? etapa.nome : 'Aguardando',
    dias_na_etapa: diasNaEtapa,
    progresso: engine.progresso(etapa, conf.etapas),
    concluido: Boolean(mesmaEtapa && status.concluido_em),
  };
}

// Colunas do pipeline = união das etapas ativas de todas as apólices, por ordem,
// + a pseudo-coluna "Aguardando" (ainda não entrou na esteira).
function montarColunas(ctx) {
  const porChave = {};
  for (const conf of Object.values(ctx.etapasPorProduto)) {
    for (const e of conf.etapas) {
      if (e.ativo === false) continue;
      if (!porChave[e.chave] || (e.ordem || 0) < porChave[e.chave].ordem) {
        porChave[e.chave] = { chave: e.chave, nome: e.nome, ordem: e.ordem || 0 };
      }
    }
  }
  const colunas = Object.values(porChave).sort((a, b) => a.ordem - b.ordem);
  colunas.push({ chave: 'aguardando', nome: 'Aguardando', ordem: 999 });
  return colunas;
}

// --- Pipeline ----------------------------------------------------------------
async function pipeline(tenantId, filtros, usuario) {
  const donoIds = usuario ? await resolverDonoIds(usuario, 'posvendas', 'ler') : null;
  const ctx = await montarContexto(tenantId, usuario, { donoIds });
  const h = hoje();

  const colunas = montarColunas(ctx);
  const cards = {};
  for (const c of colunas) cards[c.chave] = [];

  const ativas = ctx.apolices.filter((a) => a.status === 'ativa');
  for (const a of ativas) {
    const card = montarCard(a, ctx, h);
    const chave = card.etapa_chave || 'aguardando';
    (cards[chave] || cards.aguardando).push(card);
  }

  const contadores = {};
  for (const c of colunas) contadores[c.chave] = cards[c.chave].length;
  contadores.total = ativas.length;

  return { colunas, cards, contadores };
}

// --- Lista (visão tabela) ----------------------------------------------------
async function listar(tenantId, filtros, usuario) {
  const donoIds = usuario ? await resolverDonoIds(usuario, 'posvendas', 'ler') : null;
  const ctx = await montarContexto(tenantId, usuario, { donoIds });
  const h = hoje();
  const ativas = ctx.apolices.filter((a) => a.status === 'ativa');
  return ativas.map((a) => montarCard(a, ctx, h));
}

// Notificação pra corretora quando a apólice entra numa nova etapa da esteira.
// Usa o template de posvendas_mensagens (categoria x etapa) — sem template
// cadastrado, não cria nada (evita notificação vazia) e só loga. Não-fatal:
// quem chama nunca deixa isso derrubar o recálculo da etapa em si.
async function gerarNotificacaoEsteira(tenantId, apolice, cliente, produto, categoria, etapa, statusRow) {
  try {
    const msg = await mensagensRepo.find(tenantId, categoria, etapa.chave);
    if (!msg || !msg.texto) {
      console.log('[posvendas.recalcular] sem template de mensagem — notificação não criada', {
        tenant_id: tenantId, apolice_id: apolice.id, categoria, etapa_chave: etapa.chave,
      });
      return;
    }

    let destinatarioId = apolice.corretor_id;
    if (!destinatarioId) {
      const dono = await usersRepository.findCorretorDoTenant(tenantId);
      destinatarioId = dono ? dono.id : null;
    }
    if (!destinatarioId) return; // ninguém pra notificar

    let corretorNome = '';
    try {
      const u = await usersRepository.findByIdInTenant(tenantId, destinatarioId);
      corretorNome = (u && (u.nome || u.email)) || '';
    } catch { /* opcional */ }

    // posvendas_mensagens usa a sintaxe [VAR] (engine.renderTemplate), não a
    // {var} do notificacaoService — renderiza aqui e passa o texto já pronto.
    const textoRenderizado = engine.renderTemplate(msg.texto, {
      NOME: cliente ? cliente.nome : '',
      PRODUTO: produto ? produto.nome : '',
      VENCIMENTO: formatData(apolice.data_vencimento),
      VALOR: formatBRL(apolice.valor),
      CORRETOR: corretorNome,
    });

    await notificacaoService.criarNotificacao({
      tenant_id: tenantId,
      destinatario_id: destinatarioId,
      tipo: 'esteira_posvendas',
      cliente,
      apolice,
      titulo: `${etapa.nome} — ${cliente ? cliente.nome : 'cliente'}`,
      template: textoRenderizado,
      agendada_para: new Date().toISOString(),
      origem_tipo: 'esteira_posvendas',
      origem_id: statusRow.id,
    });
  } catch (err) {
    console.error('[posvendas.recalcular] falha ao gerar notificação da esteira (não-fatal)', {
      tenant_id: tenantId, apolice_id: apolice.id, error: err.message,
    });
  }
}

// --- Job diário: recalcula a etapa e move as apólices ------------------------
// Não-fatal por apólice: um erro isolado não derruba o lote.
async function recalcularEtapas(tenantId) {
  const ctx = await montarContexto(tenantId, null, {});
  const h = hoje();
  let movidas = 0;

  for (const a of ctx.apolices) {
    if (a.status !== 'ativa') continue;
    const cliente = ctx.clienteById[a.cliente_id] || {};
    const conf = ctx.etapasPorProduto[a.produto_id] || { etapas: [] };
    const etapa = engine.calcularEtapaAtual({
      dataInicio: a.data_inicio,
      dataVencimento: a.data_vencimento,
      dataNascimento: cliente.data_nascimento,
      etapas: conf.etapas,
      hoje: h,
    });
    if (!etapa) continue;

    const status = ctx.statusMap[a.id];
    if (status && status.etapa_id === etapa.id) continue; // já está nesta etapa

    const statusRow = await statusRepo.create(tenantId, { apolice_id: a.id, etapa_id: etapa.id });
    movidas += 1;

    await gerarNotificacaoEsteira(tenantId, a, cliente, ctx.produtoById[a.produto_id], conf.categoria, etapa, statusRow);

    // Movimentação automática vira interação (quando o cliente veio de um lead).
    if (cliente.lead_id) {
      try {
        await interacoesRepository.create(tenantId, {
          lead_id: cliente.lead_id,
          tipo: 'posvenda',
          descricao: `Pós-venda: entrou na etapa "${etapa.nome}".`,
        });
      } catch (e) {
        console.error('[posvendas.recalcular] interação falhou (não-fatal)', {
          tenant_id: tenantId, apolice_id: a.id, error: e.message,
        });
      }
    }
  }
  return { apolices_movidas: movidas };
}

// --- Hook: chamado ao criar/renovar apólice (garante a esteira da categoria) --
// Não-fatal (o chamador engole erros, como na Fase 1).
async function inicializarApolice(tenantId, produto) {
  const categoria = defaults.categoriaPosvendaDeProduto(produto ? produto.categoria : null);
  await configService.garantirDefaults(tenantId, categoria);
}

// --- Marcar etapa como feita (congela até o próximo gatilho) ------------------
async function _apoliceEscopada(tenantId, apoliceId, usuario, acao = 'ler') {
  const apolice = await apolicesRepository.findById(tenantId, apoliceId);
  if (!apolice) throw new NotFoundError('Apólice não encontrada.');
  if (usuario) {
    const donoIds = await resolverDonoIds(usuario, 'posvendas', acao);
    if (!donoPermitido(donoIds, apolice.corretor_id)) throw new NotFoundError('Apólice não encontrada.');
  }
  return apolice;
}

async function marcarFeito(tenantId, apoliceId, usuario, observacao) {
  const apolice = await _apoliceEscopada(tenantId, apoliceId, usuario, 'escrever');
  const produto = await produtosRepository.findById(tenantId, apolice.produto_id);
  const cliente = await carteiraClientesRepository.findById(tenantId, apolice.cliente_id);
  const categoria = defaults.categoriaPosvendaDeProduto(produto ? produto.categoria : null);
  const etapas = await configService.etapasEfetivas(tenantId, categoria, apolice.produto_id);
  const etapa = engine.calcularEtapaAtual({
    dataInicio: apolice.data_inicio,
    dataVencimento: apolice.data_vencimento,
    dataNascimento: cliente ? cliente.data_nascimento : null,
    etapas,
    hoje: hoje(),
  });
  if (!etapa) throw new NotFoundError('Esta apólice ainda não entrou em nenhuma etapa da esteira.');

  let status = await statusRepo.findAtual(tenantId, apoliceId);
  if (!status || status.etapa_id !== etapa.id) {
    status = await statusRepo.create(tenantId, { apolice_id: apoliceId, etapa_id: etapa.id });
  }
  return statusRepo.update(tenantId, status.id, {
    concluido_em: new Date().toISOString(),
    concluido_por: usuario ? usuario.id : null,
    observacao: observacao || null,
  });
}

// --- Cross-sell de uma apólice -----------------------------------------------
async function crossSell(tenantId, apoliceId, usuario) {
  const apolice = await _apoliceEscopada(tenantId, apoliceId, usuario, 'ler');
  const doCliente = await apolicesRepository.listByCliente(tenantId, apolice.cliente_id);
  const jaTem = doCliente.filter((a) => a.status === 'ativa' || a.status === 'renovada').map((a) => a.produto_id);
  const produtos = await produtosRepository.list(tenantId, { ativo: true });
  return engine.sugerirCrossSell(produtos, jaTem);
}

// --- Mensagem renderizada (para o preview e o botão wa.me) --------------------
async function mensagemRenderizada(tenantId, apoliceId, etapaChave, usuario) {
  const apolice = await _apoliceEscopada(tenantId, apoliceId, usuario, 'ler');
  const produto = await produtosRepository.findById(tenantId, apolice.produto_id);
  const cliente = await carteiraClientesRepository.findById(tenantId, apolice.cliente_id);
  const categoria = defaults.categoriaPosvendaDeProduto(produto ? produto.categoria : null);
  const mensagens = await configService.listarMensagens(tenantId, categoria);
  const msg = mensagens.find((m) => m.etapa_chave === etapaChave);
  const texto = msg ? msg.texto : defaults.mensagemPadrao(categoria, etapaChave);

  let corretorNome = '';
  if (apolice.corretor_id) {
    try {
      const u = await usersRepository.findByIdInTenant(tenantId, apolice.corretor_id);
      corretorNome = (u && (u.nome || u.email)) || '';
    } catch { /* opcional */ }
  }

  const rendered = engine.renderTemplate(texto, {
    NOME: cliente ? cliente.nome : '',
    PRODUTO: produto ? produto.nome : '',
    VENCIMENTO: formatData(apolice.data_vencimento),
    VALOR: formatBRL(apolice.valor),
    CORRETOR: corretorNome,
  });

  return {
    etapa_chave: etapaChave,
    categoria,
    texto: rendered,
    telefone: cliente ? cliente.telefone : null,
  };
}

module.exports = {
  pipeline,
  listar,
  recalcularEtapas,
  inicializarApolice,
  marcarFeito,
  crossSell,
  mensagemRenderizada,
  NotFoundError,
};
