import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { formatBRL, formatData } from '../../utils/format';
import { ESTAGIO_LABEL } from '../../utils/crmConstants';

function KpiCard({ label, valor, sub, accent }) {
  return (
    <section className="flex items-stretch gap-4 rounded-xl bg-white p-5 shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
      {accent && <div className="w-1.5 rounded-full bg-brand-blue" aria-hidden="true" />}
      <div className="min-w-0">
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-1 font-heading text-3xl font-bold text-brand-navy dark:text-white">{valor}</p>
        {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const d = await api.dashboard();
        if (vivo) setData(d);
      } catch (err) {
        if (vivo) setError(err.message || 'Erro ao carregar o dashboard.');
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  if (loading) return <p className="py-12 text-center text-gray-500 dark:text-gray-400">Carregando...</p>;
  if (error) return <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;

  const k = data.kpis;
  const totalFunil = data.funil.reduce((acc, f) => acc + f.quantidade, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Leads novos (mês)" valor={k.leads_novos} sub={`${k.total_leads} ativos no total`} accent />
        <KpiCard
          label="Vendas concluídas"
          valor={k.vendas_concluidas.quantidade}
          sub={formatBRL(k.vendas_concluidas.valor_total)}
        />
        <KpiCard label="Comissão prevista (mês)" valor={formatBRL(k.comissao_prevista)} sub="a receber no período" />
        <KpiCard label="Comissão recebida (mês)" valor={formatBRL(k.comissao_recebida)} sub={`conversão ${k.taxa_conversao}%`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Funil resumido */}
        <section className="rounded-xl bg-white p-5 shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10 lg:col-span-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Funil de vendas</p>
            <Link to="/funil" className="text-sm font-semibold text-brand-blue hover:text-brand-blue-dark">
              Abrir funil →
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {data.funil.map((f) => {
              const pct = totalFunil ? Math.round((f.quantidade / totalFunil) * 100) : 0;
              return (
                <li key={f.estagio}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-brand-navy dark:text-white">{ESTAGIO_LABEL[f.estagio]}</span>
                    <span className="text-gray-400">{f.quantidade}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-gray-200 dark:bg-white/10">
                    <div className="h-1.5 rounded-full bg-brand-blue" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Vendas recentes */}
        <section className="rounded-xl bg-white p-5 shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Vendas recentes</p>
            <Link to="/vendas" className="text-sm font-semibold text-brand-blue hover:text-brand-blue-dark">
              Ver todas →
            </Link>
          </div>
          {data.vendas_recentes.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Nenhuma venda ainda.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.vendas_recentes.map((v) => (
                <li key={v.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{formatData(v.data_venda)}</span>
                  <span className="font-medium text-brand-navy dark:text-white">{formatBRL(v.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Leads recentes */}
        <section className="rounded-xl bg-white p-5 shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Leads recentes</p>
            <Link to="/leads" className="text-sm font-semibold text-brand-blue hover:text-brand-blue-dark">
              Ver todos →
            </Link>
          </div>
          {data.leads_recentes.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Nenhum lead ainda.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.leads_recentes.map((l) => (
                <li key={l.id} className="flex items-center justify-between text-sm">
                  <span className="truncate text-brand-navy dark:text-white">{l.nome}</span>
                  <span className="text-gray-400">{ESTAGIO_LABEL[l.estagio] || '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
