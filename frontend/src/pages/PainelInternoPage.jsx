import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import ScoreBadge from '../components/ScoreBadge';

const STATUS_LABELS = { ativo: 'Ativo', inadimplente: 'Inadimplente', cancelado: 'Cancelado' };

export default function PainelInternoPage() {
  const { profile, signOut } = useAuth();
  const isAdmin = profile && profile.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-brand-navy">
      <header className="bg-white shadow-sm dark:bg-white/5 dark:shadow-none dark:ring-1 dark:ring-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Logo variant="colorida" size={36} className="dark:hidden" />
            <Logo variant="negativo" size={36} className="hidden dark:block" />
            <span className="rounded-full bg-brand-amber/15 px-2.5 py-0.5 text-xs font-medium text-brand-amber">
              Painel interno
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-500 dark:text-gray-300 sm:inline">
              {profile ? profile.nome || profile.email : ''}
            </span>
            <ThemeToggle />
            <button
              type="button"
              onClick={signOut}
              className="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-6">
        {isAdmin && <AprovacoesSection />}
        <RelatorioSection />
      </main>
    </div>
  );
}

// --- Aprovação de funcionários (só admin) -----------------------------------
function AprovacoesSection() {
  const [pendentes, setPendentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listarPendentes();
      setPendentes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Erro ao carregar pendências.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function decidir(id, acao) {
    setActing(id);
    setError('');
    try {
      if (acao === 'aprovar') await api.aprovarFuncionario(id);
      else await api.recusarFuncionario(id);
      setPendentes((lista) => lista.filter((p) => p.id !== id));
    } catch (err) {
      setError(err.message || 'Não foi possível concluir a ação.');
    } finally {
      setActing(null);
    }
  }

  return (
    <section>
      <h2 className="mb-3 font-heading text-lg font-semibold text-brand-navy dark:text-white">
        Aprovações pendentes
      </h2>

      {error && (
        <p className="mb-3 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Carregando...</p>
      ) : pendentes.length === 0 ? (
        <div className="rounded-lg bg-white p-6 text-center text-sm text-gray-500 shadow-sm dark:bg-white/5 dark:text-gray-400 dark:ring-1 dark:ring-white/10">
          Nenhum funcionário aguardando aprovação. 🎉
        </div>
      ) : (
        <ul className="space-y-2">
          {pendentes.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-brand-navy dark:text-white">
                  {p.nome || '(sem nome)'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{p.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={acting === p.id}
                  onClick={() => decidir(p.id, 'aprovar')}
                  className="rounded-md bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-dark disabled:opacity-60"
                >
                  Aprovar
                </button>
                <button
                  type="button"
                  disabled={acting === p.id}
                  onClick={() => decidir(p.id, 'recusar')}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/10"
                >
                  Recusar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// --- Relatório de clientes cross-tenant -------------------------------------
function RelatorioSection() {
  const [clientes, setClientes] = useState([]);
  const [resumo, setResumo] = useState([]);
  const [somenteIncompletos, setSomenteIncompletos] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const carregar = useCallback(async (incompletos) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.relatorioClientes({ incompletos });
      setClientes(Array.isArray(data.clientes) ? data.clientes : []);
      setResumo(Array.isArray(data.resumo) ? data.resumo : []);
    } catch (err) {
      setError(err.message || 'Erro ao carregar o relatório.');
      setClientes([]);
      setResumo([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar(somenteIncompletos);
  }, [carregar, somenteIncompletos]);

  const tabBase = 'rounded-md px-3 py-1.5 text-sm font-medium';
  const tabActive = 'bg-brand-blue text-white';
  const tabInactive =
    'bg-white text-gray-600 border border-gray-300 hover:bg-gray-100 ' +
    'dark:bg-white/5 dark:text-gray-300 dark:border-white/15 dark:hover:bg-white/10';

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold text-brand-navy dark:text-white">
          Clientes de todos os corretores
        </h2>
        <div className="flex gap-2" role="tablist" aria-label="Filtro do relatório">
          <button
            type="button"
            role="tab"
            aria-selected={!somenteIncompletos}
            onClick={() => setSomenteIncompletos(false)}
            className={`${tabBase} ${!somenteIncompletos ? tabActive : tabInactive}`}
          >
            Todos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={somenteIncompletos}
            onClick={() => setSomenteIncompletos(true)}
            className={`${tabBase} ${somenteIncompletos ? tabActive : tabInactive}`}
          >
            Incompletos
          </button>
        </div>
      </div>

      {/* Resumo por corretor */}
      {resumo.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {resumo.map((t) => (
            <div
              key={t.tenant_id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5"
            >
              <p className="truncate text-sm font-medium text-brand-navy dark:text-white">
                {t.corretor}
              </p>
              <div className="mt-2 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                <span>{t.total_clientes} clientes</span>
                <span>{t.incompletos} incompletos</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-white/10">
                  <div
                    className="h-1.5 rounded-full bg-brand-blue"
                    style={{ width: `${t.score_medio}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t.score_medio}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => carregar(somenteIncompletos)}
            className="font-semibold underline"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-gray-500 dark:text-gray-400">Carregando...</p>
      ) : clientes.length === 0 && !error ? (
        <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow-sm dark:bg-white/5 dark:text-gray-400 dark:ring-1 dark:ring-white/10">
          Nenhum cliente encontrado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Corretor</th>
                <th className="px-4 py-3 font-medium">Operadora</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/10">
              {clientes.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-brand-navy dark:text-white">{c.nome}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {c.tenant ? c.tenant.nome : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {c.operadora || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {STATUS_LABELS[c.status] || c.status}
                  </td>
                  <td className="px-4 py-3">
                    <ScoreBadge score={c.score_completude} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
