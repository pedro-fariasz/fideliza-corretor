import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabaseClient';
import { api } from '../../services/api';

const ROLE_LABELS = { corretor: 'Corretor', funcionario: 'Funcionário', admin: 'Administrador' };
const CARD = 'rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-white/5';
const MSG_TONE = {
  ok: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  erro: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
};

// Configurações do corretor: dados da conta + alterar senha + conexão WhatsApp.
// A senha é trocada direto no Supabase Auth (mesmo cliente usado no login),
// sem passar pelo backend.
export default function ConfiguracoesPage() {
  const { profile, tenant, refreshTenant } = useAuth();

  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null); // { tipo: 'ok'|'erro', texto }

  async function alterarSenha(e) {
    e.preventDefault();
    setMsg(null);

    if (senha.length < 8) {
      setMsg({ tipo: 'erro', texto: 'A senha deve ter ao menos 8 caracteres.' });
      return;
    }
    if (senha !== confirma) {
      setMsg({ tipo: 'erro', texto: 'As senhas não coincidem.' });
      return;
    }

    setSalvando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw new Error(error.message);
      setMsg({ tipo: 'ok', texto: 'Senha alterada com sucesso.' });
      setSenha('');
      setConfirma('');
    } catch (err) {
      setMsg({ tipo: 'erro', texto: err.message || 'Não foi possível alterar a senha.' });
    } finally {
      setSalvando(false);
    }
  }

  const [token, setToken] = useState('');
  const [conectando, setConectando] = useState(false);
  const [whatsappMsg, setWhatsappMsg] = useState(null); // { tipo: 'ok'|'erro', texto }

  async function conectarWhatsapp(e) {
    e.preventDefault();
    setWhatsappMsg(null);
    if (!token.trim()) {
      setWhatsappMsg({ tipo: 'erro', texto: 'Informe o token de acesso.' });
      return;
    }
    setConectando(true);
    try {
      await api.conectarWhatsapp(token.trim());
      setToken('');
      setWhatsappMsg({ tipo: 'ok', texto: 'WhatsApp conectado com sucesso.' });
      await refreshTenant();
    } catch (err) {
      setWhatsappMsg({ tipo: 'erro', texto: err.message || 'Não foi possível conectar o WhatsApp.' });
    } finally {
      setConectando(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors ' +
    'placeholder:text-gray-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/40 ' +
    'dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500';

  return (
    <div className="max-w-xl space-y-6">
      {/* Dados da conta */}
      <section style={{ '--rise-delay': '0ms' }} className={`${CARD} animate-rise p-5`}>
        <h2 className="mb-4 font-heading text-base font-semibold text-brand-navy dark:text-white">
          Dados da conta
        </h2>
        <dl className="space-y-3 text-sm">
          <Linha rotulo="Nome" valor={profile?.nome || '—'} />
          <Linha rotulo="E-mail" valor={profile?.email || '—'} />
          <Linha rotulo="Perfil" valor={ROLE_LABELS[profile?.role] || profile?.role || '—'} />
        </dl>
      </section>

      {/* Alterar senha */}
      <section style={{ '--rise-delay': '60ms' }} className={`${CARD} animate-rise p-5`}>
        <h2 className="mb-4 font-heading text-base font-semibold text-brand-navy dark:text-white">
          Alterar senha
        </h2>

        {msg && (
          <p className={`mb-3 rounded-lg px-3 py-2 text-sm ${MSG_TONE[msg.tipo]}`}>{msg.texto}</p>
        )}

        <form onSubmit={alterarSenha} className="space-y-3">
          <div>
            <label htmlFor="senha" className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
              Nova senha
            </label>
            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="new-password"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="confirma" className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
              Confirmar nova senha
            </label>
            <input
              id="confirma"
              type="password"
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
              autoComplete="new-password"
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={salvando}
            className="press rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-dark disabled:opacity-60"
          >
            {salvando ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      </section>

      {/* Conexão WhatsApp (API Meta) */}
      <section style={{ '--rise-delay': '120ms' }} className={`${CARD} animate-rise p-5`}>
        <h2 className="mb-1 font-heading text-base font-semibold text-brand-navy dark:text-white">
          Conexão WhatsApp (API Meta)
        </h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Conecte o número da corretora pela API oficial do WhatsApp (Meta Cloud API) para enviar
          mensagens direto dos leads e da carteira.
        </p>

        {tenant && tenant.whatsapp_conectado ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            WhatsApp conectado.
          </p>
        ) : (
          <>
            {whatsappMsg && (
              <p className={`mb-3 rounded-lg px-3 py-2 text-sm ${MSG_TONE[whatsappMsg.tipo]}`}>{whatsappMsg.texto}</p>
            )}
            <form onSubmit={conectarWhatsapp} className="space-y-3">
              <div>
                <label htmlFor="whatsapp-token" className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
                  Token de acesso
                </label>
                <input
                  id="whatsapp-token"
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Token da API oficial (Meta Cloud API)"
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={conectando}
                className="press rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-dark disabled:opacity-60"
              >
                {conectando ? 'Conectando...' : 'Conectar API Oficial'}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

function Linha({ rotulo, valor }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-gray-500 dark:text-gray-400">{rotulo}</dt>
      <dd className="truncate font-medium text-brand-navy dark:text-white">{valor}</dd>
    </div>
  );
}
