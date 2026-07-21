const leadsRepository = require('../repositories/leadsRepository');
const interacoesRepository = require('../repositories/interacoesRepository');
const { resolverDonoIds, donoPermitido } = require('./escopoService');

// Os 6 estágios do funil (ordem fixa) + probabilidade padrão de cada um (PRD §6.4).
const ESTAGIOS = [
  'prospectos',
  'qualificados',
  'proposta_enviada',
  'negociacao',
  'finalizacao',
  'venda_concluida',
];
const ESTAGIO_PROBABILIDADE = {
  prospectos: 5,
  qualificados: 20,
  proposta_enviada: 40,
  negociacao: 60,
  finalizacao: 80,
  venda_concluida: 100,
};
const ESTAGIO_LABEL = {
  prospectos: 'Prospectos',
  qualificados: 'Qualificados',
  proposta_enviada: 'Proposta Enviada',
  negociacao: 'Negociação',
  finalizacao: 'Finalização',
  venda_concluida: 'Venda Concluída',
};

const TIPOS_PESSOA = ['PF', 'PJ'];
const ORIGENS_CADASTRO = ['manual', 'pdf'];
const STATUS_LEAD = ['ativo', 'perdido'];
const TIPOS_INTERACAO = ['nota', 'ligacao', 'whatsapp', 'email', 'reuniao'];

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

function normalizarString(v) {
  if (typeof v !== 'string') return v;
  const t = v.trim();
  return t === '' ? null : t;
}

function coerceNumero(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && !Number.isNaN(Number(v))) return Number(v);
  return v;
}

