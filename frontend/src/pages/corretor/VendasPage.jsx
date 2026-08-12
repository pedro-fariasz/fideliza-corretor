import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { formatBRL, formatData } from '../../utils/format';
import { useTabIndicator } from '../../hooks/useTabIndicator';

const CARD = 'rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-white/5';
const STATUS_COMISSAO = {
  projetada: { label: 'Projetada', cls: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300' },
  recebida: { label: 'Recebida', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  cancelada: { label: 'Cancelada', cls: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300' },
};

export default function VendasPage() {
  const [aba, setAba] = useState('vendas');
  const [vendas, setVendas] = useState([]);
  const [comissoes, setComissoes] = useState([]);
  const [produtos, setProdutos] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function carregar() {
    setLoading(true);
    setError('');
    try {
      const [vs, cs, ps] = await Promise.all([
        api.listarVendas(),
        api.listarComissoes(),
        api.listarProdutos(),
      ]);
      setVendas(Array.isArray(vs) ? vs : []);
      setComissoes(Array.isArray(cs) ? cs : []);
      const mapa = {};
      (Array.isArray(ps) ? ps : []).forEach((p) => {
        mapa[p.id] = p.nome;
      });
      setProdutos(mapa);
    } catch (err) {
      setError(err.message || 'Erro ao carregar vendas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function receber(id) {
    try {
      await api.receberComissao(id);
      await carregar();
    } catch (err) {
      setError(err.message || 'Erro ao marcar comissão como recebida.');
    }
  }

  async function estornar(id) {
    try {
      await api.estornarComissao(id);
      await carregar();
    } catch (err) {
      setError(err.message || 'Erro ao estornar comissão.');
    }
  }

  const { containerRef: abaRef, style: abaIndicatorStyle } = useTabIndicator(aba);

  return (
    <div className="space-y-4">
      <div
        ref={abaRef}
        role="tablist"
        aria-label="Vendas ou comissões"
        className="relative inline-flex gap-1 rounded-xl border border-gray-100 bg-gray-50 p-1 dark:border-white/10 dark:bg-white/5"
      >
        <span className="tab-indicator bg-white shadow-sm dark:bg-white/10" style={abaIndicatorStyle} aria-hidden="true" />
        {[
          { key: 'vendas', label: 'Vendas' },
          { key: 'comissoes', label: 'Comissões a receber' },
        ].map((a) => (
          <button
            key={a.key}
            type="button"
            role="tab"
            data-tab-key={a.key}
            aria-selected={aba === a.key}
            onClick={() => setAba(a.key)}
            className={`press relative whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ${
              aba === a.key ? 'text-brand-blue dark:text-white' : 'text-gray-500 hover:text-brand-navy dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="py-12 text-center text-gray-500 dark:text-gray-400">Carregando...</p>
      ) : aba === 'vendas' ? (
        vendas.length === 0 ? (
          <div className={`${CARD} p-8 text-center`}>
            <p className="text-gray-600 dark:text-gray-300">Nenhuma venda ainda.</p>
            <p className="mt-1 text-sm text-gray-400">As vendas nascem no funil, ao mover um lead para “Venda Concluída”.</p>
          </div>
        ) : (
          <div className={`${CARD} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400 dark:border-white/10">
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Pagamento</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {vendas.map((v, i) => (
                    <tr
                      key={v.id}
                      style={{ '--rise-delay': `${Math.min(i, 10) * 30}ms` }}
                      className="animate-rise-row transition-colors hover:bg-gray-50/70 dark:hover:bg-white/5"
                    >
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatData(v.data_venda)}</td>
                      <td className="px-4 py-3 font-medium text-brand-navy dark:text-white">{produtos[v.produto_id] || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatBRL(v.valor)}</td>
                      <td className="px-4 py-3 capitalize text-gray-400">{v.forma_pagamento || '—'}</td>
                      <td className="px-4 py-3">
                        {v.status === 'cancelada' ? (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 dark:bg-red-500/15 dark:text-red-300">Cancelada</span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Concluída</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : comissoes.length === 0 ? (
        <div className={`${CARD} p-8 text-center`}>
          <p className="text-gray-600 dark:text-gray-300">Sem comissões ainda.</p>
          <p className="mt-1 text-sm text-gray-400">Elas aparecem em parcelas quando você registra uma venda.</p>
        </div>
      ) : (
        <div className={`${CARD} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400 dark:border-white/10">
                  <th className="px-4 py-3">Prevista</th>
                  <th className="px-4 py-3">Parcela</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {comissoes.map((c, i) => {
                  const s = STATUS_COMISSAO[c.status] || STATUS_COMISSAO.projetada;
                  return (
                    <tr
                      key={c.id}
                      style={{ '--rise-delay': `${Math.min(i, 10) * 30}ms` }}
                      className="animate-rise-row transition-colors hover:bg-gray-50/70 dark:hover:bg-white/5"
                    >
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatData(c.data_prevista)}</td>
                      <td className="px-4 py-3 text-gray-400">
                        {c.num_parcela}/{c.total_parcelas || '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-brand-navy dark:text-white">{formatBRL(c.valor_parcela)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {c.status === 'projetada' && (
                          <button type="button" onClick={() => receber(c.id)} className="press text-sm font-medium text-brand-blue transition-colors hover:text-brand-blue-dark">
                            Marcar recebida
                          </button>
                        )}
                        {c.status === 'recebida' && (
                          <button type="button" onClick={() => estornar(c.id)} className="press text-sm font-medium text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200">
                            Estornar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
