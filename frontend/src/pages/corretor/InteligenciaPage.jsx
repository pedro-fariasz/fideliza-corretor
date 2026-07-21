import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { formatBRL } from '../../utils/format';
import { useAuth } from '../../hooks/useAuth';

// =============================================================================
// Inteligência / BI de Carteira (Fase 3). Lê agregados do backend (job noturno
// + cache), respeitando o escopo de permissão. Gráficos em SVG puro (sem lib).
// =============================================================================

const PERIODOS = [
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: '6m', label: '6 meses' },
  { value: '1a', label: '1 ano' },
  { value: 'tudo', label: 'Todo o período' },
];

const ESCOPOS = [
  { value: 'meus', label: 'Meus dados' },
  { value: 'equipe', label: 'Minha equipe' },
  { value: 'empresa', label: 'Toda a empresa' },
];

const COR = { azul: '#1E5EFF', ambar: '#F5A623', verde: '#16a34a', vermelho: '#dc2626', cinza: '#94a3b8' };
const card = 'rounded-xl bg-white p-5 shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10';
const faixaCls = { verde: 'text-green-600', amarelo: 'text-brand-amber', vermelho: 'text-red-600', sem_dados: 'text-gray-400' };
const mesLabel = (m) => { const [, mm] = m.split('-'); return ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(mm) - 1]; };

