// =============================================================================
// api — todas as chamadas de dados passam pelo backend (Railway), sempre com
// o access_token do usuário logado no header Authorization.
// O tenant_id NUNCA é enviado pelo frontend: o backend o extrai do JWT.
//
// Módulos adicionados no PR 9 (jul/2026) — em sua maioria reutilizam endpoints
// já existentes, sem inventar backend:
//   - Início:        usa /notificacoes/pendentes, /notificacoes/badge, /dashboard
//   - Clientes:      usa /carteira (rota mantida; label visível "Clientes"),
//                    /carteira/:id/cancelar
//   - Inteligência:  usa /atividades (novo neste PR), /bi-carteira, /desempenho,
//                    /leads (existentes)
//   - Plataformas:   usa /plataformas (CRUD)
// =============================================================================
import { supabase } from './supabaseClient';

const API_URL = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Verificação em tempo de USO (não no import), para uma env faltando não
// derrubar a página inteira em tela branca.
function apiBase() {
  if (!API_URL) {
    throw new ApiError(
      'Configuração ausente: VITE_API_URL não foi definida no build do frontend.',
      0
    );
  }
  return API_URL;
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new ApiError('Sessão expirada. Faça login novamente.', 401);
  }
  return data.session.access_token;
}

// Chamada crua (sem token) — usada só nos cadastros públicos.
async function publicRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      'Não foi possível conectar à API. Verifique sua internet ou se o backend está no ar.',
      0
    );
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // sem corpo JSON
  }

  if (!response.ok) {
    const message =
      (body && body.error) || `Erro inesperado da API (HTTP ${response.status}).`;
    const err = new ApiError(message, response.status);
    if (body && body.status) err.userStatus = body.status;
    throw err;
  }

  return body;
}

// Upload multipart (PDF): sem Content-Type manual — o browser define o
// boundary do multipart/form-data sozinho.
async function requestFormData(path, formData) {
  const token = await getAccessToken();

  let response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
  } catch {
    throw new ApiError(
      'Não foi possível conectar à API. Verifique sua internet ou se o backend está no ar.',
      0
    );
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // sem corpo JSON
  }

  if (!response.ok) {
    const message = (body && body.error) || `Erro inesperado da API (HTTP ${response.status}).`;
    throw new ApiError(message, response.status);
  }

  return body;
}

async function request(path, options = {}) {
  const token = await getAccessToken();

  let response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      'Não foi possível conectar à API. Verifique sua internet ou se o backend está no ar.',
      0
    );
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // resposta sem corpo JSON — tratado abaixo pelo status
  }

  if (!response.ok) {
    const message =
      (body && body.error) || `Erro inesperado da API (HTTP ${response.status}).`;
    const err = new ApiError(message, response.status);
    if (body && body.status) err.userStatus = body.status;
    throw err;
  }

  return body;
}

