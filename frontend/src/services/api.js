// =============================================================================
// api — todas as chamadas de dados passam pelo backend (Railway), sempre com
// o access_token do usuário logado no header Authorization.
// O tenant_id NUNCA é enviado pelo frontend: o backend o extrai do JWT.
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
};
