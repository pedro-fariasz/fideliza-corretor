import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Columns3,
  List,
  Plus,
  Pencil,
  ChevronRight,
  MessageCircle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  UserPlus,
  Filter,
  Smartphone,
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import LeadFormModal from '../../components/LeadFormModal';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { ESTAGIO_LABEL, ESTAGIOS, INTERESSES } from '../../utils/crmConstants';
import { formatBRL, formatData } from '../../utils/format';

const INTERESSE_LABEL = INTERESSES.reduce((a, i) => ((a[i.value] = i.label), a), {});
const CARD = 'rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-white/5';
const ESTAGIO_ORDEM = ESTAGIOS.map((e) => e.value);
const VIEW_KEY = 'leads_view_mode';

function proximoEstagio(estagio) {
  const i = ESTAGIO_ORDEM.indexOf(estagio);
  return i >= 0 && i < ESTAGIO_ORDEM.length - 1 ? ESTAGIO_ORDEM[i + 1] : null;
}
function abrirWhatsApp(telefone) {
  const num = (telefone || '').replace(/\D/g, '');
  window.open(num ? `https://wa.me/55${num}` : 'https://wa.me/', '_blank', 'noopener');
}

// Badge de estágio, tom por posição no funil (frio → quente).
const ESTAGIO_TONE = {
  prospectos: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
  qualificados: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  proposta_enviada: 'bg-brand-blue/10 text-brand-blue',
  negociacao: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  finalizacao: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  venda_concluida: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
};
function EstagioBadge({ estagio }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTAGIO_TONE[estagio] || ESTAGIO_TONE.prospectos}`}>
      {ESTAGIO_LABEL[estagio] || estagio}
    </span>
  );
}

// Badge discreto de origem — cor tonal determinística a partir do texto.
const ORIGEM_TONES = [
  'bg-brand-blue/10 text-brand-blue',
  'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-gray-300',
];
function OrigemBadge({ origem }) {
  if (!origem) return <span className="text-xs text-gray-400">—</span>;
  let h = 0;
  for (let i = 0; i < origem.length; i += 1) h = (h * 31 + origem.charCodeAt(i)) >>> 0;
  const tone = ORIGEM_TONES[h % ORIGEM_TONES.length];
  return (
    <span className={`inline-block max-w-[10rem] truncate rounded-md px-2 py-0.5 text-[11px] font-medium ${tone}`} title={origem}>
      {origem}
    </span>
  );
}

export default function LeadsPage() {
  const { profile, tenant } = useAuth();
  const { push } = useToast();
  const verValores = !profile || profile.pode_ver_valores !== false;

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [busca, setBusca] = useState('');
  const [estagio, setEstagio] = useState('');
  const [origem, setOrigem] = useState('');
  const [view, setView] = useState(() => localStorage.getItem(VIEW_KEY) || 'lista');
  const [sort, setSort] = useState({ key: 'criado_em', dir: 'desc' });

  const [aberto, setAberto] = useState(false);
  const [editLead, setEditLead] = useState(null);

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  async function carregar() {
    setLoading(true);
    setError('');
    try {
      const data = await api.listarLeads({ status: 'ativo' });
      const arr = Array.isArray(data) ? data : [];
      // Lead com venda concluída já virou cliente na Carteira — some do funil
      // pra não duplicar as listas (ver ClientesHubPage).
      setLeads(arr.filter((l) => l.estagio !== 'venda_concluida'));
    } catch (err) {
      setError(err.message || 'Erro ao carregar leads.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    carregar();
  }, []);

  const contagem = useMemo(() => {
    const c = {};
    for (const l of leads) c[l.estagio] = (c[l.estagio] || 0) + 1;
    return c;
  }, [leads]);

  const origens = useMemo(
    () => [...new Set(leads.map((l) => l.origem_especifica).filter(Boolean))].sort(),
    [leads]
  );

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let arr = leads.filter((l) => {
      if (estagio && l.estagio !== estagio) return false;
      if (origem && l.origem_especifica !== origem) return false;
      if (q) {
        const alvo = `${l.nome || ''} ${l.telefone || ''} ${l.email || ''} ${l.empresa || ''}`.toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      return true;
    });
    const { key, dir } = sort;
    const mult = dir === 'asc' ? 1 : -1;
    arr = [...arr].sort((a, b) => {
      if (key === 'valor_estimado') return (Number(a.valor_estimado || 0) - Number(b.valor_estimado || 0)) * mult;
      if (key === 'nome') return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR') * mult;
      return String(a.criado_em || '').localeCompare(String(b.criado_em || '')) * mult;
    });
    return arr;
  }, [leads, busca, estagio, origem, sort]);

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'nome' ? 'asc' : 'desc' }));
  }

  async function moverEstagio(lead, novoEstagio) {
    if (!novoEstagio || lead.estagio === novoEstagio) return;
    const anterior = lead.estagio;
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, estagio: novoEstagio } : l))); // otimista
    try {
      await api.mudarEstagio(lead.id, novoEstagio);
      push({ tipo: 'sucesso', texto: `${lead.nome} → ${ESTAGIO_LABEL[novoEstagio]}` });
    } catch (err) {
      setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, estagio: anterior } : l))); // rollback
      push({ tipo: 'erro', texto: err.message || 'Não foi possível mover o lead.' });
    }
  }

  function editar(lead) {
    setEditLead(lead);
    setAberto(true);
  }
  function novo() {
    setEditLead(null);
    setAberto(true);
  }

  const semNenhum = !loading && !error && leads.length === 0;
  // Sem WhatsApp conectado o corretor ainda trabalha o funil normalmente —
  // só o botão de disparo de mensagem fica desabilitado (ver QuickActions).
  const whatsappConectado = Boolean(tenant && tenant.whatsapp_conectado);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, telefone, e-mail..."
            aria-label="Buscar leads"
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/40 dark:border-white/15 dark:bg-white/5 dark:text-white"
          />
        </div>

        {origens.length > 0 && (
          <div className="relative">
            <Filter size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={origem}
              onChange={(e) => setOrigem(e.target.value)}
              aria-label="Filtrar por origem"
              className="rounded-lg border border-gray-300 bg-white py-2 pl-8 pr-3 text-sm text-gray-900 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/40 dark:border-white/15 dark:bg-white/5 dark:text-white"
            >
              <option value="">Todas as origens</option>
              {origens.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Toggle Kanban / Lista (persistido em localStorage) */}
        <div className="ml-auto inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-white/10" role="tablist" aria-label="Visualização">
          <ViewBtn active={view === 'kanban'} onClick={() => setView('kanban')} label="Kanban" icon={Columns3} />
          <ViewBtn active={view === 'lista'} onClick={() => setView('lista')} label="Lista" icon={List} />
        </div>

        <button
          type="button"
          onClick={novo}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-blue-dark hover:shadow-md"
        >
          <Plus size={16} /> Novo lead
        </button>
      </div>

      {!whatsappConectado && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <span className="flex items-center gap-2">
            <Smartphone size={15} /> WhatsApp não conectado — os botões de mensagem ficam desabilitados.
          </span>
          <Link to="/configuracoes" className="whitespace-nowrap font-semibold underline hover:no-underline">
            Conectar agora
          </Link>
        </div>
      )}

      {/* Pills de estágio com contagem */}
      {!semNenhum && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <StagePill label="Todos" count={leads.length} active={estagio === ''} onClick={() => setEstagio('')} />
          {ESTAGIOS.map((e) => (
            <StagePill
              key={e.value}
              label={e.label}
              count={contagem[e.value] || 0}
              active={estagio === e.value}
              onClick={() => setEstagio(e.value)}
            />
          ))}
        </div>
      )}

      {/* Conteúdo */}
      {loading ? (
        <LeadsSkeleton view={view} />
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      ) : semNenhum ? (
        <div className={`${CARD} p-8`}>
          <EmptyState
            icon={UserPlus}
            title="Sua jornada de vendas começa aqui"
            description="Cadastre seu primeiro lead para movimentar o funil."
          />
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={novo}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-blue/25 transition-all hover:bg-brand-blue-dark"
            >
              <Plus size={17} /> Novo lead
            </button>
          </div>
        </div>
      ) : filtrados.length === 0 ? (
        <div className={`${CARD} p-8`}>
          <EmptyState icon={Search} title="Nenhum lead com esses filtros" description="Ajuste a busca, o estágio ou a origem." />
        </div>
      ) : view === 'kanban' ? (
        <KanbanLeads
          leads={filtrados}
          verValores={verValores}
          onEditar={editar}
          onMover={moverEstagio}
          whatsappConectado={whatsappConectado}
        />
      ) : (
        <>
          <div className="hidden md:block">
            <TabelaLeads leads={filtrados} verValores={verValores} sort={sort} onSort={toggleSort} onEditar={editar} onMover={moverEstagio} whatsappConectado={whatsappConectado} />
          </div>
          <div className="md:hidden">
            <CardsLeads leads={filtrados} verValores={verValores} onEditar={editar} onMover={moverEstagio} whatsappConectado={whatsappConectado} />
          </div>
        </>
      )}

      <LeadFormModal
        open={aberto}
        lead={editLead}
        onClose={() => {
          setAberto(false);
          setEditLead(null);
        }}
        onSaved={() => carregar()}
      />
    </div>
  );
}

function ViewBtn({ active, onClick, label, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
        active ? 'bg-brand-blue/10 text-brand-blue' : 'text-gray-400 hover:text-brand-navy dark:hover:text-white'
      }`}
    >
      <Icon size={16} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function StagePill({ label, count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
        active
          ? 'border-brand-blue bg-brand-blue text-white shadow-sm shadow-brand-blue/30'
          : 'border-gray-200 bg-white text-gray-600 hover:border-brand-blue/40 hover:text-brand-navy dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:text-white'
      }`}
    >
      {label}
      <span className={`rounded-full px-1.5 text-[11px] font-semibold ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300'}`}>
        {count}
      </span>
    </button>
  );
}

