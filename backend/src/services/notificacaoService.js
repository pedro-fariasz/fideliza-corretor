// =============================================================================
// notificacaoService — central de avisos pra corretora (sem envio automático).
//
// O backend NUNCA dispara WhatsApp/e-mail/SMS. Ele só monta o texto pronto e
// devolve um link wa.me; quem decide enviar (e aperta o botão) é a corretora,
// no frontend. `gerarLinkWhatsapp` e `renderizarTemplate` são funções puras
// (testáveis sem banco); `criarNotificacao` orquestra a gravação em
// notificacoes_corretor + atividades.
// =============================================================================
const notificacoesCorretorRepository = require('../repositories/notificacoesCorretorRepository');
const usersRepository = require('../repositories/usersRepository');
const atividadesService = require('./atividadesService');

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

// --- Telefone / link do WhatsApp ---------------------------------------------

// Normaliza pra E.164 assumindo Brasil quando o DDI estiver ausente.
// DDD (2) + número (8 ou 9) = 10/11 dígitos -> antepõe 55. Já vem com 55 e
// 12/13 dígitos -> mantém. Qualquer outro formato: null (não arrisca link errado).
function normalizarTelefoneE164(telefone) {
  if (!telefone) return null;
  const digitos = String(telefone).replace(/\D/g, '');
  if (!digitos) return null;

  let numero = digitos;
  if (numero.startsWith('55') && (numero.length === 12 || numero.length === 13)) {
    // já vem com DDI.
  } else if (numero.length === 10 || numero.length === 11) {
    numero = `55${numero}`;
  } else {
    return null;
  }
  if (numero.length < 12 || numero.length > 13) return null;
  return `+${numero}`;
}

function gerarLinkWhatsapp(telefone, mensagem) {
  const numero = normalizarTelefoneE164(telefone);
  if (!numero) return null;
  const texto = encodeURIComponent(mensagem || '');
  return `https://wa.me/${numero.slice(1)}?text=${texto}`;
}

// --- Template ------------------------------------------------------------------

const VARIAVEIS_SUPORTADAS = [
  'nome',
  'nome_corretor',
  'operadora',
  'plano_nome',
  'valor_mensalidade',
  'data_aniversario',
  'vencimento_boleto',
];

// Substitui {chave} pelo valor de variaveis[chave]. Chave ausente/nula vira
// string vazia — nunca "undefined" no texto final. Chaves fora da lista
// suportada não são tocadas (não são "nossas" variáveis).
function renderizarTemplate(texto, variaveis = {}) {
  if (!texto) return '';
  let out = texto;
  for (const chave of VARIAVEIS_SUPORTADAS) {
    const valor = variaveis[chave];
    out = out.split(`{${chave}}`).join(valor == null ? '' : String(valor));
  }
  return out;
}

