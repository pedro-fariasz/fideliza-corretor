import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';

// Aprovação de funcionários (só admin). O FLUXO já existe (endpoints
// /api/admin/equipe/* + api.listarPendentes/aprovarFuncionario/recusarFuncionario);
// esta página apenas reaproveita esses mesmos chamados dentro do novo shell.
export default function AprovacoesPage() {
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
