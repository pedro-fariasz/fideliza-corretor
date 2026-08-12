import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { useAuth } from '../../hooks/useAuth';
import { ESTAGIO_LABEL } from '../../utils/crmConstants';

const CARD = 'rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-white/5';

// Aba Indicação do hub de Clientes — leads cuja origem específica é
// "Indicação". A tabela de leads é a única que carrega esse campo hoje
// (carteira_clientes não tem origem própria).
export default function ClientesIndicacaoPage() {
  const { profile } = useAuth();
  const verValores = !profile || profile.pode_ver_valores !== false;
  const [leads, setLeads] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    api
      .listarLeads({ status: 'ativo' })
      .then((data) => vivo && setLeads(Array.isArray(data) ? data : []))
      .catch((err) => vivo && setError(err.message || 'Erro ao carregar indicações.'));
    return () => {
      vivo = false;
    };
  }, []);

  const indicados = useMemo(
    () => (leads || []).filter((l) => l.origem_especifica === 'Indicação'),
    [leads]
  );

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
        {error}
      </div>
    );
  }

  if (leads === null) {
    return <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</p>;
  }

  if (indicados.length === 0) {
    return (
      <div className={`${CARD} p-8`}>
        <EmptyState
          icon={Sparkles}
          title="Nenhuma indicação ainda"
          description="Leads cadastrados com origem 'Indicação' aparecem aqui."
        />
      </div>
    );
  }

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400 dark:border-white/10">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Contato</th>
              {verValores && <th className="px-4 py-3">Valor estimado</th>}
              <th className="px-4 py-3">Estágio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {indicados.map((l, i) => (
              <tr
                key={l.id}
                style={{ '--rise-delay': `${Math.min(i, 10) * 30}ms` }}
                className="animate-rise-row transition-colors hover:bg-gray-50/70 dark:hover:bg-white/5"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar nome={l.nome} size="sm" />
                    <span className="font-medium text-brand-navy dark:text-white">{l.nome}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{l.telefone || l.email || '—'}</td>
                {verValores && (
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {l.valor_estimado ? `R$ ${Number(l.valor_estimado).toLocaleString('pt-BR')}` : '—'}
                  </td>
                )}
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{ESTAGIO_LABEL[l.estagio] || l.estagio}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
