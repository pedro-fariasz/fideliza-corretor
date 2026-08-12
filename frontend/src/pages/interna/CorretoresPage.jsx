import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { api } from '../../services/api';
import { diasDesde } from '../../utils/clientesMetrics';
import KanbanBoard from '../../components/KanbanBoard';
import EmptyState from '../../components/EmptyState';
import { useTabIndicator } from '../../hooks/useTabIndicator';

const CARD = 'rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-white/5';

const VIEW_KEY = 'fideliza:corretores-view';

// Colunas do kanban de CORRETORES (ordem = prioridade de encaixe).
// "Inativos" = última atividade > 60 dias (contato mais recente com cliente —
// não há login rastreado). Corretor sem atividade registrada NÃO é marcado
// inativo, para não acusar corretor recém-cadastrado por engano.
const COLUNAS_CORRETORES = [
  { id: 'sem', titulo: 'Sem clientes', match: (c) => c.total_clientes === 0 },
  {
    id: 'inad',
    titulo: 'Inadimplência alta',
    match: (c) => c.total_clientes > 0 && c.inadimplentes / c.total_clientes > 0.2,
  },
  {
    id: 'inativo',
    titulo: 'Inativos',
    match: (c) => {
      const d = diasDesde(c.ultima_atividade);
      return c.total_clientes > 0 && d !== null && d > 60;
    },
  },
  { id: 'ativo', titulo: 'Ativos', match: (c) => c.total_clientes > 0 },
];

function formatData(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

// Painel interno — corretores em Lista ou Kanban (preferência em localStorage).
export default function CorretoresPage() {
  const [resumo, setResumo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'kanban' ? 'kanban' : 'lista';
    } catch {
      return 'lista';
    }
  });

  const carregar = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.internoResumo();
      setResumo(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Erro ao carregar os corretores.');
      setResumo([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  function trocarView(v) {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignora storage indisponível */
    }
  }

  const { containerRef: viewRef, style: viewIndicatorStyle } = useTabIndicator(view);

  return (
    <div>
      <div
        ref={viewRef}
        role="tablist"
        aria-label="Modo de visualização"
        className="relative mb-4 inline-flex gap-1 rounded-xl border border-gray-100 bg-gray-50 p-1 dark:border-white/10 dark:bg-white/5"
      >
        <span className="tab-indicator bg-white shadow-sm dark:bg-white/10" style={viewIndicatorStyle} aria-hidden="true" />
        <button
          type="button"
          role="tab"
          data-tab-key="lista"
          aria-selected={view === 'lista'}
          onClick={() => trocarView('lista')}
          className={`press relative rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ${
            view === 'lista' ? 'text-brand-blue dark:text-white' : 'text-gray-500 hover:text-brand-navy dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          Lista
        </button>
        <button
          type="button"
          role="tab"
          data-tab-key="kanban"
          aria-selected={view === 'kanban'}
          onClick={() => trocarView('kanban')}
          className={`press relative rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ${
            view === 'kanban' ? 'text-brand-blue dark:text-white' : 'text-gray-500 hover:text-brand-navy dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          Kanban
        </button>
      </div>

      {loading ? (
        <p className="py-12 text-center text-gray-500 dark:text-gray-400">Carregando...</p>
      ) : error ? (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <span>{error}</span>
          <button type="button" onClick={carregar} className="press font-semibold underline">
            Tentar de novo
          </button>
        </div>
      ) : resumo.length === 0 ? (
        <div className={`${CARD} p-8`}>
          <EmptyState icon={Building2} title="Nenhum corretor cadastrado ainda" />
        </div>
      ) : view === 'kanban' ? (
        <KanbanBoard
          columns={COLUNAS_CORRETORES}
          items={resumo}
          getKey={(c) => c.tenant_id}
          renderCard={(c) => <CorretorCard c={c} />}
        />
      ) : (
        <ListaCorretores resumo={resumo} />
      )}
    </div>
  );
}

// --- Visão em lista (grid de cards) -----------------------------------------
function ListaCorretores({ resumo }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {resumo.map((t, i) => (
        <Link
          key={t.tenant_id}
          to={`/equipe/painel/kanban/${t.tenant_id}`}
          style={{ '--rise-delay': `${Math.min(i, 10) * 40}ms` }}
          className="press animate-rise rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-brand-blue hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-brand-blue"
        >
          <p className="truncate font-medium text-brand-navy dark:text-white">{t.corretor}</p>
          <div className="mt-2 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>{t.total_clientes} clientes</span>
            <span>{t.incompletos} incompletos</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-white/10">
              <div className="h-1.5 rounded-full bg-brand-blue" style={{ width: `${t.score_medio}%` }} />
            </div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t.score_medio}%
            </span>
          </div>
          <span className="mt-3 inline-block text-sm font-semibold text-brand-blue">
            Ver Kanban →
          </span>
        </Link>
      ))}
    </div>
  );
}

// --- Card do corretor no kanban ---------------------------------------------
function CorretorCard({ c }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/5">
      <Link
        to={`/equipe/painel/kanban/${c.tenant_id}`}
        className="press font-medium text-brand-navy transition-colors hover:text-brand-blue dark:text-white dark:hover:text-brand-blue"
      >
        {c.corretor}
      </Link>
      <dl className="mt-2 space-y-0.5 text-xs">
        <Linha rotulo="Clientes" valor={c.total_clientes} />
        <Linha rotulo="Inadimplentes" valor={c.inadimplentes} />
        <Linha rotulo="Última atividade" valor={formatData(c.ultima_atividade)} />
      </dl>
    </div>
  );
}

function Linha({ rotulo, valor }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-gray-400">{rotulo}</dt>
      <dd className="text-gray-600 dark:text-gray-300">{valor}</dd>
    </div>
  );
}
