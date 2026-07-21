import { useEffect, useState } from 'react';
import { api } from '../../services/api';

// =============================================================================
// Pós-Vendas (Fase 2) — esteira automática de relacionamento.
// Um item de menu, 4 abas: Pipeline · Lista · Fluxos · Mensagens.
// =============================================================================

const ABAS = [
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'lista', label: 'Lista' },
  { key: 'fluxos', label: 'Fluxos' },
  { key: 'mensagens', label: 'Mensagens' },
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

function healthCls(v) {
  if (v == null) return 'text-gray-400';
  if (v >= 70) return 'text-green-600';
  if (v >= 40) return 'text-brand-amber';
  return 'text-red-600';
}

function npsBadge(nps) {
  if (nps == null) return null;
  const cls = nps >= 9 ? 'bg-green-100 text-green-700' : nps <= 6 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700';
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>NPS {nps}</span>;
}

const card = 'rounded-xl bg-white p-4 shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10';

export default function PosVendasPage() {
  const [aba, setAba] = useState('pipeline');

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        A esteira move o cliente sozinho conforme o tempo passa. Configure os gatilhos e as mensagens por categoria.
      </p>

      <div className="flex gap-2 border-b border-gray-200 dark:border-white/10">
        {ABAS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setAba(a.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              aba === a.key
                ? 'border-brand-blue text-brand-blue'
                : 'border-transparent text-gray-500 hover:text-brand-navy dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {aba === 'pipeline' && <PipelineTab />}
      {aba === 'lista' && <ListaTab />}
      {aba === 'fluxos' && <FluxosTab />}
      {aba === 'mensagens' && <MensagensTab />}
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
  useEffect(() => { carregar(); }, []);

  async function marcarFeito(apoliceId) {
    try {
      await api.posvendasMarcarFeito(apoliceId);
      await carregar();
    } catch (err) { alert(err.message || 'Erro ao marcar como feito.'); }
  }

  if (loading) return <p className="py-12 text-center text-gray-500 dark:text-gray-400">Carregando...</p>;
  if (error) return <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;

  const { colunas, cards, contadores } = dados;
  const vazio = (contadores.total || 0) === 0;

  if (vazio) {
    return (
      <div className={`${card} text-center`}>
        <p className="text-gray-600 dark:text-gray-300">Nenhuma apólice na esteira ainda.</p>
        <p className="mt-1 text-sm text-gray-400">
          As apólices entram automaticamente conforme os gatilhos (a primeira etapa é no dia seguinte à venda).
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {colunas.map((col) => (
        <div key={col.chave} className="w-72 shrink-0">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-heading text-sm font-semibold text-brand-navy dark:text-white">{col.nome}</h3>
            <span className="text-xs text-gray-400">{contadores[col.chave] || 0}</span>
          </div>
          <div className="space-y-3">
            {(cards[col.chave] || []).map((c) => (
              <div key={c.id} className={card}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-brand-navy dark:text-white">{c.cliente_nome}</p>
                  {c.concluido && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">Feito</span>}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{c.produto_nome}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="text-gray-400">{c.dias_na_etapa != null ? `${c.dias_na_etapa}d na etapa` : ''}</span>
                  <span className={healthCls(c.health_score)}>Saúde {c.health_score == null ? '—' : c.health_score}</span>
                  {npsBadge(c.nps)}
                </div>
                <div className="mt-3 flex gap-3 text-xs font-medium">
                  <button type="button" onClick={() => abrirWhatsApp(c.id, c.etapa_chave)} className="text-brand-blue hover:text-brand-blue-dark">WhatsApp</button>
                  {!c.concluido && col.chave !== 'aguardando' && (
                    <button type="button" onClick={() => marcarFeito(c.id)} className="text-gray-500 hover:text-brand-navy dark:text-gray-400 dark:hover:text-white">Marcar feito</button>
                  )}
                </div>
              </div>
            ))}
            {(cards[col.chave] || []).length === 0 && (
              <p className="px-1 text-xs text-gray-300 dark:text-gray-600">—</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Aba Lista
// =============================================================================
function ListaTab() {
  const [linhas, setLinhas] = useState(null);
  const [error, setError] = useState('');
  const [cross, setCross] = useState(null); // { cliente, itens }

  useEffect(() => {
    api.posvendasLista().then(setLinhas).catch((e) => setError(e.message || 'Erro ao carregar.'));
  }, []);

  async function verCrossSell(linha) {
    try {
      const itens = await api.posvendasCrossSell(linha.id);
      setCross({ cliente: linha.cliente_nome, itens });
    } catch (err) { alert(err.message || 'Erro ao buscar cross-sell.'); }
  }

  if (error) return <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!linhas) return <p className="py-12 text-center text-gray-500 dark:text-gray-400">Carregando...</p>;
  if (linhas.length === 0) return <div className={`${card} text-center text-gray-500`}>Nenhuma apólice na esteira ainda.</div>;

  return (
    <>
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Saúde</th>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3">Etapa</th>
              <th className="px-4 py-3">Progresso</th>
              <th className="px-4 py-3">Dias</th>
              <th className="px-4 py-3">NPS</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm dark:divide-white/5">
            {linhas.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3 font-medium text-brand-navy dark:text-white">{l.cliente_nome}</td>
                <td className={`px-4 py-3 font-medium ${healthCls(l.health_score)}`}>{l.health_score == null ? '—' : l.health_score}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{l.produto_nome}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{l.etapa_nome}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{l.progresso}%</td>
                <td className="px-4 py-3 text-gray-400">{l.dias_na_etapa == null ? '—' : `${l.dias_na_etapa}d`}</td>
                <td className="px-4 py-3">{npsBadge(l.nps) || <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => verCrossSell(l)} className="text-sm font-medium text-brand-blue hover:text-brand-blue-dark">Cross-sell</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cross && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={() => setCross(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-brand-navy dark:ring-1 dark:ring-white/10" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="font-heading text-lg font-semibold text-brand-navy dark:text-white">Oportunidades para {cross.cliente}</h3>
            {cross.itens.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">O cliente já tem todos os produtos ativos da conta. 🎯</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {cross.itens.map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-white/5">
                    <span className="text-brand-navy dark:text-white">{p.nome}</span>
                    <span className="text-xs text-gray-400">comissão {p.percentual}%</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => setCross(null)} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-white/10 dark:text-white">Fechar</button>
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
  useEffect(() => { api.posvendasCategorias().then(setCats).catch(() => setCats([])); }, []);
  return cats;
}

function CategoriaSelect({ cats, valor, onChange }) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
    >
      {cats.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
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
    } catch (err) { setError(err.message || 'Erro ao carregar o fluxo.'); }
  }
  useEffect(() => { carregar(categoria); }, [categoria]);

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
    } catch (err) { alert(err.message || 'Erro ao salvar a etapa.'); }
  }

  async function restaurar() {
    if (!window.confirm('Restaurar o fluxo de fábrica desta categoria? Isso descarta as personalizações das etapas e mensagens.')) return;
    try {
      const r = await api.posvendasRestaurarFluxo(categoria);
      setEtapas(r.etapas);
    } catch (err) { alert(err.message || 'Erro ao restaurar.'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CategoriaSelect cats={cats} valor={categoria} onChange={setCategoria} />
        <button type="button" onClick={restaurar} className="text-sm font-medium text-gray-500 hover:text-brand-navy dark:text-gray-400 dark:hover:text-white">
          Restaurar padrão da categoria
        </button>
      </div>

      {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!etapas ? (
        <p className="py-8 text-center text-gray-500 dark:text-gray-400">Carregando...</p>
      ) : (
        <div className="space-y-3">
          {etapas.map((e) => (
            <div key={e.id} className={`${card} grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end`}>
              <div className="sm:col-span-3">
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Etapa</label>
                <input value={e.nome} onChange={(ev) => patchLocal(e.id, 'nome', ev.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue" />
              </div>
              <div className="sm:col-span-4">
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Gatilho</label>
                <select value={e.gatilho_tipo} onChange={(ev) => patchLocal(e.id, 'gatilho_tipo', ev.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue">
                  {GATILHOS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Dias</label>
                <input type="number" value={e.gatilho_dias} disabled={e.gatilho_tipo === 'aniversario'} onChange={(ev) => patchLocal(e.id, 'gatilho_dias', ev.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:bg-gray-100" />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <input id={`ativo-${e.id}`} type="checkbox" checked={e.ativo} onChange={(ev) => patchLocal(e.id, 'ativo', ev.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue" />
                <label htmlFor={`ativo-${e.id}`} className="text-sm text-gray-600 dark:text-gray-300">Ativa</label>
              </div>
              <div className="sm:col-span-1">
                <button type="button" onClick={() => salvarEtapa(e)} className="w-full rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold text-white hover:bg-brand-blue-dark">Salvar</button>
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
    } catch (err) { setError(err.message || 'Erro ao carregar as mensagens.'); }
  }
  useEffect(() => { carregar(categoria); }, [categoria]);

  function patchLocal(chave, texto) {
    setMsgs((ms) => ms.map((m) => (m.etapa_chave === chave ? { ...m, texto } : m)));
  }

  async function salvar(m) {
    try {
      const salva = await api.posvendasSalvarMensagem(categoria, m.etapa_chave, m.texto);
      patchLocal(m.etapa_chave, salva.texto);
    } catch (err) { alert(err.message || 'Erro ao salvar a mensagem.'); }
  }

  async function redefinir(m) {
    try {
      const nova = await api.posvendasRedefinirMensagem(categoria, m.etapa_chave);
      patchLocal(m.etapa_chave, nova.texto);
    } catch (err) { alert(err.message || 'Erro ao redefinir.'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CategoriaSelect cats={cats} valor={categoria} onChange={setCategoria} />
        <p className="text-xs text-gray-400">
          Variáveis: {VARIAVEIS.map((v) => <code key={v} className="mx-0.5 rounded bg-gray-100 px-1 dark:bg-white/10">{v}</code>)}
        </p>
      </div>

      {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!msgs ? (
        <p className="py-8 text-center text-gray-500 dark:text-gray-400">Carregando...</p>
      ) : (
        <div className="space-y-4">
          {msgs.map((m) => (
            <div key={m.etapa_chave} className={card}>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-heading text-sm font-semibold text-brand-navy dark:text-white capitalize">{m.etapa_chave.replace(/_/g, ' ')}</h4>
                {m.is_padrao && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500 dark:bg-white/10">Padrão</span>}
              </div>
              <textarea
                value={m.texto}
                onChange={(e) => patchLocal(m.etapa_chave, e.target.value)}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
              />
              <div className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-300">
                <span className="font-medium text-gray-400">Prévia:</span> {renderExemplo(m.texto)}
              </div>
              <div className="mt-3 flex gap-3 text-sm font-medium">
                <button type="button" onClick={() => salvar(m)} className="rounded-lg bg-brand-blue px-3 py-1.5 text-white hover:bg-brand-blue-dark">Salvar</button>
                <button type="button" onClick={() => redefinir(m)} className="text-gray-500 hover:text-brand-navy dark:text-gray-400 dark:hover:text-white">Redefinir esta mensagem</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
