const { supabase } = require('../config/supabase');

// =============================================================================
// ⚠️⚠️ internalRepository — EXCEÇÃO AUTORIZADA À REGRA DE ISOLAMENTO ⚠️⚠️
//
// Este é o ÚNICO lugar do sistema que consulta `clientes` SEM filtrar por
// tenant_id. Serve exclusivamente ao PAINEL INTERNO da equipe Fideliza
// (role funcionario/admin, status ativo), para controle interno cross-tenant.
// Decisão do Pedro — 20/07/2026. Ver CLAUDE.md.
//
// PROTEÇÃO: só pode ser chamado por trás do middleware `requireInternal`.
// NÃO copiar este padrão para nenhum outro repositório. Em qualquer outro
// lugar, query sem tenant_id continua sendo bug.
// =============================================================================

// Lista clientes de TODOS os tenants, com o nome do corretor (tenant) embutido.
// NOTA (20/07/2026): a projeção foi ESTENDIDA (não reescrita) para alimentar os
// cards do Kanban do painel interno — data_inicio_plano (data de implementação),
// carencia_meses e qtd_dependentes (vidas). Continua sendo a única leitura
// cross-tenant do sistema, ainda contida neste arquivo e atrás de requireInternal.
async function listAllClientes(filters = {}) {
  let query = supabase
    .from('clientes')
    .select(
      'id, tenant_id, nome, operadora, telefone_whatsapp, email, tipo_plano, ' +
        'status, score_completude, criado_em, ' +
        'data_inicio_plano, carencia_meses, qtd_dependentes, ' +
        'tenant:tenants(id, nome, email)'
    );

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.operadora) query = query.eq('operadora', filters.operadora);
  if (filters.incompletos) query = query.lt('score_completude', 60);
  if (filters.tenantId) query = query.eq('tenant_id', filters.tenantId);

  query = query.order('criado_em', { ascending: false }).limit(500);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Resumo agregado por corretor para o topo do painel.
// IMPORTANTE: a lista de corretores vem de `users` (role 'corretor'), NÃO de
// `clientes` — assim um corretor recém-cadastrado, ainda SEM clientes, também
// aparece (com 0 clientes / 0%). A equipe de plataforma (funcionario/admin)
// fica de fora naturalmente, por não ter role 'corretor'.
// Leitura cross-tenant contida neste arquivo sancionado (atrás de requireInternal).
async function resumoPorTenant() {
  // 1) Todos os corretores (cada um dono do seu tenant).
  const { data: corretores, error: uErr } = await supabase
    .from('users')
    .select('tenant_id, nome, email, criado_em')
    .eq('role', 'corretor');
  if (uErr) throw uErr;

  // 2) Clientes, para agregar contagem/score por tenant.
  const { data: clientes, error: cErr } = await supabase
    .from('clientes')
    .select('tenant_id, score_completude');
  if (cErr) throw cErr;

  const agg = new Map(); // tenant_id -> { total, soma, incompletos }
  for (const row of clientes || []) {
    const k = row.tenant_id;
    if (!agg.has(k)) agg.set(k, { total: 0, soma: 0, incompletos: 0 });
    const a = agg.get(k);
    a.total += 1;
    a.soma += row.score_completude || 0;
    if ((row.score_completude || 0) < 60) a.incompletos += 1;
  }

  const vistos = new Set();
  const out = [];
  for (const c of corretores || []) {
    if (vistos.has(c.tenant_id)) continue; // 1 linha por tenant
    vistos.add(c.tenant_id);
    const a = agg.get(c.tenant_id) || { total: 0, soma: 0, incompletos: 0 };
    out.push({
      tenant_id: c.tenant_id,
      corretor: c.nome || c.email || '—',
      total_clientes: a.total,
      score_medio: a.total ? Math.round(a.soma / a.total) : 0,
      incompletos: a.incompletos,
    });
  }

  out.sort((x, y) => x.corretor.localeCompare(y.corretor, 'pt-BR'));
  return out;
}

// Contagem de disparos por cliente e por canal (WhatsApp/e-mail), para o card
// do Kanban. Leitura cross-tenant — vive AQUI (arquivo sancionado) de propósito.
// Em Fase 1 a tabela historico_disparos está vazia (disparos são Fase 2/3), então
// o retorno costuma ser {} — o card mostra 0/0 até os disparos existirem.
// Se filters.tenantId vier, restringe ao corretor (Kanban é sempre por corretor).
async function contagemDisparos(filters = {}) {
  let query = supabase.from('historico_disparos').select('cliente_id, canal');
  if (filters.tenantId) query = query.eq('tenant_id', filters.tenantId);

  const { data, error } = await query;
  if (error) throw error;

  const mapa = {};
  for (const row of data || []) {
    if (!row.cliente_id) continue;
    if (!mapa[row.cliente_id]) mapa[row.cliente_id] = { whatsapp: 0, email: 0 };
    if (row.canal === 'whatsapp') mapa[row.cliente_id].whatsapp += 1;
    else if (row.canal === 'email') mapa[row.cliente_id].email += 1;
  }
  return mapa;
}

module.exports = { listAllClientes, resumoPorTenant, contagemDisparos };
