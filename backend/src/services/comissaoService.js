// =============================================================================
// Motor de cálculo de comissão — funções PURAS e testáveis.
// Regras: docs/PRD-fideliza-corretor.md §6.5 e docs/INSTRUCOES-PROJETO.md.
//
// Uma venda gera N parcelas de comissão, cada uma com sua data_prevista.
// No MVP a UI só usa beneficiario 'corretor' (a comissão dupla já está
// modelada no banco via a coluna `beneficiario`, mas fica escondida).
//
// Semântica do `valor` conforme o tipo de comissão:
//   * limitada  → `valor` é o valor total do negócio; a comissão total
//                 (valor * percentual%) é dividida em N parcelas.
//   * recorrente→ `valor` é a mensalidade; cada parcela vale
//                 (mensalidade * percentual%), repetida por 12 meses (limite MVP).
// =============================================================================

// Recorrente gera 12 parcelas iniciais; a renovação é manual depois (MVP).
const PARCELAS_RECORRENTE_MVP = 12;

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Soma `n` meses a (ano, mes 1..12) e devolve { ano, mes } normalizados.
function addMeses(ano, mes, n) {
  const total = (mes - 1) + n;
  const ajusteAno = Math.floor(total / 12);
  const mesFinal = ((total % 12) + 12) % 12; // 0..11
  return { ano: ano + ajusteAno, mes: mesFinal + 1 };
}

function isoDate(ano, mes, dia) {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// Aceita 'YYYY-MM-DD' (ou ISO com hora) ou Date; devolve componentes em UTC.
function parseData(dataVenda) {
  if (dataVenda instanceof Date) {
    return {
      ano: dataVenda.getUTCFullYear(),
      mes: dataVenda.getUTCMonth() + 1,
      dia: dataVenda.getUTCDate(),
    };
  }
  const [ano, mes, dia] = String(dataVenda).slice(0, 10).split('-').map(Number);
  return { ano, mes, dia };
}

// Divide a comissão total em N parcelas exatas em centavos.
// O resto de arredondamento vai na última parcela, para que a soma feche.
function dividirTotalEmParcelas(total, n) {
  const base = round2(total / n);
  const valores = new Array(n).fill(base);
  const somaAteAntepenultima = round2(base * (n - 1));
  valores[n - 1] = round2(total - somaAteAntepenultima);
  return valores;
}

// Componentes (ano, mes, dia) da PRIMEIRA parcela.
function primeiraParcelaData({ ano, mes, dia }, inicioPagamento, diaPagamento) {
  if (inicioPagamento === 'mesmo_mes') {
    // dia_pagamento do mês da venda; se esse dia já passou, joga pro mês seguinte.
    const base = dia > diaPagamento ? addMeses(ano, mes, 1) : { ano, mes };
    return { ano: base.ano, mes: base.mes, dia: diaPagamento };
  }
  // 'mes_seguinte' (default): dia 5 do mês seguinte à venda.
  const base = addMeses(ano, mes, 1);
  return { ano: base.ano, mes: base.mes, dia: 5 };
}

/**
 * Gera as parcelas de comissão de uma venda.
 * @returns {Array<{beneficiario,percentual,valor_parcela,num_parcela,total_parcelas,data_prevista,status}>}
 */
function calcularComissoes({ valor, dataVenda, produto, beneficiario = 'corretor' }) {
  if (produto == null) throw new Error('produto é obrigatório para calcular comissão.');

  const { tipo_comissao, percentual, parcelas_limite, inicio_pagamento, dia_pagamento } = produto;

  const valorNum = Number(valor);
  const percNum = Number(percentual);
  if (!(valorNum > 0)) throw new Error('valor da venda deve ser maior que zero.');
  if (!(percNum > 0)) throw new Error('percentual de comissão deve ser maior que zero.');

  const inicio = inicio_pagamento || 'mes_seguinte';
  const comp = parseData(dataVenda);
  const primeira = primeiraParcelaData(comp, inicio, dia_pagamento);

  const fracao = percNum / 100;

  let totalParcelas;
  let valores;
  if (tipo_comissao === 'recorrente') {
    totalParcelas = PARCELAS_RECORRENTE_MVP;
    const porParcela = round2(valorNum * fracao); // % da mensalidade, a cada mês
    valores = new Array(totalParcelas).fill(porParcela);
  } else if (tipo_comissao === 'limitada') {
    totalParcelas = Number(parcelas_limite);
    if (!Number.isInteger(totalParcelas) || totalParcelas < 1) {
      throw new Error('parcelas_limite inválido para comissão limitada.');
    }
    const comissaoTotal = round2(valorNum * fracao); // % do valor total do negócio
    valores = dividirTotalEmParcelas(comissaoTotal, totalParcelas);
  } else {
    throw new Error(`tipo_comissao inválido: ${tipo_comissao}`);
  }

  const parcelas = [];
  for (let i = 0; i < totalParcelas; i += 1) {
    const d = addMeses(primeira.ano, primeira.mes, i);
    parcelas.push({
      beneficiario,
      percentual: percNum,
      valor_parcela: valores[i],
      num_parcela: i + 1,
      total_parcelas: totalParcelas,
      data_prevista: isoDate(d.ano, d.mes, primeira.dia),
      status: 'projetada',
    });
  }
  return parcelas;
}

module.exports = {
  calcularComissoes,
  PARCELAS_RECORRENTE_MVP,
  // exportados para teste unitário:
  round2,
  addMeses,
  dividirTotalEmParcelas,
};
