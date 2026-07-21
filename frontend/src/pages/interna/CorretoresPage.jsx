import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';

// Painel interno — lista de corretores (GET /api/interno/resumo). Cada linha
// leva ao Kanban de clientes daquele corretor. Leitura cross-tenant (exceção
// autorizada, atrás de requireInternal).
export default function CorretoresPage() {
  const [resumo, setResumo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const carregar = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.internoResumo();
      setResumo(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Erro ao carregar os corretores.');
      setResumo([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  if (loading) {
    return <p className="py-12 text-center text-gray-500 dark:text-gray-400">Carregando...</p>;
  }

  if (error) {
    return (
      <div className="flex items-center justify-between rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
        <span>{error}</span>
        <button type="button" onClick={carregar} className="font-semibold underline">
          Tentar de novo
        </button>
      </div>
    );
  }

  if (resumo.length === 0) {
    return (
      <div className="rounded-lg bg-white p-10 text-center text-gray-500 shadow-sm dark:bg-white/5 dark:text-gray-400 dark:ring-1 dark:ring-white/10">
        Nenhum corretor com clientes ainda.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {resumo.map((t) => (
        <Link
          key={t.tenant_id}
          to={`/equipe/painel/kanban/${t.tenant_id}`}
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-blue dark:border-white/10 dark:bg-white/5 dark:hover:border-brand-blue"
        >
          <p className="truncate font-medium text-brand-navy dark:text-white">{t.corretor}</p>
          <div className="mt-2 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>{t.total_clientes} clientes</span>
            <span>{t.incompletos} incompletos</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-white/10">
              <div className="h-1.5 rounded-full bg-brand-blue" style={{ width: `${t.score_medio}%` }} />
            </div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t.score_medio}%
            </span>
          </div>
          <span className="mt-3 inline-block text-sm font-semibold text-brand-blue">
            Ver Kanban →
          </span>
        </Link>
      ))}
    </div>
  );
}
