// =============================================================================
// Métricas derivadas da carteira do corretor (calculadas no frontend a partir
// de GET /api/clientes). São só de LEITURA/agregação — o score em si vem sempre
// calculado pelo backend (score_completude).
// =============================================================================

// Dias corridos desde uma data ISO (ou null se a data não existir/for inválida).
export function diasDesde(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const ms = Date.now() - d.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// Aniversário do plano (reajuste) cai no mês de referência? Compara só o mês
// de data_inicio_plano, independente do ano.
export function renovaEsteMes(cliente, ref = new Date()) {
  if (!cliente.data_inicio_plano) return false;
  const d = new Date(cliente.data_inicio_plano);
  if (Number.isNaN(d.getTime())) return false;
  return d.getUTCMonth() === ref.getUTCMonth();
}

// Contadores do topo do "Início".
export function resumoCarteira(clientes) {
  const ref = new Date();
  let ativos = 0;
  let inadimplentes = 0;
  let incompletos = 0;
  const renovacoes = [];

  for (const c of clientes) {
    if (c.status === 'ativo') ativos += 1;
    if (c.status === 'inadimplente') inadimplentes += 1;
    if ((c.score_completude ?? 0) < 60) incompletos += 1;
    if (renovaEsteMes(c, ref)) renovacoes.push(c);
  }

  return {
    total: clientes.length,
    ativos,
    inadimplentes,
    incompletos,
    renovacoes, // lista de clientes que renovam no mês
  };
}

// Pendências agrupadas por urgência (para a tela "Pendências").
export function pendenciasPorUrgencia(clientes) {
  const urgente = [];
  const atencao = [];

  for (const c of clientes) {
    const score = c.score_completude ?? 0;
    const dias = diasDesde(c.ultimo_contato_em);

    // Cadastro incompleto: < 40% suspende alertas (urgente); 40–59% é atenção.
    if (score < 40) {
      urgente.push({ cliente: c, motivo: `Cadastro em ${score}% — alertas suspensos`, tipo: 'cadastro' });
    } else if (score < 60) {
      atencao.push({ cliente: c, motivo: `Cadastro em ${score}% — completar dados`, tipo: 'cadastro' });
    }

    // Contato: nunca registrado ou > 60 dias.
    if (dias === null) {
      atencao.push({ cliente: c, motivo: 'Sem contato registrado', tipo: 'contato' });
    } else if (dias > 60) {
      atencao.push({ cliente: c, motivo: `Último contato há ${dias} dias`, tipo: 'contato' });
    }
  }

  return { urgente, atencao };
}
