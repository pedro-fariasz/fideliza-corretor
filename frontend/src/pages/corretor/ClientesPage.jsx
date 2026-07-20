import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import ScoreBadge from '../../components/ScoreBadge';

const STATUS_LABELS = { ativo: 'Ativo', inadimplente: 'Inadimplente', cancelado: 'Cancelado' };
const STATUS_CLASSES = {
  ativo: 'bg-green-50 text-green-700',
  inadimplente: 'bg-orange-50 text-orange-700',
  cancelado: 'bg-gray-100 text-gray-500',
};

// Lista de clientes do corretor com busca (nome) e filtros (status, operadora,
// completude). Faz um fetch da carteira e filtra no cliente, para resposta
// imediata nos filtros — o volume por corretor (50–500) comporta bem.
export default function ClientesPage() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const [operadora, setOperadora] = useState('');
  const [completude, setCompletude] = useState('todos'); // todos | incompletos | completos

  const carregar = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listarClientes();
      setClientes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Erro ao carregar clientes.');
      setClientes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const operadoras = useMemo(
    () => [...new Set(clientes.map((c) => c.operadora).filter(Boolean))].sort(),
    [clientes]
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return clientes.filter((c) => {
      if (termo && !(c.nome || '').toLowerCase().includes(termo)) return false;
      if (status && c.status !== status) return false;
      if (operadora && c.operadora !== operadora) return false;
      const score = c.score_completude ?? 0;
      if (completude === 'incompletos' && score >= 60) return false;
      if (completude === 'completos' && score < 60) return false;
      return true;
    });
  }, [clientes, busca, status, operadora, completude]);

  const selectClass =
    'rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 ' +
    'dark:border-white/15 dark:bg-white/5 dark:text-gray-200';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome..."
            className={`${selectClass} w-48`}
            aria-label="Buscar cliente por nome"
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass} aria-label="Filtrar por status">
            <option value="">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="inadimplente">Inadimplente</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <select value={operadora} onChange={(e) => setOperadora(e.target.value)} className={selectClass} aria-label="Filtrar por operadora">
            <option value="">Todas as operadoras</option>
            {operadoras.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
          <select value={completude} onChange={(e) => setCompletude(e.target.value)} className={selectClass} aria-label="Filtrar por completude">
            <option value="todos">Completude: todos</option>
            <option value="incompletos">Incompletos (&lt;60%)</option>
            <option value="completos">Completos (≥60%)</option>
          </select>
        </div>

        <Link
          to="/clientes/novo"
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-dark"
        >
          + Novo cliente
        </Link>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={carregar} className="font-semibold underline">
            Tentar de novo
          </button>
        </div>
      )}

      {loading ? (
        <p className="py-12 text-center text-gray-500 dark:text-gray-400">Carregando clientes...</p>
      ) : filtrados.length === 0 && !error ? (
        <div className="rounded-lg bg-white p-10 text-center shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
          <p className="text-gray-600 dark:text-gray-300">
            {clientes.length === 0
              ? 'Nenhum cliente cadastrado ainda.'
              : 'Nenhum cliente com esses filtros.'}
          </p>
          {clientes.length === 0 && (
            <Link
              to="/clientes/novo"
              className="mt-4 inline-block rounded-md bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-dark"
            >
              Cadastrar o primeiro cliente
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtrados.map((cliente) => (
            <li
              key={cliente.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-brand-navy dark:text-white">{cliente.nome}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
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
    </div>
  );
}
