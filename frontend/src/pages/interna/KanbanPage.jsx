import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MessageCircle, Mail } from 'lucide-react';
import { api } from '../../services/api';

// Colunas do Kanban. Ordem = prioridade de encaixe (cada card entra na PRIMEIRA
// coluna cujo `match` bate). Fácil de reconfigurar depois: é só editar esta lista.
const COLUNAS = [
  {
    id: 'incompleto',
    titulo: 'Cadastro incompleto',
    match: (c) => (c.score_completude ?? 0) < 60,
  },
  {
    id: 'atencao',
    titulo: 'Precisa de atenção',
    match: (c) => c.status === 'inadimplente' || c.status === 'cancelado',
  },
  {
    id: 'ativo',
    titulo: 'Ativo',
    match: (c) => c.status === 'ativo',
  },
];

function distribuir(clientes) {
  const baldes = Object.fromEntries(COLUNAS.map((col) => [col.id, []]));
  for (const c of clientes) {
    const col = COLUNAS.find((col) => col.match(c)) || COLUNAS[COLUNAS.length - 1];
    baldes[col.id].push(c);
  }
  return baldes;
}

function formatData(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

const TIPO_LABELS = { PF: 'PF', PME: 'PME', Adesao: 'Adesão', PJ: 'PJ' };

export default function KanbanPage() {
  const { tenantId } = useParams();

  // Sem corretor selecionado: mostra a lista para escolher.
  if (!tenantId) {
    return <SelecioneCorretor />;
  }
  return <KanbanDoCorretor tenantId={tenantId} />;
}

// --- Seleção de corretor (quando entra no Kanban sem tenantId) ---------------
function SelecioneCorretor() {
  const [resumo, setResumo] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    api
      .internoResumo()
      .then((d) => vivo && setResumo(Array.isArray(d) ? d : []))
      .catch(() => vivo && setResumo([]))
      .finally(() => vivo && setLoading(false));
    return () => {
      vivo = false;
    };
  }, []);

  if (loading) {
    return <p className="py-12 text-center text-gray-500 dark:text-gray-400">Carregando...</p>;
  }

  return (
    <div>
      <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
        Escolha um corretor para ver o Kanban de clientes.
      </p>
      <ul className="space-y-2">
        {resumo.map((t) => (
          <li key={t.tenant_id}>
            <Link
              to={`/equipe/painel/kanban/${t.tenant_id}`}
              className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm hover:ring-1 hover:ring-brand-blue dark:bg-white/5 dark:ring-1 dark:ring-white/10"
            >
              <span className="font-medium text-brand-navy dark:text-white">{t.corretor}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {t.total_clientes} clientes
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- Kanban de um corretor ---------------------------------------------------
function KanbanDoCorretor({ tenantId }) {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const carregar = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.internoClientes({ tenantId });
      setClientes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Erro ao carregar os clientes.');
      setClientes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const baldes = useMemo(() => distribuir(clientes), [clientes]);
  const corretor = clientes[0]?.tenant?.nome || 'Corretor';

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <Link to="/equipe/painel" className="text-sm text-brand-blue hover:text-brand-blue-dark">
            ← Corretores
          </Link>
          <h2 className="font-heading text-lg font-semibold text-brand-navy dark:text-white">
            {corretor}
          </h2>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={carregar} className="font-semibold underline">
            Tentar de novo
          </button>
        </div>
      )}

      {loading ? (
        <p className="py-12 text-center text-gray-500 dark:text-gray-400">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {COLUNAS.map((col) => (
            <div key={col.id} className="flex flex-col">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-heading text-sm font-semibold text-brand-navy dark:text-white">
                  {col.titulo}
                </h3>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-white/10 dark:text-gray-300">
                  {baldes[col.id].length}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 rounded-lg bg-gray-50 p-2 dark:bg-white/[0.03]">
                {baldes[col.id].length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-gray-400">Vazio</p>
                ) : (
                  baldes[col.id].map((c) => <Card key={c.id} cliente={c} />)
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Card do cliente. Leitura apenas (sem drag-and-drop, sem edição inline).
function Card({ cliente: c }) {
  const disparos = c.disparos || { whatsapp: 0, email: 0 };
  return (
    <div className="rounded-lg bg-white p-3 shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
      <p className="truncate font-medium text-brand-navy dark:text-white">{c.nome}</p>

      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <span>{TIPO_LABELS[c.tipo_plano] || c.tipo_plano || 'Tipo —'}</span>
        <span>{c.operadora || 'Operadora —'}</span>
        <span>
          {(c.qtd_dependentes ?? 0) + 1} vida{(c.qtd_dependentes ?? 0) + 1 > 1 ? 's' : ''}
        </span>
      </div>

      <dl className="mt-2 space-y-0.5 text-xs">
        <div className="flex justify-between">
          <dt className="text-gray-400">Corretor</dt>
          <dd className="truncate text-gray-600 dark:text-gray-300">{c.tenant?.nome || '—'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-400">Implantação</dt>
          <dd className="text-gray-600 dark:text-gray-300">{formatData(c.data_inicio_plano)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-400">Carência</dt>
          <dd className="text-gray-600 dark:text-gray-300">
            {c.carencia_meses != null ? `${c.carencia_meses} meses` : '—'}
          </dd>
        </div>
      </dl>

      <div className="mt-2 flex gap-3 border-t border-gray-100 pt-2 text-xs dark:border-white/10">
        <span
          className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400"
          title="Disparos por WhatsApp"
        >
          <MessageCircle size={13} aria-hidden="true" /> {disparos.whatsapp}
        </span>
        <span
          className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400"
          title="Disparos por e-mail"
        >
          <Mail size={13} aria-hidden="true" /> {disparos.email}
        </span>
      </div>
    </div>
  );
}
