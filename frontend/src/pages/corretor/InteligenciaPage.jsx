import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lightbulb,
  ShieldCheck,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  Star,
  TrendingUp,
  Package,
  XCircle,
  CalendarClock,
  ArrowRight,
  Sparkles,
  Target,
} from 'lucide-react';
import { api } from '../../services/api';
import { formatBRL } from '../../utils/format';
import { useAuth } from '../../hooks/useAuth';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';

// =============================================================================
// Inteligência / BI de Carteira (Fase 3). Lê agregados do backend (job noturno
// + cache), respeitando o escopo de permissão. Gráficos em SVG puro (sem lib) —
// agora com tooltips no hover, donut, eixos e legendas. Redesign visual.
// =============================================================================

// Período (pill control). '12m' mapeia para o valor '1a' do backend.
const PERIODOS = [
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: '1a', label: '12m' },
];

const ESCOPOS = [
  { value: 'meus', label: 'Meus dados' },
  { value: 'equipe', label: 'Minha equipe' },
  { value: 'empresa', label: 'Toda a empresa' },
];

// Paleta validada (dataviz): azul de marca + âmbar-600 (contraste/CVD ok no claro;
// no escuro sobe pra âmbar-400 via currentColor). Status em verde/âmbar/vermelho,
// sempre com rótulo (nunca cor sozinha).
const COR = { azul: '#1E5EFF', verde: '#10b981', ambar: '#f59e0b', vermelho: '#ef4444' };

const CARD = 'rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-white/5';
const SELECT =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/40 dark:border-white/15 dark:bg-white/5 dark:text-white';

const faixaTone = {
  verde: 'text-emerald-600 dark:text-emerald-400',
  amarelo: 'text-amber-600 dark:text-amber-400',
  vermelho: 'text-red-600 dark:text-red-400',
  sem_dados: 'text-gray-400',
};
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesLabel = (m) => {
  const [, mm] = m.split('-');
  return MESES[Number(mm) - 1];
};

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
  const [conversao, setConversao] = useState(null); // % leads→vendas (de /api/desempenho)
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

  // Conversão (leads→vendas) vem do módulo de Desempenho — respeita o período.
  useEffect(() => {
    let vivo = true;
    api
      .desempenho({ periodo })
      .then((d) => {
        if (!vivo) return;
        const vs = Array.isArray(d?.vendedores) ? d.vendedores : [];
        if (vs.length === 0) return setConversao(null);
        const media = vs.reduce((s, v) => s + Number(v.taxa_conversao || 0), 0) / vs.length;
        setConversao(Math.round(media * 10) / 10);
      })
      .catch(() => vivo && setConversao(null));
    return () => {
      vivo = false;
    };
  }, [periodo, escopo, corretorId]);
  useEffect(() => {
    carregar(); /* eslint-disable-next-line */
  }, [periodo, escopo, corretorId]);

  function irParaCta(cta) {
    if (cta.link) {
      navigate(cta.link);
      return;
    }
    const el = document.getElementById(`bloco-${cta.acao}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const vazio = dados && dados.base && dados.base.apolices_ativas === 0;

  return (
    <div className="space-y-6">
      {/* Filtros globais */}
      <div className="flex flex-wrap items-center gap-3">
        {podeEscopo && (
          <select
            value={escopo}
            onChange={(e) => {
              setEscopo(e.target.value);
              setCorretorId('');
            }}
            aria-label="Escopo"
            className={SELECT}
          >
            {ESCOPOS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        )}
        {podeEscopo && corretores.length > 0 && (
          <select
            value={corretorId}
            onChange={(e) => setCorretorId(e.target.value)}
            aria-label="Corretor"
            className={SELECT}
          >
            <option value="">Todos os corretores</option>
            {corretores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        )}

        {/* Período — segmented pill control */}
        <div
          role="tablist"
          aria-label="Período"
          className="ml-auto inline-flex gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-gray-50 p-1 dark:border-white/10 dark:bg-white/5"
        >
          {PERIODOS.map((p) => {
            const active = periodo === p.value;
            return (
              <button
                key={p.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPeriodo(p.value)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-white text-brand-blue shadow-sm dark:bg-white/10 dark:text-white'
                    : 'text-gray-500 hover:text-brand-navy dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading && <BiSkeleton />}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && vazio && <VazioInteligencia navigate={navigate} />}
      {!loading && !error && dados && !vazio && (
        <Painel dados={dados} conversao={conversao} onCta={irParaCta} navigate={navigate} />
      )}
    </div>
  );
}

// --- Estado vazio engajador ---------------------------------------------------
function VazioInteligencia({ navigate }) {
  const dicas = [
    { icon: ShieldCheck, t: 'Score de saúde', d: 'Saiba quais clientes estão em risco de cancelar.' },
    { icon: TrendingUp, t: 'Receita garantida', d: 'Projeção do que já está contratado e a renovar.' },
    { icon: Sparkles, t: 'Cross-sell', d: 'Quem tem perfil para um segundo produto.' },
  ];
  return (
    <div className={`${CARD} p-6`}>
      <EmptyState
        icon={Lightbulb}
        title="Sua central de inteligência ainda está no escuro"
        description="Registre vendas para desbloquear insights sobre a saúde da carteira, receita a renovar e oportunidades de cross-sell."
        cta={{ to: '/funil', label: 'Ir para o funil' }}
      />
      <div className="mx-auto mt-6 grid max-w-3xl gap-3 sm:grid-cols-3">
        {dicas.map((x) => {
          const Icon = x.icon;
          return (
            <div
              key={x.t}
              className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-white/10 dark:bg-white/5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue">
                <Icon size={17} />
              </span>
              <p className="mt-2.5 text-sm font-semibold text-brand-navy dark:text-white">{x.t}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{x.d}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Cabeçalho de card --------------------------------------------------------
function CardHead({ title, right }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h3 className="font-heading text-sm font-semibold text-brand-navy dark:text-white">{title}</h3>
      {right}
    </div>
  );
}

const KPI_TONES = {
  blue: 'bg-brand-blue/10 text-brand-blue',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  red: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
};

function Kpi({ icon: Icon, tone = 'blue', label, value, valueCls }) {
  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${KPI_TONES[tone]}`}>
          <Icon size={16} aria-hidden="true" />
        </span>
      </div>
      <p className={`mt-2 font-heading text-xl font-bold ${valueCls || 'text-brand-navy dark:text-white'}`}>
        {value}
      </p>
    </div>
  );
}

