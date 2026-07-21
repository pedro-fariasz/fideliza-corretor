// =============================================================================
// posvendasEngine — núcleo PURO da esteira de pós-venda (sem banco), testável.
//
// Decide em que etapa uma apólice está AGORA a partir dos gatilhos configurados,
// renderiza templates com variáveis e sugere cross-sell. O posvendasService
// orquestra isso com o banco; a matemática/regra de tempo mora aqui.
// =============================================================================

const JANELA_ANIVERSARIO_DIAS = 15; // por quantos dias a etapa de Aniversário fica "ativa" após a data

const ISO = (d) => String(d).slice(0, 10);

// Soma dias a 'YYYY-MM-DD' e devolve 'YYYY-MM-DD' (UTC, sem fuso).
function addDays(dataISO, dias) {
  const [a, m, d] = ISO(dataISO).split('-').map(Number);
  const base = new Date(Date.UTC(a, m - 1, d));
  base.setUTCDate(base.getUTCDate() + Number(dias || 0));
  return base.toISOString().slice(0, 10);
}

// Diferença em dias inteiros (ateISO - deISO).
function diasEntre(deISO, ateISO) {
  const [a1, m1, d1] = ISO(deISO).split('-').map(Number);
  const [a2, m2, d2] = ISO(ateISO).split('-').map(Number);
  const t1 = Date.UTC(a1, m1 - 1, d1);
  const t2 = Date.UTC(a2, m2 - 1, d2);
  return Math.round((t2 - t1) / 86400000);
}

// Ocorrência mais recente do aniversário em relação a hoje (este ano se já
// passou, senão a do ano passado). Retorna 'YYYY-MM-DD' ou null.
function aniversarioMaisRecente(dataNascimento, hojeISO) {
  if (!dataNascimento) return null;
  const [, mes, dia] = ISO(dataNascimento).split('-').map(Number);
  const anoHoje = Number(ISO(hojeISO).slice(0, 4));
  const desteAno = `${anoHoje}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  if (desteAno <= ISO(hojeISO)) return desteAno;
  return `${anoHoje - 1}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// Data do gatilho de uma etapa para uma apólice. Retorna 'YYYY-MM-DD' ou null.
function gatilhoData(etapa, { dataInicio, dataVencimento, dataNascimento }, hojeISO) {
  switch (etapa.gatilho_tipo) {
    case 'venda':
    case 'renovacao':
      return dataInicio ? addDays(dataInicio, etapa.gatilho_dias) : null;
    case 'vencimento':
      return dataVencimento ? addDays(dataVencimento, etapa.gatilho_dias) : null;
    case 'aniversario': {
      const aniv = aniversarioMaisRecente(dataNascimento, hojeISO);
      return aniv ? addDays(aniv, etapa.gatilho_dias) : null;
    }
    default:
      return null;
  }
}

// Etapa atual = a etapa ATIVA cujo gatilho já disparou (data <= hoje) com a
// MAIOR data de gatilho. Aniversário só conta dentro da janela recente.
// Retorna a etapa (com _gatilho_data) ou null se nada disparou ainda.
function calcularEtapaAtual({ dataInicio, dataVencimento, dataNascimento, etapas, hoje }) {
  const h = ISO(hoje || new Date().toISOString());
  const ctx = { dataInicio, dataVencimento, dataNascimento };
  let atual = null;

  for (const etapa of etapas) {
    if (etapa.ativo === false) continue;
    const data = gatilhoData(etapa, ctx, h);
    if (!data || data > h) continue; // ainda não disparou

    if (etapa.gatilho_tipo === 'aniversario') {
      const dias = diasEntre(data, h);
      if (dias < 0 || dias > JANELA_ANIVERSARIO_DIAS) continue; // fora da janela
    }

    if (
      !atual ||
      data > atual._gatilho_data ||
      (data === atual._gatilho_data && (etapa.ordem || 0) > (atual.ordem || 0))
    ) {
      atual = { ...etapa, _gatilho_data: data };
    }
  }
  return atual;
}

// % de progresso na esteira = posição da etapa atual entre as ativas (por ordem).
function progresso(etapaAtual, etapas) {
  const ativas = etapas.filter((e) => e.ativo !== false).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  if (!etapaAtual || ativas.length === 0) return 0;
  const idx = ativas.findIndex((e) => e.chave === etapaAtual.chave);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / ativas.length) * 100);
}

// Substitui [NOME], [PRODUTO], [VENCIMENTO], [VALOR], [CORRETOR] pelo valor.
// Chaves ausentes viram '' para não vazar '[VAR]' na mensagem final.
function renderTemplate(texto, vars = {}) {
  if (!texto) return '';
  return texto.replace(/\[([A-ZÀ-Ú_]+)\]/g, (m, chave) => {
    const v = vars[chave];
    return v == null ? '' : String(v);
  });
}

// Cross-sell: produtos ativos da conta que o cliente ainda NÃO possui, ordenados
// por comissão potencial (percentual desc). Recebe os produtos da conta e o
// conjunto de produto_ids que o cliente já tem.
function sugerirCrossSell(produtosConta, produtoIdsDoCliente) {
  const tem = new Set(produtoIdsDoCliente || []);
  return (produtosConta || [])
    .filter((p) => p.ativo !== false && !tem.has(p.id))
    .sort((a, b) => Number(b.percentual || 0) - Number(a.percentual || 0));
}

module.exports = {
  JANELA_ANIVERSARIO_DIAS,
  addDays,
  diasEntre,
  aniversarioMaisRecente,
  gatilhoData,
  calcularEtapaAtual,
  progresso,
  renderTemplate,
  sugerirCrossSell,
};