function formatBRL(v) {
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function montarVariaveis(cliente, corretorNome, apolice) {
  return {
    nome: cliente ? cliente.nome : null,
    nome_corretor: corretorNome,
    operadora: cliente ? cliente.operadora : null,
    plano_nome: apolice ? apolice.plano_nome : null,
    valor_mensalidade: apolice && apolice.valor != null ? formatBRL(apolice.valor) : null,
    data_aniversario: cliente ? cliente.data_nascimento : null,
    vencimento_boleto: cliente ? cliente.vencimento_boleto : null,
  };
}

// --- Criação -------------------------------------------------------------------

// carteira_clientes não tem uma coluna telefone_whatsapp separada — o telefone
// principal (`telefone`) é reaproveitado como WhatsApp. Aceita também
// cliente.telefone_whatsapp explícito, se o chamador já tiver essa distinção.
function telefoneWhatsappDoCliente(cliente) {
  if (!cliente) return null;
  return cliente.telefone_whatsapp || cliente.telefone || null;
}

/**
 * Cria uma notificação pra corretora. Idempotente por dia: se já existe uma
 * notificação do mesmo tipo, pro mesmo cliente, no mesmo dia (agendada_para),
 * não cria de novo — retorna { criada: false, motivo: 'ja_existe' }.
 */
async function criarNotificacao({
  tenant_id: tenantId,
  destinatario_id: destinatarioId,
  tipo,
  cliente,
  apolice,
  titulo,
  template,
  agendada_para: agendadaPara,
  origem_tipo: origemTipo,
  origem_id: origemId,
}) {
  let corretorNome = '';
  try {
    const corretor = await usersRepository.findById(destinatarioId);
    corretorNome = (corretor && corretor.nome) || '';
  } catch (err) {
    console.error('[notificacaoService.criarNotificacao] falha ao buscar destinatário', {
      tenant_id: tenantId,
      destinatario_id: destinatarioId,
      error: err.message,
    });
  }

  const mensagemPronta = renderizarTemplate(template, montarVariaveis(cliente, corretorNome, apolice));
  const telefoneDestino = normalizarTelefoneE164(telefoneWhatsappDoCliente(cliente));

  const agendadaParaDate = new Date(agendadaPara);
  const agendadaParaDia = agendadaParaDate.toISOString().slice(0, 10);

  let notificacao;
  try {
    notificacao = await notificacoesCorretorRepository.create(tenantId, {
      destinatario_id: destinatarioId,
      tipo,
      cliente_id: cliente ? cliente.id : null,
      apolice_id: apolice ? apolice.id : null,
      titulo,
      mensagem_pronta: mensagemPronta,
      telefone_destino: telefoneDestino,
      agendada_para: agendadaParaDate.toISOString(),
      agendada_para_dia: agendadaParaDia,
      origem_tipo: origemTipo || null,
      origem_id: origemId || null,
    });
  } catch (err) {
    if (err.code === '23505') {
      return { criada: false, motivo: 'ja_existe' };
    }
    throw err;
  }

  await atividadesService.registrar(tenantId, {
    entidade: 'cliente',
    entidade_id: notificacao.cliente_id,
    acao: 'notificacao_criada',
    detalhes: { tipo, notificacao_id: notificacao.id },
  });

  return { criada: true, notificacao };
}

// --- Enriquecimento / leitura ---------------------------------------------------

function enriquecerComLink(notificacao) {
  const link =
    notificacao.telefone_destino && notificacao.mensagem_pronta
      ? gerarLinkWhatsapp(notificacao.telefone_destino, notificacao.mensagem_pronta)
      : null;
  return { ...notificacao, link_whatsapp: link };
}

async function listar(tenantId, usuarioId, filtros = {}) {
  const { limit = 50, ...resto } = filtros || {};
  const lista = await notificacoesCorretorRepository.list(tenantId, {
    ...resto,
    destinatario_id: usuarioId,
    limit,
  });
  return lista.map(enriquecerComLink);
}

async function listarPendentes(tenantId, usuarioId) {
  const lista = await notificacoesCorretorRepository.listPendentes(tenantId, usuarioId);
  return lista.map(enriquecerComLink);
}

async function badge(tenantId, usuarioId) {
  const pendentes = await notificacoesCorretorRepository.countPendentes(tenantId, usuarioId);
  return { pendentes };
}

// Garante tenant + dono (destinatário) — outro usuário ou outro tenant = 404 (não vaza existência).
async function obterDoUsuario(tenantId, usuarioId, id) {
  const notificacao = await notificacoesCorretorRepository.findById(tenantId, id);
  if (!notificacao || notificacao.destinatario_id !== usuarioId) {
    throw new NotFoundError('Notificação não encontrada.');
  }
  return notificacao;
}

async function marcarEnviada(tenantId, usuarioId, id) {
  await obterDoUsuario(tenantId, usuarioId, id);
  const atualizada = await notificacoesCorretorRepository.update(tenantId, id, {
    status: 'enviada',
    enviada_em: new Date().toISOString(),
  });

  await atividadesService.registrar(tenantId, {
    usuario_id: usuarioId,
    entidade: 'cliente',
    entidade_id: atualizada.cliente_id,
    acao: 'notificacao_enviada',
    detalhes: { notificacao_id: id },
  });

  return enriquecerComLink(atualizada);
}

// Idempotente: só grava visualizada_em (e muda o status) se ainda estava
// pendente. Já enviada/descartada permanece como está.
async function marcarVisualizada(tenantId, usuarioId, id) {
  const notificacao = await obterDoUsuario(tenantId, usuarioId, id);
  if (notificacao.status !== 'pendente') return enriquecerComLink(notificacao);

  const atualizada = await notificacoesCorretorRepository.update(tenantId, id, {
    status: 'visualizada',
    visualizada_em: new Date().toISOString(),
  });
  return enriquecerComLink(atualizada);
}

async function descartar(tenantId, usuarioId, id) {
  await obterDoUsuario(tenantId, usuarioId, id);
  const atualizada = await notificacoesCorretorRepository.update(tenantId, id, {
    status: 'descartada',
    descartada_em: new Date().toISOString(),
  });
  return enriquecerComLink(atualizada);
}

module.exports = {
  normalizarTelefoneE164,
  gerarLinkWhatsapp,
  renderizarTemplate,
  criarNotificacao,
  listar,
  listarPendentes,
  badge,
  marcarEnviada,
  marcarVisualizada,
  descartar,
  NotFoundError,
};
