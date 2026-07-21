import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { formatBRL, formatData } from '../../utils/format';

const STATUS_COMISSAO = {
  projetada: { label: 'Projetada', cls: 'bg-gray-100 text-gray-600' },
  recebida: { label: 'Recebida', cls: 'bg-green-100 text-green-700' },
  cancelada: { label: 'Cancelada', cls: 'bg-red-100 text-red-600' },
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

  const abaCls = (a) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium ${
      aba === a ? 'bg-brand-blue text-white' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10'
    }`;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button type="button" className={abaCls('vendas')} onClick={() => setAba('vendas')}>
          Vendas
        </button>
        <button type="button" className={abaCls('comissoes')} onClick={() => setAba('comissoes')}>
          Comissões a receber
        </button>
      </div>

      {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <p className="py-12 text-center text-gray-500 dark:text-gray-400">Carregando...</p>
      ) : aba === 'vendas' ? (
        vendas.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
            <p className="text-gray-600 dark:text-gray-300">Nenhuma venda ainda.</p>
            <p className="mt-1 text-sm text-gray-400">As vendas nascem no funil, ao mover um lead para “Venda Concluída”.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Pagamento</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm dark:divide-white/5">
                {vendas.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatData(v.data_venda)}</td>
                    <td className="px-4 py-3 font-medium text-brand-navy dark:text-white">{produtos[v.produto_id] || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatBRL(v.valor)}</td>
                    <td className="px-4 py-3 capitalize text-gray-400">{v.forma_pagamento || '—'}</td>
                    <td className="px-4 py-3">
                      {v.status === 'cancelada' ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">Cancelada</span>
                      ) : (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Concluída</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : comissoes.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
          <p className="text-gray-600 dark:text-gray-300">Sem comissões ainda.</p>
          <p className="mt-1 text-sm text-gray-400">Elas aparecem em parcelas quando você registra uma venda.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">Prevista</th>
                <th className="px-4 py-3">Parcela</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm dark:divide-white/5">
              {comissoes.map((c) => {
                const s = STATUS_COMISSAO[c.status] || STATUS_COMISSAO.projetada;
                return (
                  <tr key={c.id}>
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
                        <button type="button" onClick={() => receber(c.id)} className="text-sm font-medium text-brand-blue hover:text-brand-blue-dark">
                          Marcar recebida
                        </button>
                      )}
                      {c.status === 'recebida' && (
                        <button type="button" onClick={() => estornar(c.id)} className="text-sm font-medium text-gray-400 hover:text-gray-600">
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
      )}
    </div>
  );
}
