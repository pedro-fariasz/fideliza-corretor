import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import ScoreBadge from '../components/ScoreBadge';

const STATUS_LABELS = {
  ativo: 'Ativo',
  inadimplente: 'Inadimplente',
  cancelado: 'Cancelado',
};

const STATUS_CLASSES = {
  ativo: 'bg-green-50 text-green-700',
  inadimplente: 'bg-orange-50 text-orange-700',
  cancelado: 'bg-gray-100 text-gray-500',
};

export default function ClientesListPage() {
  const { signOut } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [somenteIncompletos, setSomenteIncompletos] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const carregar = useCallback(async (incompletos) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listarClientes({ incompletos });
      setClientes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Erro ao carregar clientes.');
      setClientes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar(somenteIncompletos);
  }, [carregar, somenteIncompletos]);

  const tabBase = 'rounded-md px-3 py-1.5 text-sm font-medium';
  const tabActive = 'bg-blue-600 text-white';
  const tabInactive = 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300';

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">Fideliza Corretor</h1>
          <button
            type="button"
            onClick={signOut}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2" role="tablist" aria-label="Filtro de clientes">
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
              Cadastros incompletos
            </button>
          </div>

          <Link
            to="/clientes/novo"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Novo cliente
          </Link>
        </div>

        {somenteIncompletos && (
          <p className="mb-4 text-sm text-gray-500">
            Mostrando apenas clientes com score de completude abaixo de 60%.
          </p>
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
          <p className="py-12 text-center text-gray-500">Carregando clientes...</p>
        ) : clientes.length === 0 && !error ? (
          <div className="rounded-lg bg-white p-10 text-center shadow-sm">
            <p className="text-gray-600">
              {somenteIncompletos
                ? 'Nenhum cadastro incompleto. Tudo em dia! 🎉'
                : 'Nenhum cliente cadastrado ainda.'}
            </p>
            {!somenteIncompletos && (
              <Link
                to="/clientes/novo"
                className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Cadastrar o primeiro cliente
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {clientes.map((cliente) => (
              <li
                key={cliente.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{cliente.nome}</p>
                  <p className="text-sm text-gray-500">
                    {cliente.operadora || 'Operadora não informada'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-sm ${
                      STATUS_CLASSES[cliente.status] || 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {STATUS_LABELS[cliente.status] || cliente.status}
                  </span>
                  <ScoreBadge score={cliente.score_completude} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
