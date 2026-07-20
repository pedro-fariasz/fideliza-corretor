import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { resumoCarteira } from '../../utils/clientesMetrics';

// Início do corretor — quatro blocos com composições DIFERENTES de propósito
// (não repetir o mesmo template métrica-grande + label). Sem card-dentro-de-card.
export default function InicioPage() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await api.listarClientes();
        if (vivo) setClientes(Array.isArray(data) ? data : []);
      } catch (err) {
        if (vivo) setError(err.message || 'Erro ao carregar a carteira.');
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  if (loading) {
    return <p className="py-12 text-center text-gray-500 dark:text-gray-400">Carregando...</p>;
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
    );
  }

  const r = resumoCarteira(clientes);
  const pctIncompletos = r.total ? Math.round((r.incompletos / r.total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Bloco 1 — destaque primário: métrica grande com barra de acento azul */}
      <section className="flex items-stretch gap-4 rounded-xl bg-white p-5 shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
        <div className="w-1.5 rounded-full bg-brand-blue" aria-hidden="true" />
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Clientes ativos</p>
          <p className="mt-1 font-heading text-4xl font-bold text-brand-navy dark:text-white">
            {r.ativos}
          </p>
          <p className="mt-1 text-xs text-gray-400">de {r.total} na carteira</p>
        </div>
      </section>

      {/* Bloco 2 — alerta: número + badge âmbar + nomes (composição de lista) */}
      <section className="rounded-xl bg-white p-5 shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">Inadimplentes</p>
          {r.inadimplentes > 0 && (
            <span className="rounded-full bg-brand-amber/15 px-2 py-0.5 text-xs font-semibold text-brand-amber">
              requer atenção
            </span>
          )}
        </div>
        <p className="mt-1 font-heading text-3xl font-bold text-brand-navy dark:text-white">
          {r.inadimplentes}
        </p>
        {r.inadimplentes === 0 && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Ninguém em atraso. 🎉</p>
        )}
      </section>

      {/* Bloco 3 — renovações do mês: composição em lista de nomes */}
      <section className="rounded-xl bg-white p-5 shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Renovações do mês <span className="text-gray-400">(aniversário do plano)</span>
        </p>
        {r.renovacoes.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Nenhuma renovação neste mês.</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {r.renovacoes.slice(0, 5).map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <span className="truncate text-brand-navy dark:text-white">{c.nome}</span>
                <span className="text-gray-400">{c.operadora || '—'}</span>
              </li>
            ))}
            {r.renovacoes.length > 5 && (
              <li className="text-xs text-gray-400">+{r.renovacoes.length - 5} outras</li>
            )}
          </ul>
        )}
      </section>

      {/* Bloco 4 — completude: barra de progresso + CTA para Pendências */}
      <section className="flex flex-col rounded-xl bg-white p-5 shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
        <p className="text-sm text-gray-500 dark:text-gray-400">Cadastros incompletos</p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-heading text-3xl font-bold text-brand-navy dark:text-white">
            {r.incompletos}
          </span>
          <span className="text-sm text-gray-400">/ {r.total}</span>
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-gray-200 dark:bg-white/10">
          <div
            className="h-2 rounded-full bg-brand-blue"
            style={{ width: `${pctIncompletos}%` }}
          />
        </div>
        <Link
          to="/pendencias"
          className="mt-3 self-start text-sm font-semibold text-brand-blue hover:text-brand-blue-dark"
        >
          Ver pendências →
        </Link>
      </section>
    </div>
  );
}