function QuickActions({ lead, onEditar, onMover, whatsappConectado = true }) {
  const prox = proximoEstagio(lead.estagio);
  return (
    <div className="flex items-center gap-1">
      {lead.telefone && (
        <IconBtn
          label={whatsappConectado ? 'WhatsApp' : 'Conecte o WhatsApp em Configurações para enviar mensagens'}
          onClick={() => whatsappConectado && abrirWhatsApp(lead.telefone)}
          tone="emerald"
          disabled={!whatsappConectado}
        >
          <MessageCircle size={15} />
        </IconBtn>
      )}
      <IconBtn label="Editar" onClick={() => onEditar(lead)}>
        <Pencil size={15} />
      </IconBtn>
      {prox && (
        <IconBtn label={`Avançar para ${ESTAGIO_LABEL[prox]}`} onClick={() => onMover(lead, prox)} tone="blue">
          <ChevronRight size={16} />
        </IconBtn>
      )}
    </div>
  );
}
function IconBtn({ children, label, onClick, tone = 'gray', disabled = false }) {
  const tones = {
    gray: 'text-gray-400 hover:bg-gray-100 hover:text-brand-navy dark:hover:bg-white/10 dark:hover:text-white',
    blue: 'text-gray-400 hover:bg-brand-blue/10 hover:text-brand-blue',
    emerald: 'text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-300',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${tones[tone]} ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
    >
      {children}
    </button>
  );
}