function normalizarPayload(input) {
  const out = { ...input };
  for (const k of Object.keys(out)) {
    if (typeof out[k] === 'string') out[k] = normalizarString(out[k]);
  }
  if (out.probabilidade !== undefined) out.probabilidade = coerceNumero(out.probabilidade);
  if (out.valor_estimado !== undefined) out.valor_estimado = coerceNumero(out.valor_estimado);
  return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validar(p, { criando }) {
  if (criando) {
    if (!p.nome || String(p.nome).trim().length < 3) {
      throw new ValidationError('O campo "nome" é obrigatório (mínimo 3 caracteres).');
    }
  } else if (p.nome !== undefined && (!p.nome || String(p.nome).trim().length < 3)) {
    throw new ValidationError('O campo "nome" não pode ficar vazio (mínimo 3 caracteres).');
  }

  if (p.tipo_pessoa !== undefined && p.tipo_pessoa !== null && !TIPOS_PESSOA.includes(p.tipo_pessoa)) {
    throw new ValidationError(`tipo_pessoa inválido. Valores aceitos: ${TIPOS_PESSOA.join(', ')}.`);
  }
  if (p.estagio !== undefined && p.estagio !== null && !ESTAGIOS.includes(p.estagio)) {
    throw new ValidationError(`estagio inválido. Valores aceitos: ${ESTAGIOS.join(', ')}.`);
  }
  if (p.origem_cadastro !== undefined && p.origem_cadastro !== null && !ORIGENS_CADASTRO.includes(p.origem_cadastro)) {
    throw new ValidationError(`origem_cadastro inválido. Valores aceitos: ${ORIGENS_CADASTRO.join(', ')}.`);
  }
  if (p.email !== undefined && p.email !== null && !EMAIL_RE.test(p.email)) {
    throw new ValidationError('E-mail em formato inválido.');
  }
  if (p.probabilidade !== undefined && p.probabilidade !== null) {
    if (!Number.isInteger(p.probabilidade) || p.probabilidade < 0 || p.probabilidade > 100) {
      throw new ValidationError('probabilidade deve ser um inteiro entre 0 e 100.');
    }
  }
  if (p.valor_estimado !== undefined && p.valor_estimado !== null) {
    if (typeof p.valor_estimado !== 'number' || Number.isNaN(p.valor_estimado) || p.valor_estimado < 0) {
      throw new ValidationError('valor_estimado deve ser um número maior ou igual a 0.');
    }
  }
}

async function registrarInteracaoInterna(tenantId, leadId, usuarioId, tipo, descricao) {
  try {
    await interacoesRepository.create(tenantId, {
      lead_id: leadId,
      usuario_id: usuarioId || null,
      tipo,
      descricao,
    });
  } catch (err) {
    // A interação é um efeito colateral de timeline; não deve derrubar a operação
    // principal (ex.: mover card). Loga com contexto e segue.
    console.error('[leadsService] falha ao registrar interação', {
      tenant_id: tenantId,
      lead_id: leadId,
      tipo,
      error: err.message,
    });
  }
}

async function criar(tenantId, input, usuario) {
  const payload = normalizarPayload(input || {});
  delete payload.id;
  delete payload.tenant_id;
  delete payload.criado_em;
  delete payload.atualizado_em;
  delete payload.status; // status só muda por marcarPerdido/reativar
  delete payload.motivo_perda;

  validar(payload, { criando: true });

  if (!payload.tipo_pessoa) payload.tipo_pessoa = 'PF';
  if (!payload.estagio) payload.estagio = 'prospectos';
  if (!payload.origem_cadastro) payload.origem_cadastro = 'manual';
  // dono padrão = usuário logado (nunca vem do body).
  payload.dono_id = usuario ? usuario.id : null;
  // probabilidade padrão do estágio, se não informada.
  if (payload.probabilidade === undefined || payload.probabilidade === null) {
    payload.probabilidade = ESTAGIO_PROBABILIDADE[payload.estagio];
  }

  let lead;
  try {
    lead = await leadsRepository.create(tenantId, payload);
  } catch (err) {
    console.error('[leadsService.criar] erro ao inserir lead', {
      tenant_id: tenantId,
      error: err.message,
    });
    throw err;
  }

  const via = lead.origem_cadastro === 'pdf' ? 'importado de proposta PDF' : 'cadastrado';
  await registrarInteracaoInterna(
    tenantId,
    lead.id,
    usuario && usuario.id,
    'sistema',
    `Lead ${via}${usuario && usuario.nome ? ` por ${usuario.nome}` : ''}.`
  );

  return lead;
}

async function listar(tenantId, filtros, user) {
  const donoIds = user ? await resolverDonoIds(user, 'leads', 'ler') : null;
  return leadsRepository.list(tenantId, { ...filtros, donoIds });
}

// Busca o lead garantindo tenant E escopo hierárquico do usuário.
// Fora do escopo => 404 (não vaza existência de lead alheio).
async function obterPorId(tenantId, id, user, acao = 'ler') {
  const lead = await leadsRepository.findById(tenantId, id);
  if (!lead) throw new NotFoundError('Lead não encontrado.');
  if (user) {
    const donoIds = await resolverDonoIds(user, 'leads', acao);
    if (!donoPermitido(donoIds, lead.dono_id)) throw new NotFoundError('Lead não encontrado.');
  }
  return lead;
}

async function listarInteracoes(tenantId, id, user) {
  await obterPorId(tenantId, id, user); // garante tenant + escopo
  return interacoesRepository.listByLead(tenantId, id);
}

// Aviso de duplicidade por telefone (não bloqueia — o frontend decide).
async function checarDuplicidadeTelefone(tenantId, telefone) {
  if (!telefone) return [];
  return leadsRepository.findByTelefone(tenantId, telefone);
}

async function atualizar(tenantId, id, input, user) {
  await obterPorId(tenantId, id, user, 'escrever'); // tenant + escopo

  const payload = normalizarPayload(input || {});
  delete payload.id;
  delete payload.tenant_id;
  delete payload.criado_em;
  delete payload.atualizado_em;
  delete payload.dono_id; // dono não muda por edição comum
  delete payload.status; // status tem endpoint próprio
  delete payload.motivo_perda;
  delete payload.estagio; // estágio tem endpoint próprio (funil)

  validar(payload, { criando: false });

  const atualizado = await leadsRepository.update(tenantId, id, payload);
  if (!atualizado) throw new NotFoundError('Lead não encontrado.');
  return atualizado;
}

// ---- Funil: mover o card entre estágios --------------------------------------
async function mudarEstagio(tenantId, id, novoEstagio, usuario) {
  if (!ESTAGIOS.includes(novoEstagio)) {
    throw new ValidationError(`estagio inválido. Valores aceitos: ${ESTAGIOS.join(', ')}.`);
  }
  const lead = await obterPorId(tenantId, id, usuario, 'escrever'); // tenant + escopo

  if (lead.estagio === novoEstagio) return lead; // no-op

  // NOTA: mover para 'venda_concluida' pela UI abre o modal de venda, e a venda
  // é criada pelo módulo de vendas (endpoint próprio), que também seta o estágio.
  // Aqui a mudança direta é permitida (drag), mas não cria venda por si só.
  const atualizado = await leadsRepository.update(tenantId, id, {
    estagio: novoEstagio,
    probabilidade: ESTAGIO_PROBABILIDADE[novoEstagio],
  });

  await registrarInteracaoInterna(
    tenantId,
    id,
    usuario && usuario.id,
    'mudanca_estagio',
    `Movido de ${ESTAGIO_LABEL[lead.estagio]} para ${ESTAGIO_LABEL[novoEstagio]}.`
  );

  return atualizado;
}

// ---- Registrar contato/interação manual --------------------------------------
async function registrarInteracao(tenantId, id, input, usuario) {
  await obterPorId(tenantId, id, usuario, 'escrever'); // tenant + escopo

  const tipo = (input && input.tipo) || 'nota';
  if (!TIPOS_INTERACAO.includes(tipo)) {
    throw new ValidationError(`tipo de interação inválido. Valores aceitos: ${TIPOS_INTERACAO.join(', ')}.`);
  }
  const descricao = normalizarString(input && input.descricao);

  const interacao = await interacoesRepository.create(tenantId, {
    lead_id: id,
    usuario_id: usuario && usuario.id,
    tipo,
    descricao,
  });

  // registrar contato atualiza o "último contato" do lead.
  await leadsRepository.update(tenantId, id, { ultimo_contato_em: new Date().toISOString() });

  return interacao;
}

// ---- Status do lead: perder / reativar ---------------------------------------
async function mudarStatus(tenantId, id, novoStatus, motivo, usuario) {
  if (!STATUS_LEAD.includes(novoStatus)) {
    throw new ValidationError(`status inválido. Valores aceitos: ${STATUS_LEAD.join(', ')}.`);
  }
  const lead = await obterPorId(tenantId, id, usuario, 'escrever'); // tenant + escopo

  const patch = { status: novoStatus };
  patch.motivo_perda = novoStatus === 'perdido' ? normalizarString(motivo) : null;

  const atualizado = await leadsRepository.update(tenantId, id, patch);

  const texto =
    novoStatus === 'perdido'
      ? `Lead marcado como perdido${patch.motivo_perda ? `: ${patch.motivo_perda}` : ''}.`
      : 'Lead reativado.';
  await registrarInteracaoInterna(tenantId, id, usuario && usuario.id, 'sistema', texto);

  return atualizado;
}

module.exports = {
  criar,
  listar,
  obterPorId,
  atualizar,
  mudarEstagio,
  registrarInteracao,
  listarInteracoes,
  mudarStatus,
  checarDuplicidadeTelefone,
  ESTAGIOS,
  ValidationError,
  NotFoundError,
};
