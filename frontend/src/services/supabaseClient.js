// =============================================================================
// supabaseClient — usado SOMENTE para autenticação (Supabase Auth).
//
// REGRA CRÍTICA: nenhum dado de cliente é lido ou gravado direto no Supabase
// pelo frontend. Todo acesso a dados passa pela API do backend (services/api.js),
// que extrai o tenant_id do JWT e garante o isolamento entre corretores.
//
// Aqui entra APENAS a chave publishable/anon. A service role key é exclusiva
// do backend e NUNCA pode aparecer neste projeto.
// =============================================================================
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Configuração ausente: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo frontend/.env (veja o .env.example).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
