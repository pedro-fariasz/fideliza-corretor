import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import LeadFormModal from '../../components/LeadFormModal';
import { ESTAGIO_LABEL, ESTAGIOS } from '../../utils/crmConstants';
import { formatBRL } from '../../utils/format';

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');
  const [estagio, setEstagio] = useState('');
  const [aberto, setAberto] = useState(false);

  async function carregar() {
    setLoading(true);
    setError('');
    try {
      const data = await api.listarLeads({ status: 'ativo', estagio: estagio || undefined, busca: busca || undefined });
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Erro ao carregar leads.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estagio]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              carregar();
            }}
          >
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome..."
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
          </form>
          <select
            value={estagio}
            onChange={(e) => setEstagio(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          >
            <option value="">Todos os estágios</option>
            {ESTAGIOS.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-dark"
        >
          + Novo lead
        </button>
      </div>

      {loading ? (
        <p className="py-12 text-center text-gray-500 dark:text-gray-400">Carregando...</p>
      ) : error ? (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : leads.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
          <p className="text-gray-600 dark:text-gray-300">Nenhum lead por aqui.</p>
          <p className="mt-1 text-sm text-gray-400">Cadastre o primeiro para começar o funil.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Interesse</th>
                <th className="px-4 py-3">Estágio</th>
                <th className="px-4 py-3">Valor est.</th>
                <th className="px-4 py-3">Origem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm dark:divide-white/5">
              {leads.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 font-medium text-brand-navy dark:text-white">{l.nome}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{l.telefone || '—'}</td>
                  <td className="px-4 py-3 capitalize text-gray-500 dark:text-gray-400">{l.interesse || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-xs font-medium text-brand-blue">
                      {ESTAGIO_LABEL[l.estagio]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {l.valor_estimado ? formatBRL(l.valor_estimado) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{l.origem_especifica || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LeadFormModal open={aberto} onClose={() => setAberto(false)} onSaved={() => carregar()} />
    </div>
  );
}
