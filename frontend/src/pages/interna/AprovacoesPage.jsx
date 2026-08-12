import { useCallback, useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { api } from '../../services/api';
import EmptyState from '../../components/EmptyState';

const CARD = 'rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-white/5';

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
        <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Carregando...</p>
      ) : pendentes.length === 0 ? (
        <div className={`${CARD} p-8`}>
          <EmptyState icon={CheckCircle} title="Nenhum funcionário aguardando aprovação" />
        </div>
      ) : (
        <ul className="space-y-2.5">
          {pendentes.map((p, i) => (
            <li
              key={p.id}
              style={{ '--rise-delay': `${Math.min(i, 10) * 40}ms` }}
              className={`${CARD} animate-rise flex flex-wrap items-center justify-between gap-3 px-4 py-3`}
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
                  className="press rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-dark disabled:opacity-60"
                >
                  Aprovar
                </button>
                <button
                  type="button"
                  disabled={acting === p.id}
                  onClick={() => decidir(p.id, 'recusar')}
                  className="press rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/10"
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