export const api = {
  // --- Autenticação ---------------------------------------------------------
  me() {
    return request('/api/auth/me');
  },

  signupCorretor(payload) {
    return publicRequest('/api/auth/signup/corretor', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  signupEquipe(payload) {
    return publicRequest('/api/auth/signup/equipe', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // --- Carteira do corretor -------------------------------------------------
  listarClientes({ incompletos = false } = {}) {
    const query = incompletos ? '?incompletos=true' : '';
    return request(`/api/clientes${query}`);
  },

  criarCliente(payload) {
    return request('/api/clientes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // --- Painel interno (equipe) ----------------------------------------------
  listarPendentes() {
    return request('/api/admin/equipe/pendentes');
  },

  aprovarFuncionario(id) {
    return request(`/api/admin/equipe/${id}/aprovar`, { method: 'POST' });
  },

  recusarFuncionario(id) {
    return request(`/api/admin/equipe/${id}/recusar`, { method: 'POST' });
  },

  relatorioClientes(params = {}) {
    const qs = new URLSearchParams();
    if (params.incompletos) qs.set('incompletos', 'true');
    if (params.status) qs.set('status', params.status);
    if (params.operadora) qs.set('operadora', params.operadora);
    if (params.tenantId) qs.set('tenant_id', params.tenantId);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/api/admin/relatorio/clientes${query}`);
  },

  // --- Painel interno v2 (/api/interno/*) -----------------------------------
  internoResumo() {
    return request('/api/interno/resumo');
  },

  internoClientes(params = {}) {
    const qs = new URLSearchParams();
    if (params.incompletos) qs.set('incompletos', 'true');
    if (params.status) qs.set('status', params.status);
    if (params.operadora) qs.set('operadora', params.operadora);
    if (params.tenantId) qs.set('tenantId', params.tenantId);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/api/interno/clientes${query}`);
  },

  // =========================================================================
  // CRM de vendas (MVP)
  // =========================================================================

  // --- Dashboard ------------------------------------------------------------
  dashboard(params = {}) {
    return request(`/api/dashboard${toQuery(params)}`);
  },

  // --- Produtos -------------------------------------------------------------
  listarProdutos(params = {}) {
    return request(`/api/produtos${toQuery(params)}`);
  },
  criarProduto(payload) {
    return request('/api/produtos', { method: 'POST', body: JSON.stringify(payload) });
  },
  atualizarProduto(id, payload) {
    return request(`/api/produtos/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  desativarProduto(id) {
    return request(`/api/produtos/${id}`, { method: 'DELETE' });
  },

  // --- Leads + funil --------------------------------------------------------
  listarLeads(params = {}) {
    return request(`/api/leads${toQuery(params)}`);
  },
  criarLead(payload) {
    return request('/api/leads', { method: 'POST', body: JSON.stringify(payload) });
  },
  obterLead(id) {
    return request(`/api/leads/${id}`);
  },
  atualizarLead(id, payload) {
    return request(`/api/leads/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  mudarEstagio(id, estagio) {
    return request(`/api/leads/${id}/estagio`, {
      method: 'PATCH',
      body: JSON.stringify({ estagio }),
    });
  },
  mudarStatusLead(id, status, motivo_perda) {
    return request(`/api/leads/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, motivo_perda }),
    });
  },
  listarInteracoes(id) {
    return request(`/api/leads/${id}/interacoes`);
  },
  registrarInteracao(id, payload) {
    return request(`/api/leads/${id}/interacoes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // --- Vendas ---------------------------------------------------------------
  listarVendas(params = {}) {
    return request(`/api/vendas${toQuery(params)}`);
  },
  criarVenda(payload) {
    return request('/api/vendas', { method: 'POST', body: JSON.stringify(payload) });
  },
  obterVenda(id) {
    return request(`/api/vendas/${id}`);
  },
  cancelarVenda(id) {
    return request(`/api/vendas/${id}/cancelar`, { method: 'PATCH' });
  },

  // --- Comissões ------------------------------------------------------------
  listarComissoes(params = {}) {
    return request(`/api/comissoes${toQuery(params)}`);
  },
  receberComissao(id, data_recebida) {
    return request(`/api/comissoes/${id}/receber`, {
      method: 'PATCH',
      body: JSON.stringify({ data_recebida }),
    });
  },
  estornarComissao(id) {
    return request(`/api/comissoes/${id}/estornar`, { method: 'PATCH' });
  },

  // --- Agenda ---------------------------------------------------------------
  listarAgenda(params = {}) {
    return request(`/api/agenda${toQuery(params)}`);
  },
  criarCompromisso(payload) {
    return request('/api/agenda', { method: 'POST', body: JSON.stringify(payload) });
  },
  atualizarCompromisso(id, payload) {
    return request(`/api/agenda/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  removerCompromisso(id) {
    return request(`/api/agenda/${id}`, { method: 'DELETE' });
  },

  // --- Equipe (gestão de usuários da conta — só administrador) --------------
  listarEquipe() {
    return request('/api/equipe');
  },
  criarCorretorEquipe(payload) {
    return request('/api/equipe/corretor', { method: 'POST', body: JSON.stringify(payload) });
  },
  criarSecretaria(payload) {
    return request('/api/equipe/secretaria', { method: 'POST', body: JSON.stringify(payload) });
  },
  editarUsuario(id, payload) {
    return request(`/api/equipe/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  desativarUsuario(id, transferirParaId) {
    return request(`/api/equipe/${id}/desativar`, {
      method: 'PATCH',
      body: JSON.stringify({ transferir_para_id: transferirParaId || null }),
    });
  },

  // --- Carteira (Fase 1) ----------------------------------------------------
  carteiraPipeline(params = {}) {
    return request(`/api/carteira/pipeline${toQuery(params)}`);
  },
  carteiraMetricas(params = {}) {
    return request(`/api/carteira/metricas${toQuery(params)}`);
  },
  carteiraListarClientes(params = {}) {
    return request(`/api/carteira/clientes${toQuery(params)}`);
  },
  carteiraSaudeDados() {
    return request('/api/carteira/saude-dados');
  },
  carteiraAtualizarCliente(id, payload) {
    return request(`/api/carteira/clientes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  // --- Arquivos (PDF de cotação/proposta) ------------------------------------
  uploadArquivo(tipo, file, leadId) {
    const fd = new FormData();
    fd.append('tipo', tipo);
    fd.append('arquivo', file);
    if (leadId) fd.append('lead_id', leadId);
    return requestFormData('/api/arquivos', fd);
  },
  listarArquivos(params = {}) {
    return request(`/api/arquivos${toQuery(params)}`);
  },
  obterApolice(id) {
    return request(`/api/carteira/apolices/${id}`);
  },
  criarNegocioAvulso(payload) {
    return request('/api/carteira/negocio-avulso', { method: 'POST', body: JSON.stringify(payload) });
  },
  renovarApolice(id, payload) {
    return request(`/api/carteira/apolices/${id}/renovar`, { method: 'POST', body: JSON.stringify(payload || {}) });
  },
  cancelarApolice(id, motivo) {
    return request(`/api/carteira/apolices/${id}/cancelar`, { method: 'PATCH', body: JSON.stringify({ motivo }) });
  },

  // --- Pós-Vendas (Fase 2) --------------------------------------------------
  posvendasCategorias() {
    return request('/api/posvendas/categorias');
  },
  posvendasPipeline(params = {}) {
    return request(`/api/posvendas/pipeline${toQuery(params)}`);
  },
  posvendasLista(params = {}) {
    return request(`/api/posvendas/lista${toQuery(params)}`);
  },
  posvendasMarcarFeito(apoliceId, observacao) {
    return request(`/api/posvendas/apolices/${apoliceId}/feito`, {
      method: 'POST',
      body: JSON.stringify({ observacao: observacao || null }),
    });
  },
  posvendasCrossSell(apoliceId) {
    return request(`/api/posvendas/apolices/${apoliceId}/cross-sell`);
  },
  posvendasMensagem(apoliceId, etapa) {
    return request(`/api/posvendas/apolices/${apoliceId}/mensagem${toQuery({ etapa })}`);
  },
  posvendasFluxo(categoria) {
    return request(`/api/posvendas/fluxos/${categoria}`);
  },
  posvendasCriarEtapa(categoria, payload) {
    return request(`/api/posvendas/fluxos/${categoria}/etapas`, { method: 'POST', body: JSON.stringify(payload) });
  },
  posvendasAtualizarEtapa(etapaId, payload) {
    return request(`/api/posvendas/etapas/${etapaId}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  posvendasRestaurarFluxo(categoria) {
    return request(`/api/posvendas/fluxos/${categoria}/restaurar`, { method: 'POST' });
  },
  posvendasMensagens(categoria) {
    return request(`/api/posvendas/mensagens/${categoria}`);
  },
  posvendasSalvarMensagem(categoria, etapa, texto) {
    return request(`/api/posvendas/mensagens/${categoria}/${etapa}`, { method: 'PUT', body: JSON.stringify({ texto }) });
  },
  posvendasRedefinirMensagem(categoria, etapa) {
    return request(`/api/posvendas/mensagens/${categoria}/${etapa}/redefinir`, { method: 'POST' });
  },

  // --- BI de Carteira / Inteligência (Fase 3) -------------------------------
  biCarteira(params = {}) {
    return request(`/api/bi-carteira${toQuery(params)}`);
  },
  biCarteiraCorretores() {
    return request('/api/bi-carteira/corretores');
  },

  // --- Desempenho de Equipe (Fase 4) ----------------------------------------
  desempenho(params = {}) {
    return request(`/api/desempenho${toQuery(params)}`);
  },
  desempenhoVendedores() {
    return request('/api/desempenho/vendedores');
  },

  // --- Atividades (feed da aba Inteligência) --------------------------------
  atividades(params = {}) {
    return request(`/api/atividades${toQuery(params)}`);
  },

  // --- Tenant atual (sidebar: aba Leads condicional a whatsapp_conectado) ---
  tenantMe() {
    return request('/api/tenants/me');
  },
  conectarWhatsapp(token) {
    return request('/api/tenants/me/whatsapp', { method: 'POST', body: JSON.stringify({ token }) });
  },
};

// Monta querystring a partir de um objeto, ignorando vazios/undefined.
function toQuery(params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}
