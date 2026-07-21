import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { diasDesde } from '../../utils/clientesMetrics';
import KanbanBoard from '../../components/KanbanBoard';

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

  const tabBase = 'rounded-md px-3 py-1.5 text-sm font-medium';
  const tabActive = 'bg-brand-blue text-white';
  const tabInactive =
    'bg-white text-gray-600 border border-gray-300 hover:bg-gray-100 ' +
    'dark:bg-white/5 dark:text-gray-300 dark:border-white/15 dark:hover:bg-white/10';

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2" role="tablist" aria-label="Modo de visualização">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'lista'}
          onClick={() => trocarView('lista')}
          className={`${tabBase} ${view === 'lista' ? tabActive : tabInactive}`}
        >
          Lista
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'kanban'}
          onClick={() => trocarView('kanban')}
          className={`${tabBase} ${view === 'kanban' ? tabActive : tabInactive}`}
        >
          Kanban
        </button>
      </div>

      {loading ? (
        <p className="py-12 text-center text-gray-500 dark:text-gray-400">Carregando...</p>
      ) : error ? (
        <div className="flex items-center justify-between rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={carregar} className="font-semibold underline">
            Tentar de novo
          </button>
        </div>
      ) : resumo.length === 0 ? (
        <div className="rounded-lg bg-white p-10 text-center text-gray-500 shadow-sm dark:bg-white/5 dark:text-gray-400 dark:ring-1 dark:ring-white/10">
          Nenhum corretor cadastrado ainda.
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
      {resumo.map((t) => (
        <Link
          key={t.tenant_id}
          to={`/equipe/painel/kanban/${t.tenant_id}`}
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-blue dark:border-white/10 dark:bg-white/5 dark:hover:border-brand-blue"
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
    <div className="rounded-lg bg-white p-3 shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
      <Link
        to={`/equipe/painel/kanban/${c.tenant_id}`}
        className="font-medium text-brand-navy hover:text-brand-blue dark:text-white dark:hover:text-brand-blue"
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
