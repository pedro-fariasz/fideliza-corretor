import { useEffect, useState } from 'react';
import {
  Columns3,
  List,
  Workflow,
  MessageSquareText,
  Heart,
  Inbox,
  MessageCircle,
  CheckCircle2,
  ShoppingBag,
  RotateCcw,
  Save,
  X,
  Sparkles,
} from 'lucide-react';
import { api } from '../../services/api';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { useTabIndicator } from '../../hooks/useTabIndicator';

// =============================================================================
// Fidelização — esteira automática de relacionamento com o cliente já
// adquirido (apólice ativa na Carteira). Não depende de "venda" como conceito
// de UI — o gatilho é o cliente ter entrado na carteira, não a venda em si.
// Um item de menu, 4 abas: Pipeline · Lista · Fluxos · Mensagens.
// =============================================================================

const ABAS = [
  { key: 'pipeline', label: 'Pipeline', icon: Columns3 },
  { key: 'lista', label: 'Lista', icon: List },
  { key: 'fluxos', label: 'Fluxos', icon: Workflow },
  { key: 'mensagens', label: 'Mensagens', icon: MessageSquareText },
];

const GATILHOS = [
  { value: 'venda', label: 'Dias após a venda' },
  { value: 'renovacao', label: 'Dias após a renovação' },
  { value: 'vencimento', label: 'Dias do vencimento (negativo = antes)' },
  { value: 'aniversario', label: 'Aniversário do cliente' },
];

const VARIAVEIS = ['[NOME]', '[PRODUTO]', '[VENCIMENTO]', '[VALOR]', '[CORRETOR]'];

const EXEMPLO = {
  NOME: 'Ana Souza',
  PRODUTO: 'Seguro Auto',
  VENCIMENTO: '10/08/2026',
  VALOR: 'R$ 1.200,00',
  CORRETOR: 'Você',
};

function renderExemplo(texto) {
  if (!texto) return '';
  return texto.replace(/\[([A-ZÀ-Ú_]+)\]/g, (m, k) => (EXEMPLO[k] != null ? EXEMPLO[k] : ''));
}

// Estilo compartilhado de card (idêntico ao do dashboard).
const CARD = 'rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-white/5';
const INPUT =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/40 dark:border-white/15 dark:bg-white/5 dark:text-white';

// Saúde como pill com bolinha colorida (semântica de status).
function HealthBadge({ value }) {
  let tone = 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300';
  let dot = 'bg-gray-400';
  if (value != null) {
    if (value >= 70) {
      tone = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
      dot = 'bg-emerald-500';
    } else if (value >= 40) {
      tone = 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
      dot = 'bg-amber-500';
    } else {
      tone = 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300';
      dot = 'bg-red-500';
    }
  }
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      Saúde {value == null ? '—' : value}
    </span>
  );
}

function NpsBadge({ nps }) {
  if (nps == null) return null;
  const cls =
    nps >= 9
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
      : nps <= 6
        ? 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300'
        : 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>NPS {nps}</span>;
}

