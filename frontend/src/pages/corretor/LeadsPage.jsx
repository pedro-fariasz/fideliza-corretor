import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  LayoutGrid,
  List,
  Plus,
  Pencil,
  ChevronRight,
  MessageCircle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  UserPlus,
  Megaphone,
  Filter,
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import LeadFormModal from '../../components/LeadFormModal';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { ESTAGIO_LABEL, ESTAGIOS, INTERESSES } from '../../utils/crmConstants';
import { formatBRL, formatData } from '../../utils/format';

const INTERESSE_LABEL = INTERESSES.reduce((a, i) => ((a[i.value] = i.label), a), {});
const CARD = 'rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-white/5';
const ESTAGIO_ORDEM = ESTAGIOS.map((e) => e.value);

function proximoEstagio(estagio) {
  const i = ESTAGIO_ORDEM.indexOf(estagio);
  return i >= 0 && i < ESTAGIO_ORDEM.length - 1 ? ESTAGIO_ORDEM[i + 1] : null;
}

function abrirWhatsApp(telefone) {
  const num = (telefone || '').replace(/\D/g, '');
  window.open(num ? `https://wa.me/55${num}` : 'https://wa.me/', '_blank', 'noopener');
}

// Badge de estágio com tom por posição no funil (frio → quente).
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

export default function LeadsPage() {
  const { profile } = useAuth();
  const verValores = !profile || profile.pode_ver_valores !== false;

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [busca, setBusca] = useState('');
  const [estagio, setEstagio] = useState('');
  const [origem, setOrigem] = useState('');
  const [view, setView] = useState('tabela'); // 'tabela' | 'cards'
  const [sort, setSort] = useState({ key: 'criado_em', dir: 'desc' });

  const [aberto, setAberto] = useState(false);
  const [editLead, setEditLead] = useState(null);

  async function carregar() {
    setLoading(true);
    setError('');
    try {
      const data = await api.listarLeads({ status: 'ativo' });
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Erro ao carregar leads.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    carregar();
  }, []);

  // Contagem por estágio (sobre todos os leads ativos, independente do filtro).
  const contagem = useMemo(() => {
    const c = {};
    for (const l of leads) c[l.estagio] = (c[l.estagio] || 0) + 1;
    return c;
  }, [leads]);

  // Origens distintas presentes (para o filtro).
  const origens = useMemo(
    () => [...new Set(leads.map((l) => l.origem_especifica).filter(Boolean))].sort(),
    [leads]
  );

  // Filtro + ordenação (tudo client-side, busca instantânea).
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
      // criado_em
      return String(a.criado_em || '').localeCompare(String(b.criado_em || '')) * mult;
    });
    return arr;
  }, [leads, busca, estagio, origem, sort]);

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'nome' ? 'asc' : 'desc' }));
  }

  async function avancar(lead) {
    const prox = proximoEstagio(lead.estagio);
    if (!prox) return;
    try {
      await api.mudarEstagio(lead.id, prox);
      await carregar();
    } catch (err) {
      alert(err.message || 'Erro ao mover o lead.');
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

        {/* Toggle de visualização */}
        <div className="ml-auto inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-white/10">
          <button
            type="button"
            onClick={() => setView('tabela')}
            aria-label="Ver em tabela"
            aria-pressed={view === 'tabela'}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
              view === 'tabela' ? 'bg-brand-blue/10 text-brand-blue' : 'text-gray-400 hover:text-brand-navy dark:hover:text-white'
            }`}
          >
            <List size={17} />
          </button>
          <button
            type="button"
            onClick={() => setView('cards')}
            aria-label="Ver em cards"
            aria-pressed={view === 'cards'}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
              view === 'cards' ? 'bg-brand-blue/10 text-brand-blue' : 'text-gray-400 hover:text-brand-navy dark:hover:text-white'
            }`}
          >
            <LayoutGrid size={16} />
          </button>
        </div>

        <button
          type="button"
          onClick={novo}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-blue-dark hover:shadow-md"
        >
          <Plus size={16} /> Novo lead
        </button>
      </div>

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
        <LeadsSkeleton />
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      ) : semNenhum ? (
        <VazioLeads onNovo={novo} />
      ) : filtrados.length === 0 ? (
        <div className={`${CARD} p-8`}>
          <EmptyState
            icon={Search}
            title="Nenhum lead com esses filtros"
            description="Ajuste a busca, o estágio ou a origem para ver mais resultados."
          />
        </div>
      ) : view === 'tabela' ? (
        <>
          {/* Tabela no desktop; em telas estreitas cai para cards (mais legível). */}
          <div className="hidden md:block">
            <TabelaLeads
              leads={filtrados}
              verValores={verValores}
              sort={sort}
              onSort={toggleSort}
              onEditar={editar}
              onAvancar={avancar}
            />
          </div>
          <div className="md:hidden">
            <CardsLeads leads={filtrados} verValores={verValores} onEditar={editar} onAvancar={avancar} />
          </div>
        </>
      ) : (
        <CardsLeads leads={filtrados} verValores={verValores} onEditar={editar} onAvancar={avancar} />
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
      <span
        className={`rounded-full px-1.5 text-[11px] font-semibold ${
          active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

// --- Ações rápidas (compartilhadas por tabela e cards) ------------------------
function QuickActions({ lead, onEditar, onAvancar }) {
  const prox = proximoEstagio(lead.estagio);
  return (
    <div className="flex items-center gap-1">
      {lead.telefone && (
        <IconBtn label="WhatsApp" onClick={() => abrirWhatsApp(lead.telefone)} tone="emerald">
          <MessageCircle size={15} />
        </IconBtn>
      )}
      <IconBtn label="Editar" onClick={() => onEditar(lead)}>
        <Pencil size={15} />
      </IconBtn>
      {prox && (
        <IconBtn label={`Avançar para ${ESTAGIO_LABEL[prox]}`} onClick={() => onAvancar(lead)} tone="blue">
          <ChevronRight size={16} />
        </IconBtn>
      )}
    </div>
  );
}
function IconBtn({ children, label, onClick, tone = 'gray' }) {
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
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

// --- Tabela -------------------------------------------------------------------
function SortHead({ label, k, sort, onSort, className = '' }) {
  const active = sort.key === k;
  return (
    <th className={`px-4 py-3 ${className}`}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-brand-navy dark:hover:text-white ${active ? 'text-brand-navy dark:text-white' : ''}`}
      >
        {label}
        {active ? (
          sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        ) : (
          <ArrowUpDown size={12} className="opacity-40" />
        )}
      </button>
    </th>
  );
}