export default function InteligenciaPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const perfil = (profile && profile.perfil_efetivo) || 'vendedor';
  const podeEscopo = ['administrador', 'gerente', 'lider'].includes(perfil);

  const [periodo, setPeriodo] = useState('90d');
  const [escopo, setEscopo] = useState(podeEscopo ? 'empresa' : 'meus');
  const [corretorId, setCorretorId] = useState('');
  const [corretores, setCorretores] = useState([]);
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (podeEscopo) api.biCarteiraCorretores().then(setCorretores).catch(() => {});
  }, [podeEscopo]);

  async function carregar() {
    setLoading(true);
    setError('');
    try {
      const params = { periodo };
      if (corretorId) params.corretor_id = corretorId;
      else if (podeEscopo) params.escopo = escopo;
      setDados(await api.biCarteira(params));
    } catch (err) {
      setError(err.message || 'Erro ao carregar o BI.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [periodo, escopo, corretorId]);

  function irParaCta(cta) {
    if (cta.link) { navigate(cta.link); return; }
    const el = document.getElementById(`bloco-${cta.acao}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const vazio = dados && dados.base && dados.base.apolices_ativas === 0;

  return (
    <div className="space-y-6">
      {/* Filtros globais */}
      <div className="flex flex-wrap items-center gap-3">
        {podeEscopo && (
          <select value={escopo} onChange={(e) => { setEscopo(e.target.value); setCorretorId(''); }} className={selectCls}>
            {ESCOPOS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        )}
        {podeEscopo && corretores.length > 0 && (
          <select value={corretorId} onChange={(e) => setCorretorId(e.target.value)} className={selectCls}>
            <option value="">Todos os corretores</option>
            {corretores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        )}
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className={selectCls}>
          {PERIODOS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {loading && <p className="py-12 text-center text-gray-500 dark:text-gray-400">Carregando...</p>}
      {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {!loading && !error && vazio && (
        <div className={`${card} text-center`}>
          <p className="text-gray-600 dark:text-gray-300">Ainda não há apólices na carteira para gerar inteligência.</p>
          <p className="mt-1 text-sm text-gray-400">Registre vendas no funil ou um negócio avulso na Carteira — as métricas aparecem aqui em seguida.</p>
        </div>
      )}

      {!loading && !error && dados && !vazio && <Painel dados={dados} onCta={irParaCta} />}
    </div>
  );
}

const selectCls = 'rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue';

function Painel({ dados, onCta }) {
  const c = dados.cards;
  const cardsTopo = [
    { label: 'Score de saúde', valor: c.score_saude == null ? '—' : c.score_saude, cls: faixaCls[c.faixa] || '' },
    { label: 'Receita garantida', valor: formatBRL(c.receita_garantida) },
    { label: 'Receita em risco', valor: formatBRL(c.receita_risco), cls: 'text-red-600' },
    { label: 'Taxa de renovação', valor: c.taxa_renovacao == null ? '—' : `${c.taxa_renovacao}%` },
    { label: 'NPS', valor: c.nps == null ? '—' : c.nps },
    { label: 'LTV médio', valor: formatBRL(c.ltv_medio) },
    { label: 'Produtos/cliente', valor: c.produtos_por_cliente == null ? '—' : c.produtos_por_cliente },
    { label: 'Cancelamento', valor: c.taxa_cancelamento == null ? '—' : `${c.taxa_cancelamento}%` },
    { label: 'Vencem em 30d', valor: c.vencimentos_30d },
  ];

  return (
    <div className="space-y-6">
      {/* Cards de topo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cardsTopo.map((k) => (
          <div key={k.label} className={card}>
            <p className="text-xs text-gray-500 dark:text-gray-400">{k.label}</p>
            <p className={`mt-1 font-heading text-2xl font-bold ${k.cls || 'text-brand-navy dark:text-white'}`}>{k.valor}</p>
          </div>
        ))}
      </div>

      {/* Insights */}
      {dados.insights && dados.insights.length > 0 && (
        <section className={card}>
          <h3 className="mb-3 font-heading text-sm font-semibold text-brand-navy dark:text-white">Insights</h3>
          <ul className="space-y-2">
            {dados.insights.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/5">
                <span className="flex items-center gap-2 text-sm text-brand-navy dark:text-gray-100">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${i.severidade === 'alerta' ? 'bg-red-500' : i.severidade === 'positivo' ? 'bg-green-500' : 'bg-brand-amber'}`} />
                  {i.texto}
                </span>
                <button type="button" onClick={() => onCta(i.cta)} className="text-xs font-semibold text-brand-blue hover:text-brand-blue-dark">
                  {i.cta.label} →
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={card}>
          <h3 className="mb-3 font-heading text-sm font-semibold text-brand-navy dark:text-white">Distribuição por saúde</h3>
          <BarrasHealth dist={dados.health_distribuicao} />
        </section>
        <section className={card}>
          <h3 className="mb-3 font-heading text-sm font-semibold text-brand-navy dark:text-white">Receita últimos 6 meses</h3>
          <LinhaReceita serie={dados.receita_mensal} />
        </section>
        <section className={card}>
          <h3 className="mb-3 font-heading text-sm font-semibold text-brand-navy dark:text-white">Receita por categoria</h3>
          <BarrasCategoria mapa={dados.receita_por_categoria} />
        </section>
        <section id="bloco-renovacoes" className={card}>
          <h3 className="mb-3 font-heading text-sm font-semibold text-brand-navy dark:text-white">Projeção de renovações</h3>
          <BarrasRenovacao proj={dados.projecao_renovacoes} />
        </section>
      </div>

      {/* Churn */}
      <section id="bloco-churn" className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-heading text-sm font-semibold text-brand-navy dark:text-white">Risco de churn</h3>
          <div className="flex gap-3 text-xs">
            <span className="text-red-600">Alto: {dados.churn.segmentos.alto}</span>
            <span className="text-brand-amber">Médio: {dados.churn.segmentos.medio}</span>
            <span className="text-green-600">Baixo: {dados.churn.segmentos.baixo}</span>
          </div>
        </div>
        {dados.churn.top20.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum cliente em risco no escopo atual.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-3 py-2">Cliente</th><th className="px-3 py-2">Probabilidade</th><th className="px-3 py-2">Comissão em risco</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 text-sm dark:divide-white/5">
                {dados.churn.top20.map((c) => (
                  <tr key={c.apolice_id}>
                    <td className="px-3 py-2 font-medium text-brand-navy dark:text-white">{c.cliente_nome}</td>
                    <td className="px-3 py-2"><span className={c.prob > 0.7 ? 'text-red-600' : c.prob >= 0.4 ? 'text-brand-amber' : 'text-green-600'}>{Math.round(c.prob * 100)}%</span></td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{formatBRL(c.valor_risco)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Cross-sell */}
      <section id="bloco-crosssell" className={card}>
        <h3 className="mb-3 font-heading text-sm font-semibold text-brand-navy dark:text-white">Oportunidades de cross-sell</h3>
        {(!dados.crosssell || dados.crosssell.length === 0) ? (
          <p className="text-sm text-gray-400">Sem oportunidades no escopo atual.</p>
        ) : (
          <ul className="space-y-2">
            {dados.crosssell.map((o) => (
              <li key={o.cliente_id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-white/5">
                <span className="text-brand-navy dark:text-white">{o.cliente_nome}</span>
                <span className="text-xs text-gray-400">{o.faltam} produto(s) · potencial {o.score}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// --- Gráficos SVG ------------------------------------------------------------
function BarrasHealth({ dist }) {
  const itens = [
    { k: 'saudavel', label: 'Saudável', v: dist.saudavel, cor: COR.verde },
    { k: 'atencao', label: 'Atenção', v: dist.atencao, cor: COR.ambar },
    { k: 'risco', label: 'Risco', v: dist.risco, cor: COR.vermelho },
  ];
  const max = Math.max(1, ...itens.map((i) => i.v));
  return (
    <div id="bloco-vencimentos" className="flex items-end gap-6" style={{ height: 160 }}>
      {itens.map((i) => (
        <div key={i.k} className="flex flex-1 flex-col items-center justify-end">
          <span className="mb-1 text-sm font-semibold text-brand-navy dark:text-white">{i.v}</span>
          <div className="w-full rounded-t" style={{ height: `${(i.v / max) * 120}px`, background: i.cor, minHeight: 4 }} />
          <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

function LinhaReceita({ serie }) {
  if (!serie || serie.length === 0) return <p className="text-sm text-gray-400">Sem dados no período.</p>;
  const W = 320, H = 140, pad = 28;
  const max = Math.max(1, ...serie.flatMap((s) => [s.faturamento, s.comissao]));
  const x = (i) => pad + (i * (W - 2 * pad)) / Math.max(1, serie.length - 1);
  const y = (v) => H - pad - (v / max) * (H - 2 * pad);
  const linha = (key) => serie.map((s, i) => `${x(i)},${y(s[key])}`).join(' ');
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 280 }}>
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#e5e7eb" />
        <polyline fill="none" stroke={COR.azul} strokeWidth="2" points={linha('faturamento')} />
        <polyline fill="none" stroke={COR.ambar} strokeWidth="2" points={linha('comissao')} />
        {serie.map((s, i) => <text key={s.mes} x={x(i)} y={H - 8} fontSize="9" textAnchor="middle" fill="#94a3b8">{mesLabel(s.mes)}</text>)}
      </svg>
      <div className="mt-1 flex gap-4 text-xs">
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded" style={{ background: COR.azul }} /> Faturamento</span>
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded" style={{ background: COR.ambar }} /> Comissão</span>
      </div>
    </div>
  );
}

function BarrasCategoria({ mapa }) {
  const itens = Object.entries(mapa || {}).sort((a, b) => b[1] - a[1]);
  if (itens.length === 0) return <p className="text-sm text-gray-400">Sem dados no período.</p>;
  const max = Math.max(1, ...itens.map(([, v]) => v));
  return (
    <div className="space-y-2">
      {itens.map(([cat, v]) => (
        <div key={cat} className="flex items-center gap-2">
          <span className="w-24 shrink-0 text-xs capitalize text-gray-500 dark:text-gray-400">{cat.replace(/_/g, ' ')}</span>
          <div className="h-4 flex-1 rounded bg-gray-100 dark:bg-white/10">
            <div className="h-4 rounded" style={{ width: `${(v / max) * 100}%`, background: COR.azul, minWidth: 2 }} />
          </div>
          <span className="w-24 shrink-0 text-right text-xs text-gray-600 dark:text-gray-300">{formatBRL(v)}</span>
        </div>
      ))}
    </div>
  );
}

function BarrasRenovacao({ proj }) {
  const itens = [
    { label: '0-30d', d: proj.j0_30 },
    { label: '31-60d', d: proj.j31_60 },
    { label: '61-90d', d: proj.j61_90 },
  ];
  const max = Math.max(1, ...itens.map((i) => i.d.valor));
  return (
    <div className="flex items-end gap-6" style={{ height: 160 }}>
      {itens.map((i) => (
        <div key={i.label} className="flex flex-1 flex-col items-center justify-end">
          <span className="mb-1 text-xs font-semibold text-brand-navy dark:text-white">{i.d.qtd}</span>
          <div className="w-full rounded-t" style={{ height: `${(i.d.valor / max) * 110}px`, background: COR.azul, minHeight: 4 }} title={formatBRL(i.d.valor)} />
          <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">{i.label}</span>
          <span className="text-[10px] text-gray-400">{formatBRL(i.d.valor)}</span>
        </div>
      ))}
    </div>
  );
}
