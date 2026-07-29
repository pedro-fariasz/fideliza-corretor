// =============================================================================
// notificacoesGeradorService — os 3 crons diários que povoam a central de
// avisos: aniversário, boleto a vencer e follow-up de 7 dias pós-venda.
//
// Fuso: 'America/Sao_Paulo' fixo (sem coluna de fuso em tenants ainda). Brasil
// não observa horário de verão desde 2019, então o offset -03:00 é estável.
// =============================================================================
const carteiraClientesRepository = require('../repositories/carteiraClientesRepository');
const usersRepository = require('../repositories/usersRepository');
const notificacaoService = require('./notificacaoService');
const posvendasEngine = require('./posvendasEngine');

const FUSO_PADRAO = 'America/Sao_Paulo';
const OFFSET_FUSO_PADRAO = '-03:00';

const TEMPLATE_ANIVERSARIO =
  'Bom dia, {nome}! Passando aqui pra desejar um feliz aniversário pra você. ' +
  'Aproveita muito o seu dia. Um abraço, {nome_corretor}.';

const TEMPLATE_BOLETO =
  'Oi {nome}! Passando só pra lembrar que seu boleto do plano {operadora} vence dia ' +
  '{vencimento_boleto}. Qualquer coisa é só me chamar. — {nome_corretor}';

const TEMPLATE_FOLLOW_UP =
  'Oi {nome}, tudo certo? Faz uma semana que você está com o plano {operadora}. Queria só ' +
  'confirmar se está tudo funcionando bem — cartão, aplicativo, rede credenciada. Qualquer ' +
  'coisa me chama. — {nome_corretor}';

// 'YYYY-MM-DD' de hoje no fuso dado (Intl cuida da conversão de fuso).
function hojeNoFuso(fuso = FUSO_PADRAO) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// Instante (Date) de 'YYYY-MM-DD' às 'HH:mm' no fuso padrão.
function instanteNoFuso(dataISO, horaMinuto, offset = OFFSET_FUSO_PADRAO) {
  return new Date(`${dataISO}T${horaMinuto}:00${offset}`);
}

function isBissexto(ano) {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

// Compara mês/dia de nascimento com hoje. 29/fev "cai" em 28/fev nos anos
// não bissextos, pra quem nasceu em ano bissexto não ficar 4 anos sem aviso.
function ehAniversarioHoje(dataNascimentoISO, hojeISO) {
  if (!dataNascimentoISO) return false;
  const [, mesNascStr, diaNascStr] = String(dataNascimentoISO).slice(0, 10).split('-');
  const [anoHojeStr, mesHojeStr, diaHojeStr] = hojeISO.split('-');
  const mesNasc = Number(mesNascStr);
  const diaNasc = Number(diaNascStr);
  const anoHoje = Number(anoHojeStr);
  const mesHoje = Number(mesHojeStr);
  const diaHoje = Number(diaHojeStr);

  if (mesNasc === mesHoje && diaNasc === diaHoje) return true;
  if (mesNasc === 2 && diaNasc === 29 && !isBissexto(anoHoje) && mesHoje === 2 && diaHoje === 28) return true;
  return false;
}

// dia-do-mês do boleto que vence daqui a `dias` dias (com rollover de mês/ano).
function diaVencimentoDaquiA(hojeISO, dias) {
  const alvoISO = posvendasEngine.addDays(hojeISO, dias);
  return Number(alvoISO.split('-')[2]);
}

async function processarLote(tenantId, candidatos, montarNotificacao) {
  let criadas = 0;
  for (const cliente of candidatos) {
    try {
      const resultado = await notificacaoService.criarNotificacao(montarNotificacao(cliente));
      if (resultado.criada) criadas += 1;
    } catch (err) {
      console.error('[notificacoesGeradorService] falha ao gerar notificação (não-fatal)', {
        tenant_id: tenantId,
        cliente_id: cliente.id,
        error: err.message,
      });
    }
  }
  return { criadas };
}

async function gerarAniversario(tenantId) {
  const dono = await usersRepository.findCorretorDoTenant(tenantId);
  if (!dono) return { criadas: 0 };

  const hojeISO = hojeNoFuso();
  const candidatos = (await carteiraClientesRepository.listAniversariantes(tenantId)).filter((c) =>
    ehAniversarioHoje(c.data_nascimento, hojeISO)
  );

  return processarLote(tenantId, candidatos, (cliente) => ({
    tenant_id: tenantId,
    destinatario_id: dono.id,
    tipo: 'aniversario_cliente',
    cliente,
    titulo: `Aniversário de ${cliente.nome}`,
    template: TEMPLATE_ANIVERSARIO,
    agendada_para: instanteNoFuso(hojeISO, '09:00').toISOString(),
    origem_tipo: 'cron_aniversario',
  }));
}

async function gerarBoleto(tenantId) {
  const dono = await usersRepository.findCorretorDoTenant(tenantId);
  if (!dono) return { criadas: 0 };

  const hojeISO = hojeNoFuso();
  const diaAlvo = diaVencimentoDaquiA(hojeISO, 3);
  const candidatos = (await carteiraClientesRepository.listComBoletoConfigurado(tenantId)).filter(
    (c) => Number(c.vencimento_boleto) === diaAlvo
  );

  return processarLote(tenantId, candidatos, (cliente) => ({
    tenant_id: tenantId,
    destinatario_id: dono.id,
    tipo: 'boleto_disponivel',
    cliente,
    titulo: `Boleto de ${cliente.nome} vence em breve`,
    template: TEMPLATE_BOLETO,
    agendada_para: instanteNoFuso(hojeISO, '09:00').toISOString(),
    origem_tipo: 'cron_boleto',
  }));
}

async function gerarFollowUp(tenantId) {
  const dono = await usersRepository.findCorretorDoTenant(tenantId);
  if (!dono) return { criadas: 0 };

  const hojeISO = hojeNoFuso();
  const seteDiasAtrasISO = posvendasEngine.addDays(hojeISO, -7);
  const de = `${seteDiasAtrasISO}T00:00:00.000Z`;
  const ate = `${posvendasEngine.addDays(seteDiasAtrasISO, 1)}T00:00:00.000Z`;

  const candidatos = await carteiraClientesRepository.listNovosCriadosEntre(tenantId, de, ate);

  return processarLote(tenantId, candidatos, (cliente) => ({
    tenant_id: tenantId,
    destinatario_id: dono.id,
    tipo: 'follow_up_pos_venda',
    cliente,
    titulo: `Follow-up de 7 dias — ${cliente.nome}`,
    template: TEMPLATE_FOLLOW_UP,
    agendada_para: instanteNoFuso(hojeISO, '09:00').toISOString(),
    origem_tipo: 'cron_follow_up',
  }));
}

module.exports = {
  gerarAniversario,
  gerarBoleto,
  gerarFollowUp,
  // exportados pra teste unitário (puros, sem banco):
  hojeNoFuso,
  instanteNoFuso,
  isBissexto,
  ehAniversarioHoje,
  diaVencimentoDaquiA,
};