function TabelaLeads({ leads, verValores, sort, onSort, onEditar, onAvancar }) {
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
              <th className="hidden px-4 py-3 2xl:table-cell">Origem</th>
              <SortHead label="Cadastro" k="criado_em" sort={sort} onSort={onSort} className="hidden xl:table-cell" />
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
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-gray-600 dark:text-gray-300">
                    {l.valor_estimado ? formatBRL(l.valor_estimado) : '—'}
                  </td>
                )}
                <td className="hidden whitespace-nowrap px-4 py-3 text-gray-400 2xl:table-cell">{l.origem_especifica || '—'}</td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-gray-400 xl:table-cell">{formatData(l.criado_em)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <QuickActions lead={l} onEditar={onEditar} onAvancar={onAvancar} />
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

// --- Cards --------------------------------------------------------------------
function CardsLeads({ leads, verValores, onEditar, onAvancar }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {leads.map((l) => (
        <div key={l.id} className={`${CARD} p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}>
          <div className="flex items-start gap-3">
            <Avatar nome={l.nome} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-brand-navy dark:text-white">{l.nome}</p>
              <p className="truncate text-xs text-gray-400">
                {INTERESSE_LABEL[l.interesse] || l.origem_especifica || 'Lead'}
              </p>
            </div>
            <EstagioBadge estagio={l.estagio} />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <div>
              <dt className="text-gray-400">Contato</dt>
              <dd className="truncate text-gray-600 dark:text-gray-300">{l.telefone || l.email || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-400">Origem</dt>
              <dd className="truncate text-gray-600 dark:text-gray-300">{l.origem_especifica || '—'}</dd>
            </div>
            {verValores && (
              <div>
                <dt className="text-gray-400">Valor est.</dt>
                <dd className="font-medium text-gray-700 dark:text-gray-200">
                  {l.valor_estimado ? formatBRL(l.valor_estimado) : '—'}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-gray-400">Cadastro</dt>
              <dd className="text-gray-600 dark:text-gray-300">{formatData(l.criado_em)}</dd>
            </div>
          </dl>

          <div className="mt-3 flex items-center justify-end border-t border-gray-100 pt-3 dark:border-white/5">
            <QuickActions lead={l} onEditar={onEditar} onAvancar={onAvancar} />
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Estado vazio -------------------------------------------------------------
function VazioLeads({ onNovo }) {
  const dicas = [
    'Cadastre pelo botão "Novo lead" ou importe a proposta em PDF na Carteira.',
    'Organize por estágio e nunca perca o próximo passo de cada contato.',
    'Leads viram vendas no funil — e a comissão é calculada automaticamente.',
  ];
  return (
    <div className={`${CARD} p-8`}>
      <div className="flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue">
          <Megaphone size={26} />
        </span>
        <h3 className="mt-4 font-heading text-lg font-semibold text-brand-navy dark:text-white">
          Sua jornada de vendas começa aqui
        </h3>
        <p className="mt-1.5 max-w-md text-sm text-gray-500 dark:text-gray-400">
          Cadastre seu primeiro lead e veja seu funil crescer. Cada contato organizado é uma venda
          mais perto de acontecer.
        </p>
        <button
          type="button"
          onClick={onNovo}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-blue px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-blue/25 transition-all hover:bg-brand-blue-dark"
        >
          <UserPlus size={17} /> Cadastrar primeiro lead
        </button>
      </div>
      <ul className="mx-auto mt-8 grid max-w-2xl gap-2.5 sm:grid-cols-3">
        {dicas.map((d, i) => (
          <li
            key={i}
            className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 text-xs leading-relaxed text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400"
          >
            {d}
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- Skeleton -----------------------------------------------------------------
function LeadsSkeleton() {
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
