import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { formatBRL } from '../../utils/format';
import { useAuth } from '../../hooks/useAuth';

// =============================================================================
// Desempenho de Equipe (Fase 4). Compara vendedores e mostra concentração de
// risco. Escopo respeitado no servidor. Gráficos SVG puros (sem lib).
// =============================================================================

const PERIODOS = [
  { value: '30d', label: '30 dias' }, { value: '90d', label: '90 dias' },
  { value: '6m', label: '6 meses' }, { value: '1a', label: '1 ano' }, { value: 'tudo', label: 'Todo o período' },
];
const COR = { azul: '#1E5EFF', ambar: '#F5A623', verde: '#16a34a' };
const card = 'rounded-xl bg-white p-5 shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10';
const selectCls = 'rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue';
const mesLabel = (m) => ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(m.split('-')[1]) - 1];

const COLUNAS = [
  { key: 'nome', label: 'Vendedor', fmt: (v) => v, num: false },
  { key: 'vendas', label: 'Vendas', fmt: (v) => v },
  { key: 'valor', label: 'Valor', fmt: formatBRL },
  { key: 'ticket_medio', label: 'Ticket médio', fmt: formatBRL },
  { key: 'comissao_projetada', label: 'Comissão proj.', fmt: formatBRL },
  { key: 'taxa_conversao', label: 'Conversão', fmt: (v) => `${v}%` },
  { key: 'taxa_renovacao', label: 'Renovação', fmt: (v) => `${v}%` },
];