// --- Kanban (colunas por estágio; arrastar para mover) ------------------------
function KanbanLeads({ leads, verValores, onEditar, onMover, whatsappConectado }) {
  const [arrastando, setArrastando] = useState(null);
  const [alvo, setAlvo] = useState(null);
  const porEstagio = (e) => leads.filter((l) => l.estagio === e);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {ESTAGIOS.map((col) => {
        const items = porEstagio(col.value);
        return (
          <div
            key={col.value}
            onDragOver={(e) => {
              e.preventDefault();
              if (alvo !== col.value) setAlvo(col.value);
            }}
            onDragLeave={() => setAlvo((a) => (a === col.value ? null : a))}
            onDrop={() => {
              if (arrastando) onMover(arrastando, col.value);
              setArrastando(null);
              setAlvo(null);
            }}
            className={`flex w-72 shrink-0 flex-col rounded-2xl border p-2 transition-colors ${
              alvo === col.value ? 'border-brand-blue/50 bg-brand-blue/5' : 'border-gray-100 bg-gray-50/70 dark:border-white/10 dark:bg-white/5'
            }`}
          >
            <div className="flex items-center justify-between px-2 py-2">
              <span className="text-sm font-semibold text-brand-navy dark:text-white">{col.label}</span>
              <span className="rounded-full bg-white px-2 text-xs font-medium text-gray-500 shadow-sm dark:bg-white/10 dark:text-gray-300">
                {items.length}
              </span>
            </div>
            <div className="flex min-h-[60px] flex-col gap-2">
              {items.map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={() => setArrastando(lead)}
                  onDragEnd={() => {
                    setArrastando(null);
                    setAlvo(null);
                  }}
                  className={`${CARD} cursor-grab p-3 active:cursor-grabbing ${arrastando?.id === lead.id ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start gap-2.5">
                    <Avatar nome={lead.nome} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-brand-navy dark:text-white">{lead.nome}</p>
                      <p className="truncate text-xs text-gray-400">{INTERESSE_LABEL[lead.interesse] || '—'}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <OrigemBadge origem={lead.origem_especifica} />
                    {verValores && lead.valor_estimado ? (
                      <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{formatBRL(lead.valor_estimado)}</span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex items-center justify-end border-t border-gray-100 pt-2 dark:border-white/5">
                    <QuickActions lead={lead} onEditar={onEditar} onMover={onMover} whatsappConectado={whatsappConectado} />
                  </div>
                </div>
              ))}
              {items.length === 0 && <p className="px-2 py-6 text-center text-xs text-gray-300 dark:text-gray-600">Vazio</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Lista (tabela; cai para cards no mobile) --------------------------------
function SortHead({ label, k, sort, onSort, className = '' }) {
  const active = sort.key === k;
  return (
    <th className={`px-4 py-3 ${className}`}>
      <button type="button" onClick={() => onSort(k)} className={`inline-flex items-center gap-1 transition-colors hover:text-brand-navy dark:hover:text-white ${active ? 'text-brand-navy dark:text-white' : ''}`}>
        {label}
        {active ? sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ArrowUpDown size={12} className="opacity-40" />}
      </button>
    </th>
  );
}

function TabelaLeads({ leads, verValores, sort, onSort, onEditar, onMover, whatsappConectado }) {
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400 dark:border-white/10">
              <SortHead label="Nome" k="nome" sort={sort} onSort={onSort} />
              <th className="px-4 py-3">Contato</th>
              <th className="hidden px-4 py-3 2xl:table-cell">Interesse</th>
              <th className="px-4 py-3">Estágio</th>
              {verValores && <SortHead label="Valor est." k="valor_estimado" sort={sort} onSort={onSort} />}
              <th className="px-4 py-3">Origem</th>
              <SortHead label="Cadastro" k="criado_em" sort={sort} onSort={onSort} className="hidden 2xl:table-cell" />
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {leads.map((l) => (
              <tr key={l.id} className="transition-colors hover:bg-gray-50/70 dark:hover:bg-white/5">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar nome={l.nome} size="sm" />
                    <div className="min-w-0">
                      <p className="font-medium text-brand-navy dark:text-white">{l.nome}</p>
                      {l.empresa && <p className="truncate text-xs text-gray-400">{l.empresa}</p>}
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400">{l.telefone || l.email || '—'}</td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-gray-500 2xl:table-cell dark:text-gray-400">{INTERESSE_LABEL[l.interesse] || '—'}</td>
                <td className="px-4 py-3">
                  <EstagioBadge estagio={l.estagio} />
                </td>
                {verValores && (
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-gray-600 dark:text-gray-300">{l.valor_estimado ? formatBRL(l.valor_estimado) : '—'}</td>
                )}
                <td className="px-4 py-3">
                  <OrigemBadge origem={l.origem_especifica} />
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-gray-400 2xl:table-cell">{formatData(l.criado_em)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <QuickActions lead={l} onEditar={onEditar} onMover={onMover} whatsappConectado={whatsappConectado} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CardsLeads({ leads, verValores, onEditar, onMover, whatsappConectado }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {leads.map((l) => (
        <div key={l.id} className={`${CARD} p-4`}>
          <div className="flex items-start gap-3">
            <Avatar nome={l.nome} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-brand-navy dark:text-white">{l.nome}</p>
              <p className="truncate text-xs text-gray-400">{INTERESSE_LABEL[l.interesse] || '—'}</p>
            </div>
            <EstagioBadge estagio={l.estagio} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <OrigemBadge origem={l.origem_especifica} />
            <span>{l.telefone || l.email || '—'}</span>
            {verValores && l.valor_estimado ? <span className="font-medium text-gray-700 dark:text-gray-200">{formatBRL(l.valor_estimado)}</span> : null}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-white/5">
            <span className="text-xs text-gray-400">{formatData(l.criado_em)}</span>
            <QuickActions lead={l} onEditar={onEditar} onMover={onMover} whatsappConectado={whatsappConectado} />
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Skeleton -----------------------------------------------------------------
function LeadsSkeleton({ view }) {
  if (view === 'kanban') {
    return (
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-72 shrink-0 rounded-2xl border border-gray-100 bg-gray-50/70 p-2 dark:border-white/10 dark:bg-white/5">
            <div className="shimmer m-2 h-4 w-24 rounded bg-gray-100 dark:bg-white/10" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="shimmer mb-2 h-20 rounded-xl bg-gray-100 dark:bg-white/10" />
            ))}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="space-y-3 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="shimmer h-9 w-9 shrink-0 rounded-full bg-gray-100 dark:bg-white/10" />
            <div className="flex-1">
              <div className="shimmer h-3.5 w-40 rounded bg-gray-100 dark:bg-white/10" />
              <div className="shimmer mt-2 h-3 w-24 rounded bg-gray-100 dark:bg-white/10" />
            </div>
            <div className="shimmer h-6 w-20 rounded-full bg-gray-100 dark:bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}