export default function PosVendasPage() {
  const [aba, setAba] = useState('pipeline');
  const { containerRef: abasRef, style: abaIndicatorStyle } = useTabIndicator(aba);

  return (
    <div className="space-y-6">
      {/* Header de contexto */}
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue">
          <Heart size={20} />
        </span>
        <div>
          <h2 className="font-heading text-lg font-semibold text-brand-navy dark:text-white">
            Fidelização — relacionamento e manutenção
          </h2>
          <p className="mt-0.5 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            Depois que a venda vira apólice ativa, o cliente entra aqui pra manutenção do relacionamento —
            avança sozinho conforme o tempo passa. Configure os gatilhos e as mensagens por categoria, e
            acompanhe cada etapa.
          </p>
        </div>
      </div>

      {/* Abas — pill control com ícones */}
      <div
        ref={abasRef}
        role="tablist"
        aria-label="Seções de pós-vendas"
        className="relative inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-gray-50 p-1 dark:border-white/10 dark:bg-white/5"
      >
        <span
          className="tab-indicator bg-white shadow-sm dark:bg-white/10"
          style={abaIndicatorStyle}
          aria-hidden="true"
        />
        {ABAS.map((a) => {
          const Icon = a.icon;
          const active = aba === a.key;
          return (
            <button
              key={a.key}
              type="button"
              role="tab"
              data-tab-key={a.key}
              aria-selected={active}
              onClick={() => setAba(a.key)}
              className={`press relative inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-200 ${
                active
                  ? 'text-brand-blue dark:text-white'
                  : 'text-gray-500 hover:text-brand-navy dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              <Icon size={16} className={active ? '' : 'opacity-70'} />
              {a.label}
            </button>
          );
        })}
      </div>

      <div className="animate-rise">
        {aba === 'pipeline' && <PipelineTab />}
        {aba === 'lista' && <ListaTab />}
        {aba === 'fluxos' && <FluxosTab />}
        {aba === 'mensagens' && <MensagensTab />}
      </div>
    </div>
  );
}

// --- Abrir WhatsApp com a mensagem renderizada da etapa -----------------------
async function abrirWhatsApp(apoliceId, etapaChave) {
  try {
    const { texto, telefone } = await api.posvendasMensagem(apoliceId, etapaChave);
    const num = (telefone || '').replace(/\D/g, '');
    const base = num ? `https://wa.me/${num}` : 'https://wa.me/';
    window.open(`${base}?text=${encodeURIComponent(texto || '')}`, '_blank', 'noopener');
  } catch (err) {
    alert(err.message || 'Não foi possível montar a mensagem.');
  }
}

// Erro/loading compartilhados.
function ErrorBox({ children }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
      {children}
    </div>
  );
}
function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500 dark:text-gray-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-brand-blue" />
      Carregando...
    </div>
  );
}

// =============================================================================
// Aba Pipeline
// =============================================================================
function PipelineTab() {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function carregar() {
    setLoading(true);
    setError('');
    try {
      setDados(await api.posvendasPipeline());
    } catch (err) {
      setError(err.message || 'Erro ao carregar o pipeline.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    carregar();
  }, []);

  async function marcarFeito(apoliceId) {
    try {
      await api.posvendasMarcarFeito(apoliceId);
      await carregar();
    } catch (err) {
      alert(err.message || 'Erro ao marcar como feito.');
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBox>{error}</ErrorBox>;

  const { colunas, cards, contadores } = dados;
  const vazio = (contadores.total || 0) === 0;

  if (vazio) {
    return (
      <div className={`${CARD} p-6`}>
        <EmptyState
          icon={Inbox}
          title="Nenhum cliente na esteira ainda"
          description="Assim que um lead vira cliente (apólice ativa na Carteira), ele entra aqui automaticamente — a primeira etapa é no dia seguinte."
          cta={{ to: '/clientes/leads', label: 'Ir para Leads' }}
        />
        <NextSteps />
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {colunas.map((col, colIndex) => (
        <div key={col.chave} style={{ '--rise-delay': `${colIndex * 60}ms` }} className="animate-rise w-72 shrink-0">
          <div className="mb-3 flex items-center justify-between px-1">
            <h3 className="font-heading text-sm font-semibold text-brand-navy dark:text-white">{col.nome}</h3>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-white/10 dark:text-gray-300">
              {contadores[col.chave] || 0}
            </span>
          </div>
          <div className="space-y-3">
            {(cards[col.chave] || []).map((c) => (
              <div
                key={c.id}
                className={`${CARD} p-4 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.99]`}
              >
                <div className="flex items-start gap-3">
                  <Avatar nome={c.cliente_nome} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-medium text-brand-navy dark:text-white">{c.cliente_nome}</p>
                      {c.concluido && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                          <CheckCircle2 size={11} /> Feito
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">{c.produto_nome}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <HealthBadge value={c.health_score} />
                  <NpsBadge nps={c.nps} />
                  {c.dias_na_etapa != null && (
                    <span className="text-[11px] text-gray-400">{c.dias_na_etapa}d na etapa</span>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => abrirWhatsApp(c.id, c.etapa_chave)}
                    className="press inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
                  >
                    <MessageCircle size={13} /> WhatsApp
                  </button>
                  {!c.concluido && col.chave !== 'aguardando' && (
                    <button
                      type="button"
                      onClick={() => marcarFeito(c.id)}
                      className="press inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-brand-navy dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                    >
                      <CheckCircle2 size={13} /> Marcar feito
                    </button>
                  )}
                </div>
              </div>
            ))}
            {(cards[col.chave] || []).length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 py-6 text-center text-xs text-gray-300 dark:border-white/10 dark:text-gray-600">
                Vazio
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Sugestões de próximos passos no estado vazio.
function NextSteps() {
  const passos = [
    { icon: ShoppingBag, texto: 'Cadastre um cliente (PDF ou manual) — ele entra na esteira quando a apólice fica ativa.' },
    { icon: Workflow, texto: 'Ajuste os gatilhos de cada etapa na aba Fluxos.' },
    { icon: MessageSquareText, texto: 'Personalize as mensagens por categoria na aba Mensagens.' },
  ];
  return (
    <div className="mx-auto mt-6 grid max-w-2xl gap-3 sm:grid-cols-3">
      {passos.map((p, i) => {
        const Icon = p.icon;
        return (
          <div
            key={i}
            className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 text-left dark:border-white/10 dark:bg-white/5"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue">
              <Icon size={16} />
            </span>
            <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{p.texto}</p>
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// Aba Lista
// =============================================================================
const CROSS_CLOSE_MS = 180;

function ListaTab() {
  const [linhas, setLinhas] = useState(null);
  const [error, setError] = useState('');
  const [cross, setCross] = useState(null); // { cliente, itens }
  const [crossClosing, setCrossClosing] = useState(false);

  useEffect(() => {
    api.posvendasLista().then(setLinhas).catch((e) => setError(e.message || 'Erro ao carregar.'));
  }, []);

  async function verCrossSell(linha) {
    try {
      const itens = await api.posvendasCrossSell(linha.id);
      setCrossClosing(false);
      setCross({ cliente: linha.cliente_nome, itens });
    } catch (err) {
      alert(err.message || 'Erro ao buscar cross-sell.');
    }
  }

  function fecharCross() {
    setCrossClosing(true);
    window.setTimeout(() => {
      setCross(null);
      setCrossClosing(false);
    }, CROSS_CLOSE_MS);
  }

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!linhas) return <Loading />;
  if (linhas.length === 0)
    return (
      <div className={`${CARD} p-6`}>
        <EmptyState
          icon={Inbox}
          title="Nenhum cliente na esteira ainda"
          description="Assim que um cliente tiver apólice ativa na Carteira, ele aparece aqui para acompanhamento."
          cta={{ to: '/clientes/carteira', label: 'Ir para a Carteira' }}
        />
      </div>
    );

  return (
    <>
      <div className={`${CARD} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400 dark:border-white/10">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Saúde</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Etapa</th>
                <th className="px-4 py-3 w-40">Progresso</th>
                <th className="px-4 py-3">Dias</th>
                <th className="px-4 py-3">NPS</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {linhas.map((l, i) => (
                <tr
                  key={l.id}
                  style={{ '--rise-delay': `${Math.min(i, 10) * 30}ms` }}
                  className="animate-rise-row transition-colors hover:bg-gray-50/70 dark:hover:bg-white/5"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar nome={l.cliente_nome} size="sm" />
                      <span className="font-medium text-brand-navy dark:text-white">{l.cliente_nome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <HealthBadge value={l.health_score} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{l.produto_nome}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{l.etapa_nome}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                        <div
                          className="h-full rounded-full bg-brand-blue"
                          style={{ width: `${Math.max(0, Math.min(100, l.progresso || 0))}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-gray-400">{l.progresso}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{l.dias_na_etapa == null ? '—' : `${l.dias_na_etapa}d`}</td>
                  <td className="px-4 py-3">{<NpsBadge nps={l.nps} /> || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => verCrossSell(l)}
                      className="press inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-brand-blue transition-colors hover:text-brand-blue-dark"
                    >
                      <Sparkles size={14} /> Cross-sell
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {cross && (
        <div
          className={`modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/50 p-4 backdrop-blur-sm ${crossClosing ? 'is-closing' : ''}`}
          onMouseDown={fecharCross}
        >
          <div
            className={`modal-panel w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-brand-navy ${crossClosing ? 'is-closing' : ''}`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue">
                  <Sparkles size={18} />
                </span>
                <h3 className="font-heading text-lg font-semibold text-brand-navy dark:text-white">
                  Oportunidades
                </h3>
              </div>
              <button
                type="button"
                onClick={fecharCross}
                aria-label="Fechar"
                className="press rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Para {cross.cliente}</p>

            {cross.itens.length === 0 ? (
              <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                O cliente já tem todos os produtos ativos da conta. 🎯
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {cross.itens.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5"
                  >
                    <span className="flex items-center gap-2 text-brand-navy dark:text-white">
                      <ShoppingBag size={15} className="text-brand-blue" />
                      {p.nome}
                    </span>
                    <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-xs font-semibold text-brand-blue">
                      {p.percentual}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={fecharCross}
                className="press rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// =============================================================================
// Seletor de categoria (compartilhado por Fluxos e Mensagens)
// =============================================================================
function useCategorias() {
  const [cats, setCats] = useState([]);
  useEffect(() => {
    api.posvendasCategorias().then(setCats).catch(() => setCats([]));
  }, []);
  return cats;
}

function CategoriaSelect({ cats, valor, onChange }) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Categoria"
      className={`${INPUT} w-auto`}
    >
      {cats.map((c) => (
        <option key={c.valor} value={c.valor}>
          {c.label}
        </option>
      ))}
    </select>
  );
}

// =============================================================================
// Aba Fluxos (configurador de etapas por categoria)
// =============================================================================
function FluxosTab() {
  const cats = useCategorias();
  const [categoria, setCategoria] = useState('geral');
  const [etapas, setEtapas] = useState(null);
  const [error, setError] = useState('');

  async function carregar(cat) {
    setEtapas(null);
    setError('');
    try {
      const r = await api.posvendasFluxo(cat);
      setEtapas(r.etapas);
    } catch (err) {
      setError(err.message || 'Erro ao carregar o fluxo.');
    }
  }
  useEffect(() => {
    carregar(categoria);
  }, [categoria]);

  function patchLocal(id, campo, valor) {
    setEtapas((es) => es.map((e) => (e.id === id ? { ...e, [campo]: valor } : e)));
  }

  async function salvarEtapa(etapa) {
    try {
      await api.posvendasAtualizarEtapa(etapa.id, {
        nome: etapa.nome,
        gatilho_tipo: etapa.gatilho_tipo,
        gatilho_dias: Number(etapa.gatilho_dias),
        ativo: etapa.ativo,
        ordem: Number(etapa.ordem),
      });
    } catch (err) {
      alert(err.message || 'Erro ao salvar a etapa.');
    }
  }

  async function restaurar() {
    if (
      !window.confirm(
        'Restaurar o fluxo de fábrica desta categoria? Isso descarta as personalizações das etapas e mensagens.'
      )
    )
      return;
    try {
      const r = await api.posvendasRestaurarFluxo(categoria);
      setEtapas(r.etapas);
    } catch (err) {
      alert(err.message || 'Erro ao restaurar.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CategoriaSelect cats={cats} valor={categoria} onChange={setCategoria} />
        <button
          type="button"
          onClick={restaurar}
          className="press inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-brand-navy dark:text-gray-400 dark:hover:text-white"
        >
          <RotateCcw size={14} /> Restaurar padrão da categoria
        </button>
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}
      {!etapas ? (
        <Loading />
      ) : (
        <div className="space-y-3">
          {etapas.map((e) => (
            <div
              key={e.id}
              className={`${CARD} grid grid-cols-1 gap-3 p-4 transition-shadow hover:shadow-md sm:grid-cols-12 sm:items-end`}
            >
              <div className="sm:col-span-3">
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Etapa</label>
                <input value={e.nome} onChange={(ev) => patchLocal(e.id, 'nome', ev.target.value)} className={INPUT} />
              </div>
              <div className="sm:col-span-4">
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Gatilho</label>
                <select
                  value={e.gatilho_tipo}
                  onChange={(ev) => patchLocal(e.id, 'gatilho_tipo', ev.target.value)}
                  className={INPUT}
                >
                  {GATILHOS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Dias</label>
                <input
                  type="number"
                  value={e.gatilho_dias}
                  disabled={e.gatilho_tipo === 'aniversario'}
                  onChange={(ev) => patchLocal(e.id, 'gatilho_dias', ev.target.value)}
                  className={`${INPUT} disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-white/10`}
                />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <input
                  id={`ativo-${e.id}`}
                  type="checkbox"
                  checked={e.ativo}
                  onChange={(ev) => patchLocal(e.id, 'ativo', ev.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
                />
                <label htmlFor={`ativo-${e.id}`} className="text-sm text-gray-600 dark:text-gray-300">
                  Ativa
                </label>
              </div>
              <div className="sm:col-span-1">
                <button
                  type="button"
                  onClick={() => salvarEtapa(e)}
                  aria-label="Salvar etapa"
                  className="press inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-dark"
                >
                  <Save size={14} /> Salvar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Aba Mensagens (editor de templates por categoria × etapa)
// =============================================================================
function MensagensTab() {
  const cats = useCategorias();
  const [categoria, setCategoria] = useState('geral');
  const [msgs, setMsgs] = useState(null);
  const [error, setError] = useState('');

  async function carregar(cat) {
    setMsgs(null);
    setError('');
    try {
      setMsgs(await api.posvendasMensagens(cat));
    } catch (err) {
      setError(err.message || 'Erro ao carregar as mensagens.');
    }
  }
  useEffect(() => {
    carregar(categoria);
  }, [categoria]);

  function patchLocal(chave, texto) {
    setMsgs((ms) => ms.map((m) => (m.etapa_chave === chave ? { ...m, texto } : m)));
  }

  async function salvar(m) {
    try {
      const salva = await api.posvendasSalvarMensagem(categoria, m.etapa_chave, m.texto);
      patchLocal(m.etapa_chave, salva.texto);
    } catch (err) {
      alert(err.message || 'Erro ao salvar a mensagem.');
    }
  }

  async function redefinir(m) {
    try {
      const nova = await api.posvendasRedefinirMensagem(categoria, m.etapa_chave);
      patchLocal(m.etapa_chave, nova.texto);
    } catch (err) {
      alert(err.message || 'Erro ao redefinir.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CategoriaSelect cats={cats} valor={categoria} onChange={setCategoria} />
        <p className="flex flex-wrap items-center gap-1 text-xs text-gray-400">
          <span className="font-medium">Variáveis:</span>
          {VARIAVEIS.map((v) => (
            <code
              key={v}
              className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-600 dark:bg-white/10 dark:text-gray-300"
            >
              {v}
            </code>
          ))}
        </p>
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}
      {!msgs ? (
        <Loading />
      ) : (
        <div className="space-y-4">
          {msgs.map((m) => (
            <div key={m.etapa_chave} className={`${CARD} p-4`}>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-heading text-sm font-semibold capitalize text-brand-navy dark:text-white">
                  {m.etapa_chave.replace(/_/g, ' ')}
                </h4>
                {m.is_padrao && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-white/10 dark:text-gray-300">
                    Padrão
                  </span>
                )}
              </div>
              <textarea
                value={m.texto}
                onChange={(e) => patchLocal(m.etapa_chave, e.target.value)}
                rows={3}
                className={INPUT}
              />
              <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                <span className="font-medium text-gray-400">Prévia:</span> {renderExemplo(m.texto)}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => salvar(m)}
                  className="press inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-dark"
                >
                  <Save size={14} /> Salvar
                </button>
                <button
                  type="button"
                  onClick={() => redefinir(m)}
                  className="press inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-brand-navy dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <RotateCcw size={14} /> Redefinir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