// Card de KPI principal (top bar). Clicável quando recebe onClick.
function HeroKpi({ icon: Icon, tone = 'blue', label, value, valueCls, hint, onClick }) {
  const clickable = typeof onClick === 'function';
  const Tag = clickable ? 'button' : 'div';
  return (
    <Tag
      type={clickable ? 'button' : undefined}
      onClick={onClick}
      className={`${CARD} p-5 text-left ${clickable ? 'group transition-all hover:-translate-y-0.5 hover:shadow-md' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${KPI_TONES[tone]}`}>
          <Icon size={20} aria-hidden="true" />
        </span>
        {clickable && <ArrowRight size={15} className="text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-blue" />}
      </div>
      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 font-heading text-[1.7rem] font-bold leading-none ${valueCls || 'text-brand-navy dark:text-white'}`}>{value}</p>
      {hint && <p className="mt-1.5 text-xs text-gray-400">{hint}</p>}
    </Tag>
  );
}

function Painel({ dados, conversao, onCta, navigate }) {
  const c = dados.cards;
  // Cor da Saúde Geral por faixa (verde/âmbar/vermelho).
  const saudeTone = c.faixa === 'verde' ? 'emerald' : c.faixa === 'vermelho' ? 'red' : c.faixa === 'amarelo' ? 'amber' : 'blue';

  const secundarios = [
    { icon: AlertTriangle, tone: 'red', label: 'Receita em risco', value: formatBRL(c.receita_risco), valueCls: 'text-red-600 dark:text-red-400' },
    { icon: RefreshCw, tone: 'blue', label: 'Taxa de renovação', value: c.taxa_renovacao == null ? '—' : `${c.taxa_renovacao}%` },
    { icon: Star, tone: 'amber', label: 'NPS', value: c.nps == null ? '—' : c.nps },
    { icon: TrendingUp, tone: 'violet', label: 'LTV médio', value: formatBRL(c.ltv_medio) },
    { icon: Package, tone: 'blue', label: 'Produtos/cliente', value: c.produtos_por_cliente == null ? '—' : c.produtos_por_cliente },
    { icon: CalendarClock, tone: 'amber', label: 'Vencem em 30d', value: c.vencimentos_30d },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs principais — top bar (empilha < 768px) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HeroKpi
          icon={ShieldCheck}
          tone={saudeTone}
          label="Saúde geral"
          value={c.score_saude == null ? '—' : c.score_saude}
          valueCls={faixaTone[c.faixa]}
          hint="Score médio da carteira"
        />
        <HeroKpi icon={DollarSign} tone="blue" label="Receita garantida" value={formatBRL(c.receita_garantida)} hint="Apólices vigentes" />
        <HeroKpi
          icon={XCircle}
          tone="red"
          label="Taxa de churn"
          value={c.taxa_cancelamento == null ? '—' : `${c.taxa_cancelamento}%`}
          hint="Cancelamentos no período"
          onClick={() => navigate('/carteira')}
        />
        <HeroKpi icon={Target} tone="violet" label="Conversão" value={conversao == null ? '—' : `${conversao}%`} hint="Leads que viraram vendas" />
      </div>

      {/* Métricas secundárias */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {secundarios.map((k) => (
          <Kpi key={k.label} {...k} />
        ))}
      </div>

      {/* Insights */}
      {dados.insights && dados.insights.length > 0 && (
        <section className={`${CARD} p-5`}>
          <CardHead
            title="Insights"
            right={
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <Lightbulb size={14} className="text-brand-amber" /> gerados da sua carteira
              </span>
            }
          />
          <ul className="space-y-2">
            {dados.insights.map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5 dark:border-white/10 dark:bg-white/5"
              >
                <span className="flex items-center gap-2 text-sm text-brand-navy dark:text-gray-100">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      i.severidade === 'alerta' ? 'bg-red-500' : i.severidade === 'positivo' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  {i.texto}
                </span>
                <button
                  type="button"
                  onClick={() => onCta(i.cta)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue transition-colors hover:text-brand-blue-dark"
                >
                  {i.cta.label} <ArrowRight size={12} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section id="bloco-vencimentos" className={`${CARD} p-5`}>
          <CardHead title="Distribuição por saúde" />
          <DonutHealth dist={dados.health_distribuicao} />
        </section>
        <section className={`${CARD} p-5`}>
          <CardHead title="Receita — últimos 6 meses" />
          <LinhaReceita serie={dados.receita_mensal} />
        </section>
        <section className={`${CARD} p-5`}>
          <CardHead title="Receita por categoria" />
          <BarrasCategoria mapa={dados.receita_por_categoria} />
        </section>
        <section id="bloco-renovacoes" className={`${CARD} p-5`}>
          <CardHead title="Projeção de renovações" />
          <BarrasRenovacao proj={dados.projecao_renovacoes} />
        </section>
      </div>

      {/* Churn */}
      <section id="bloco-churn" className={`${CARD} p-5`}>
        <CardHead
          title="Risco de churn"
          right={
            <div className="flex flex-wrap gap-1.5 text-xs">
              <Chip tone="red">Alto {dados.churn.segmentos.alto}</Chip>
              <Chip tone="amber">Médio {dados.churn.segmentos.medio}</Chip>
              <Chip tone="emerald">Baixo {dados.churn.segmentos.baixo}</Chip>
            </div>
          }
        />
        {dados.churn.top20.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum cliente em risco no escopo atual.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400 dark:border-white/10">
                  <th className="px-3 py-2.5">Cliente</th>
                  <th className="px-3 py-2.5">Probabilidade</th>
                  <th className="px-3 py-2.5">Comissão em risco</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {dados.churn.top20.map((c2) => {
                  const pct = Math.round(c2.prob * 100);
                  const tone = c2.prob > 0.7 ? 'red' : c2.prob >= 0.4 ? 'amber' : 'emerald';
                  return (
                    <tr key={c2.apolice_id} className="transition-colors hover:bg-gray-50/70 dark:hover:bg-white/5">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar nome={c2.cliente_nome} size="sm" />
                          <span className="font-medium text-brand-navy dark:text-white">{c2.cliente_nome}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                            <div
                              className={`h-full rounded-full ${tone === 'red' ? 'bg-red-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold ${faixaTone[tone === 'red' ? 'vermelho' : tone === 'amber' ? 'amarelo' : 'verde']}`}>
                            {pct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">{formatBRL(c2.valor_risco)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Quadrante inferior: atividades (esquerda) + cross-sell (direita) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LogAtividades />

        <section id="bloco-crosssell" className={`${CARD} p-5`}>
          <CardHead title="Oportunidades de cross-sell" />
          {!dados.crosssell || dados.crosssell.length === 0 ? (
            <p className="text-sm text-gray-400">Sem oportunidades no escopo atual.</p>
          ) : (
            <ul className="space-y-2">
              {dados.crosssell.map((o) => (
                <li
                  key={o.cliente_id}
                  className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5"
                >
                  <span className="flex items-center gap-2.5">
                    <Avatar nome={o.cliente_nome} size="sm" />
                    <span className="font-medium text-brand-navy dark:text-white">{o.cliente_nome}</span>
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">
                    {o.faltam} produto(s) · potencial {o.score}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

// --- Feed de atividades (GET /api/atividades) --------------------------------
const ACOES_PT = {
  promovido_de_lead: 'promoveu lead a cliente',
  cliente_cancelado_recuperavel: 'cancelou cliente (recuperável)',
  cliente_virou_lead_frio: 'moveu cliente pro funil como risco',
  cliente_falecimento: 'encerrou cliente por falecimento',
  notificacao_criada: 'criou notificação',
  notificacao_enviada: 'marcou notificação como enviada',
  retomada_agendada: 'agendou retomada de contato',
};

export function traduzirAcao(acao) {
  if (!acao) return '';
  return ACOES_PT[acao] || String(acao).replace(/_/g, ' ');
}

const ENTIDADE_PT = {
  lead: 'lead',
  cliente: 'cliente',
  venda: 'venda',
  apolice: 'apólice',
  plataforma: 'plataforma',
  tag: 'tag',
  sistema: 'sistema',
};

// "quando humano" relativo (há minutos/horas, ontem, ou data curta).
function quandoHumano(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return 'ontem';
  if (diffD < 7) return `há ${diffD} dias`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function LogAtividades() {
  const [itens, setItens] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    api
      .atividades({ limit: 20 })
      .then((d) => vivo && setItens(Array.isArray(d) ? d : []))
      .catch((e) => vivo && setError(e.message || 'Erro ao carregar atividades.'));
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <section className={`${CARD} p-5`}>
      <CardHead
        title="Atividades recentes"
        right={<span className="text-xs text-gray-400">últimas {itens ? itens.length : 20}</span>}
      />
      {error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : itens == null ? (
        <ul className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="shimmer h-4 w-full rounded bg-gray-100 dark:bg-white/10" />
          ))}
        </ul>
      ) : itens.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhuma atividade registrada ainda.</p>
      ) : (
        <ul className="space-y-2.5">
          {itens.map((a) => (
            <li key={a.id} className="flex items-start gap-2.5 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue/60" aria-hidden="true" />
              <p className="text-gray-600 dark:text-gray-300">
                <span className="text-xs text-gray-400">{quandoHumano(a.criado_em)}</span>{' '}
                <span className="text-gray-400">—</span>{' '}
                <span className="font-medium text-brand-navy dark:text-white">{a.usuario_nome}</span>{' '}
                {traduzirAcao(a.acao)}{' '}
                <span className="text-gray-500 dark:text-gray-400">{ENTIDADE_PT[a.entidade] || a.entidade}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Chip({ tone, children }) {
  const tones = {
    red: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  };
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

// =============================================================================
// Tooltip flutuante reutilizável (posicionado dentro de um wrapper `relative`).
// =============================================================================
function Tip({ show, x, y, children }) {
  if (!show) return null;
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-brand-navy px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg dark:bg-black/80"
      style={{ left: x, top: y - 8 }}
    >
      {children}
    </div>
  );
}

// =============================================================================
// Donut de saúde (status: verde/âmbar/vermelho, sempre com legenda).
// =============================================================================
function DonutHealth({ dist }) {
  const [hover, setHover] = useState(null);
  const itens = [
    { k: 'saudavel', label: 'Saudável', v: dist.saudavel || 0, cor: COR.verde },
    { k: 'atencao', label: 'Atenção', v: dist.atencao || 0, cor: COR.ambar },
    { k: 'risco', label: 'Risco', v: dist.risco || 0, cor: COR.vermelho },
  ];
  const total = itens.reduce((s, i) => s + i.v, 0);
  const R = 60;
  const C = 2 * Math.PI * R;
  let acc = 0;

  if (total === 0) return <p className="text-sm text-gray-400">Sem apólices no escopo.</p>;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-around">
      <div className="relative" style={{ width: 160, height: 160 }}>
        <svg viewBox="0 0 160 160" className="h-40 w-40 -rotate-90">
          <circle cx="80" cy="80" r={R} fill="none" stroke="currentColor" strokeWidth="20" className="text-gray-100 dark:text-white/10" />
          {itens.map((i) => {
            if (i.v === 0) return null;
            const frac = i.v / total;
            const dash = frac * C;
            const el = (
              <circle
                key={i.k}
                cx="80"
                cy="80"
                r={R}
                fill="none"
                stroke={i.cor}
                strokeWidth={hover === i.k ? 24 : 20}
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-acc}
                className="cursor-pointer transition-[stroke-width]"
                onMouseEnter={() => setHover(i.k)}
                onMouseLeave={() => setHover(null)}
              />
            );
            acc += dash;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-2xl font-bold text-brand-navy dark:text-white">{total}</span>
          <span className="text-[11px] text-gray-400">apólices</span>
        </div>
      </div>

      <ul className="space-y-2">
        {itens.map((i) => {
          const pct = total ? Math.round((i.v / total) * 100) : 0;
          return (
            <li
              key={i.k}
              onMouseEnter={() => setHover(i.k)}
              onMouseLeave={() => setHover(null)}
              className={`flex cursor-default items-center gap-2 rounded-lg px-2 py-1 text-sm transition-colors ${
                hover === i.k ? 'bg-gray-50 dark:bg-white/5' : ''
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.cor }} />
              <span className="text-gray-600 dark:text-gray-300">{i.label}</span>
              <span className="ml-auto pl-4 font-semibold tabular-nums text-brand-navy dark:text-white">{i.v}</span>
              <span className="w-9 text-right text-xs text-gray-400">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// =============================================================================
// Linha de receita (2 séries) — área + linha, gridlines, crosshair + tooltip.
// =============================================================================
function LinhaReceita({ serie }) {
  const wrapRef = useRef(null);
  const [idx, setIdx] = useState(null);
  if (!serie || serie.length === 0) return <p className="text-sm text-gray-400">Sem dados no período.</p>;

  const W = 340,
    H = 170,
    padX = 34,
    padY = 22;
  const max = Math.max(1, ...serie.flatMap((s) => [s.faturamento, s.comissao]));
  const x = (i) => padX + (i * (W - 2 * padX)) / Math.max(1, serie.length - 1);
  const y = (v) => H - padY - (v / max) * (H - 2 * padY);
  const pontos = (key) => serie.map((s, i) => `${x(i)},${y(s[key])}`).join(' ');
  const area = `${padX},${H - padY} ${pontos('faturamento')} ${x(serie.length - 1)},${H - padY}`;

  function onMove(e) {
    const rect = wrapRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0,
      bd = Infinity;
    serie.forEach((_, i) => {
      const d = Math.abs(x(i) - px);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    setIdx(best);
  }

  const gridY = [0, 0.5, 1];

  return (
    <div>
      <div ref={wrapRef} className="relative" onMouseMove={onMove} onMouseLeave={() => setIdx(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {/* gridlines */}
          {gridY.map((g) => (
            <line
              key={g}
              x1={padX}
              y1={y(max * g)}
              x2={W - padX}
              y2={y(max * g)}
              stroke="currentColor"
              strokeWidth="1"
              className="text-gray-100 dark:text-white/10"
            />
          ))}
          {/* área faturamento */}
          <polygon points={area} fill={COR.azul} opacity="0.08" />
          {/* linhas */}
          <polyline fill="none" stroke={COR.azul} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={pontos('faturamento')} className="text-brand-blue" />
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={pontos('comissao')}
            className="text-amber-600 dark:text-amber-400"
          />
          {/* crosshair */}
          {idx != null && (
            <>
              <line x1={x(idx)} y1={padY - 6} x2={x(idx)} y2={H - padY} stroke="currentColor" strokeWidth="1" className="text-gray-300 dark:text-white/20" />
              <circle cx={x(idx)} cy={y(serie[idx].faturamento)} r="4" fill={COR.azul} stroke="#fff" strokeWidth="1.5" />
              <circle cx={x(idx)} cy={y(serie[idx].comissao)} r="4" className="fill-amber-600 dark:fill-amber-400" stroke="#fff" strokeWidth="1.5" />
            </>
          )}
          {/* labels de mês */}
          {serie.map((s, i) => (
            <text key={s.mes} x={x(i)} y={H - 6} fontSize="9" textAnchor="middle" fill="currentColor" className="text-gray-400">
              {mesLabel(s.mes)}
            </text>
          ))}
        </svg>
        {idx != null && (
          <Tip show x={`${(x(idx) / W) * 100}%`} y={y(Math.max(serie[idx].faturamento, serie[idx].comissao))} >
            <div className="mb-0.5 font-semibold capitalize">{mesLabel(serie[idx].mes)}</div>
            <div>Fat.: {formatBRL(serie[idx].faturamento)}</div>
            <div>Com.: {formatBRL(serie[idx].comissao)}</div>
          </Tip>
        )}
      </div>
      <Legenda
        itens={[
          { label: 'Faturamento', cls: 'bg-brand-blue' },
          { label: 'Comissão', cls: 'bg-amber-600 dark:bg-amber-400' },
        ]}
      />
    </div>
  );
}

function Legenda({ itens }) {
  return (
    <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
      {itens.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={`h-2 w-3 rounded ${i.cls}`} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

// =============================================================================
// Barras horizontais de receita por categoria (magnitude, hue único) + hover.
// =============================================================================
function BarrasCategoria({ mapa }) {
  const [hover, setHover] = useState(null);
  const itens = Object.entries(mapa || {}).sort((a, b) => b[1] - a[1]);
  if (itens.length === 0) return <p className="text-sm text-gray-400">Sem dados no período.</p>;
  const max = Math.max(1, ...itens.map(([, v]) => v));
  return (
    <div className="space-y-2.5">
      {itens.map(([cat, v]) => (
        <div key={cat} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-xs capitalize text-gray-500 dark:text-gray-400">{cat.replace(/_/g, ' ')}</span>
          <div
            className="group relative h-6 flex-1 overflow-hidden rounded-lg bg-gray-100 dark:bg-white/10"
            onMouseEnter={() => setHover(cat)}
            onMouseLeave={() => setHover(null)}
          >
            <div
              className="h-full rounded-lg bg-brand-blue transition-all duration-500"
              style={{ width: `${(v / max) * 100}%`, minWidth: 4 }}
            />
            {hover === cat && (
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-white mix-blend-difference">
                {formatBRL(v)}
              </span>
            )}
          </div>
          <span className="w-24 shrink-0 text-right text-xs font-medium tabular-nums text-gray-600 dark:text-gray-300">{formatBRL(v)}</span>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Barras verticais de projeção de renovações + tooltip no hover.
// =============================================================================
function BarrasRenovacao({ proj }) {
  const [hover, setHover] = useState(null);
  const itens = [
    { label: '0-30d', d: proj.j0_30 },
    { label: '31-60d', d: proj.j31_60 },
    { label: '61-90d', d: proj.j61_90 },
  ];
  const max = Math.max(1, ...itens.map((i) => i.d.valor));
  return (
    <div className="relative flex items-end justify-around gap-6" style={{ height: 176 }}>
      {itens.map((i) => {
        const h = (i.d.valor / max) * 120;
        return (
          <div
            key={i.label}
            className="flex flex-1 flex-col items-center justify-end"
            onMouseEnter={() => setHover(i.label)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="mb-1 text-xs font-semibold text-brand-navy dark:text-white">{i.d.qtd}</span>
            <div className="relative flex w-full justify-center">
              {hover === i.label && (
                <div className="pointer-events-none absolute bottom-full mb-1 whitespace-nowrap rounded-lg bg-brand-navy px-2 py-1 text-[11px] font-medium text-white shadow-lg dark:bg-black/80">
                  {i.d.qtd} apólice(s) · {formatBRL(i.d.valor)}
                </div>
              )}
              <div
                className="w-12 rounded-t-lg bg-brand-blue transition-all duration-500 hover:bg-brand-blue-dark"
                style={{ height: `${Math.max(4, h)}px` }}
              />
            </div>
            <span className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{i.label}</span>
            <span className="text-[10px] text-gray-400">{formatBRL(i.d.valor)}</span>
          </div>
        );
      })}
    </div>
  );
}

// --- Skeleton -----------------------------------------------------------------
function SkelBlock({ className = '' }) {
  return <div className={`shimmer rounded-md bg-gray-100 dark:bg-white/10 ${className}`} />;
}
function BiSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`${CARD} p-4`}>
            <SkelBlock className="h-3 w-16" />
            <SkelBlock className="mt-3 h-6 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className={`${CARD} p-5`}>
            <SkelBlock className="h-4 w-40" />
            <SkelBlock className="mt-4 h-40 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
