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

// Resumo agregado por corretor (tenant) para o topo do painel.
async function resumoPorTenant() {
  const { data, error } = await supabase
    .from('clientes')
    .select('tenant_id, score_completude, status, tenant:tenants(nome)');

  if (error) throw error;

  const mapa = new Map();
  for (const row of data || []) {
    const key = row.tenant_id;
    if (!mapa.has(key)) {
      mapa.set(key, {
        tenant_id: key,
        corretor: row.tenant ? row.tenant.nome : '—',
        total_clientes: 0,
        soma_score: 0,
        incompletos: 0,
      });
    }
    const acc = mapa.get(key);
    acc.total_clientes += 1;
    acc.soma_score += row.score_completude || 0;
    if ((row.score_completude || 0) < 60) acc.incompletos += 1;
  }

  return Array.from(mapa.values()).map((t) => ({
    tenant_id: t.tenant_id,
    corretor: t.corretor,
    total_clientes: t.total_clientes,
    score_medio: t.total_clientes ? Math.round(t.soma_score / t.total_clientes) : 0,
    incompletos: t.incompletos,
  }));
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