export default function DesempenhoPage() {
  const { profile } = useAuth();
  const perfil = (profile && profile.perfil_efetivo) || 'vendedor';
  const podeFiltrar = ['administrador', 'gerente', 'lider'].includes(perfil);

  const [periodo, setPeriodo] = useState('90d');
  const [vendedorId, setVendedorId] = useState('');
  const [vendedores, setVendedores] = useState([]);
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ordem, setOrdem] = useState({ campo: 'valor', asc: false });

  useEffect(() => { if (podeFiltrar) api.desempenhoVendedores().then(setVendedores).catch(() => {}); }, [podeFiltrar]);

  async function carregar() {
    setLoading(true); setError('');
    try {
      const params = { periodo };
      if (vendedorId) params.vendedor_id = vendedorId;
      setDados(await api.desempenho(params));
    } catch (err) {
      setError(err.message || 'Erro ao carregar o desempenho.');
    } finally { setLoading(false); }
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [periodo, vendedorId]);

  if (loading) return <p className="py-12 text-center text-gray-500 dark:text-gray-400">Carregando...</p>;
  if (error) return <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;

  const vazio = !dados || dados.vendedores.length === 0 || dados.cards.vendas === 0;
  const linhas = [...(dados?.vendedores || [])].sort((a, b) => {
    const s = ordem.campo === 'nome'
      ? String(a.nome).localeCompare(String(b.nome))
      : Number(a[ordem.campo] || 0) - Number(b[ordem.campo] || 0);
    return ordem.asc ? s : -s;
  });

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        {podeFiltrar && vendedores.length > 0 && (
          <select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)} className={selectCls}>
            <option value="">Todos os vendedores</option>
            {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        )}
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className={selectCls}>
          {PERIODOS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {vazio ? (
        <div className={`${card} text-center`}>
          <p className="text-gray-600 dark:text-gray-300">Sem vendas no período selecionado.</p>
          <p className="mt-1 text-sm text-gray-400">Registre vendas no funil para acompanhar o desempenho da equipe.</p>
        </div>
      ) : (
        <>
          {/* Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: 'Total de vendas', v: dados.cards.vendas },
              { label: 'Valor vendido', v: formatBRL(dados.cards.valor) },
              { label: 'Comissão projetada', v: formatBRL(dados.cards.comissao_projetada) },
              { label: 'Comissão recebida', v: formatBRL(dados.cards.comissao_recebida) },
              { label: 'Ticket médio', v: formatBRL(dados.cards.ticket_medio) },
            ].map((k) => (
              <div key={k.label} className={card}>
                <p className="text-xs text-gray-500 dark:text-gray-400">{k.label}</p>
                <p className="mt-1 font-heading text-xl font-bold text-brand-navy dark:text-white">{k.v}</p>
              </div>
            ))}
          </div>

          {/* Destaques + Concentração */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className={card}>
              <h3 className="mb-3 font-heading text-sm font-semibold text-brand-navy dark:text-white">Destaques</h3>
              <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                <Destaque titulo="Melhor vendedor" nome={dados.destaques.melhor_vendedor?.nome} sub={formatBRL(dados.destaques.melhor_vendedor?.valor)} />
                <Destaque titulo="Maior ticket médio" nome={dados.destaques.maior_ticket?.nome} sub={formatBRL(dados.destaques.maior_ticket?.ticket_medio)} />
                <Destaque titulo="Maior renovação" nome={dados.destaques.maior_renovacao?.nome} sub={`${dados.destaques.maior_renovacao?.taxa_renovacao ?? 0}%`} />
              </div>
            </section>
            <section className={card}>
              <h3 className="mb-1 font-heading text-sm font-semibold text-brand-navy dark:text-white">Índice de concentração</h3>
              <p className={`font-heading text-4xl font-bold ${dados.indice_concentracao > 70 ? 'text-red-600' : 'text-brand-navy dark:text-white'}`}>
                {dados.indice_concentracao}%
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Faturamento dos 3 maiores ÷ total.</p>
              {dados.indice_concentracao > 70 && (
                <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                  Sua receita depende demais de poucas pessoas — risco de concentração.
                </p>
              )}
            </section>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className={card}>
              <h3 className="mb-3 font-heading text-sm font-semibold text-brand-navy dark:text-white">Faturamento por vendedor</h3>
              <BarrasVendedor vendedores={dados.vendedores} />
            </section>
            <section className={card}>
              <h3 className="mb-3 font-heading text-sm font-semibold text-brand-navy dark:text-white">Evolução mensal</h3>
              <LinhaMensal serie={dados.serie_mensal} />
            </section>
          </div>

          {/* Ranking */}
          <section className={card}>
            <h3 className="mb-3 font-heading text-sm font-semibold text-brand-navy dark:text-white">Ranking detalhado</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                    {COLUNAS.map((col) => (
                      <th key={col.key} className="cursor-pointer px-3 py-2 hover:text-brand-navy dark:hover:text-white"
                        onClick={() => setOrdem((o) => ({ campo: col.key, asc: o.campo === col.key ? !o.asc : false }))}>
                        {col.label}{ordem.campo === col.key ? (ordem.asc ? ' ▲' : ' ▼') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm dark:divide-white/5">
                  {linhas.map((l) => (
                    <tr key={l.vendedor_id}>
                      {COLUNAS.map((col) => (
                        <td key={col.key} className={`px-3 py-2 ${col.key === 'nome' ? 'font-medium text-brand-navy dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                          {col.fmt(l[col.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Destaque({ titulo, nome, sub }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/5">
      <p className="text-xs text-gray-400">{titulo}</p>
      <p className="font-medium text-brand-navy dark:text-white">{nome || '—'}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{sub}</p>
    </div>
  );
}

function BarrasVendedor({ vendedores }) {
  const itens = [...vendedores].sort((a, b) => b.valor - a.valor).slice(0, 8);
  const max = Math.max(1, ...itens.map((v) => v.valor));
  if (itens.length === 0) return <p className="text-sm text-gray-400">Sem dados.</p>;
  return (
    <div className="space-y-2">
      {itens.map((v) => (
        <div key={v.vendedor_id} className="flex items-center gap-2">
          <span className="w-28 shrink-0 truncate text-xs text-gray-500 dark:text-gray-400">{v.nome}</span>
          <div className="h-4 flex-1 rounded bg-gray-100 dark:bg-white/10">
            <div className="h-4 rounded" style={{ width: `${(v.valor / max) * 100}%`, background: COR.azul, minWidth: 2 }} />
          </div>
          <span className="w-24 shrink-0 text-right text-xs text-gray-600 dark:text-gray-300">{formatBRL(v.valor)}</span>
        </div>
      ))}
    </div>
  );
}

function LinhaMensal({ serie }) {
  if (!serie || serie.length === 0) return <p className="text-sm text-gray-400">Sem dados no período.</p>;
  const W = 340, H = 150, pad = 28;
  const max = Math.max(1, ...serie.flatMap((s) => [s.faturamento, s.comissao_projetada, s.comissao_recebida]));
  const x = (i) => pad + (i * (W - 2 * pad)) / Math.max(1, serie.length - 1);
  const y = (v) => H - pad - (v / max) * (H - 2 * pad);
  const linha = (key) => serie.map((s, i) => `${x(i)},${y(s[key])}`).join(' ');
  const series = [
    { key: 'faturamento', cor: COR.azul, label: 'Faturamento' },
    { key: 'comissao_projetada', cor: COR.ambar, label: 'Comissão projetada' },
    { key: 'comissao_recebida', cor: COR.verde, label: 'Comissão recebida' },
  ];
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 300 }}>
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#e5e7eb" />
        {series.map((s) => <polyline key={s.key} fill="none" stroke={s.cor} strokeWidth="2" points={linha(s.key)} />)}
        {serie.map((s, i) => <text key={s.mes} x={x(i)} y={H - 8} fontSize="9" textAnchor="middle" fill="#94a3b8">{mesLabel(s.mes)}</text>)}
      </svg>
      <div className="mt-1 flex flex-wrap gap-4 text-xs">
        {series.map((s) => <span key={s.key} className="flex items-center gap-1"><span className="h-2 w-3 rounded" style={{ background: s.cor }} /> {s.label}</span>)}
      </div>
    </div>
  );
}
