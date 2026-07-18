// =============================================================================
// api — todas as chamadas de dados passam pelo backend (Railway), sempre com
// o access_token do usuário logado no header Authorization.
// O tenant_id NUNCA é enviado pelo frontend: o backend o extrai do JWT.
// =============================================================================
import { supabase } from './supabaseClient';

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error(
    'Configuração ausente: defina VITE_API_URL no arquivo frontend/.env (veja o .env.example).'
  );
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new ApiError('Sessão expirada. Faça login novamente.', 401);
  }
  return data.session.access_token;
}

async function request(path, options = {}) {
  const token = await getAccessToken();

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
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
    throw new ApiError(message, response.status);
  }

  return body;
}

export const api = {
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
};
