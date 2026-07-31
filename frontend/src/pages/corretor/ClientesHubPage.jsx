import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Users, Sparkles, MessageCircle, Plus, ArrowRight, Smartphone } from 'lucide-react';
import { api } from '../../services/api';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { useAuth } from '../../hooks/useAuth';
import CarteiraPage from './CarteiraPage';
import LeadsPage from './LeadsPage';

// =============================================================================
// Hub de Clientes — /clientes. Reúne, em abas, tudo que gira em torno do
// cliente: carteira ativa, indicações, funil de leads e (futuro) WhatsApp.
// Reaproveita as páginas já existentes como conteúdo de aba — sem duplicar
// lógica de dados.
// =============================================================================

const ABAS = [
  { key: 'carteira', label: 'Carteira', icon: Briefcase },
  { key: 'indicacao', label: 'Indicação', icon: Sparkles },
  { key: 'leads', label: 'Leads', icon: Users },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
];

const CARD = 'rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-white/5';

export default function ClientesHubPage() {
  const [aba, setAba] = useState('carteira');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Seções de clientes"
          className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-gray-50 p-1 dark:border-white/10 dark:bg-white/5"
        >
          {ABAS.map((a) => {
            const Icon = a.icon;
            const active = aba === a.key;
            return (
              <button
                key={a.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setAba(a.key)}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-white text-brand-blue shadow-sm dark:bg-white/10 dark:text-white'
                    : 'text-gray-500 hover:bg-white/60 hover:text-brand-navy dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white'
                }`}
              >
                <Icon size={16} className={active ? '' : 'opacity-70'} />
                {a.label}
              </button>
            );
          })}
        </div>

        {aba === 'carteira' && (
          <Link
            to="/clientes/novo"
            aria-label="Novo cliente"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-blue-dark hover:shadow-md"
          >
            <Plus size={16} /> Novo cliente
          </Link>
        )}
      </div>

      <div className="animate-rise">
        {aba === 'carteira' && <CarteiraPage />}
        {aba === 'indicacao' && <IndicacaoTab />}
        {aba === 'leads' && <LeadsPage />}
        {aba === 'whatsapp' && <WhatsappTab />}
      </div>
    </div>
  );
}

// =============================================================================
// Aba Indicação — leads cuja origem específica é "Indicação".
// =============================================================================
function IndicacaoTab() {
  const { profile } = useAuth();
  const verValores = !profile || profile.pode_ver_valores !== false;
  const [leads, setLeads] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    api
      .listarLeads({ status: 'ativo' })
      .then((data) => vivo && setLeads(Array.isArray(data) ? data : []))
      .catch((err) => vivo && setError(err.message || 'Erro ao carregar indicações.'));
    return () => {
      vivo = false;
    };
  }, []);

  const indicados = useMemo(
    () => (leads || []).filter((l) => l.origem_especifica === 'Indicação'),
    [leads]
  );

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
        {error}
      </div>
    );
  }

  if (leads === null) {
    return <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</p>;
  }

  if (indicados.length === 0) {
    return (
      <div className={`${CARD} p-8`}>
        <EmptyState
          icon={Sparkles}
          title="Nenhuma indicação ainda"
          description="Leads cadastrados com origem 'Indicação' aparecem aqui."
        />
      </div>
    );
  }

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400 dark:border-white/10">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Contato</th>
              {verValores && <th className="px-4 py-3">Valor estimado</th>}
              <th className="px-4 py-3">Estágio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {indicados.map((l) => (
              <tr key={l.id} className="transition-colors hover:bg-gray-50/70 dark:hover:bg-white/5">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar nome={l.nome} size="sm" />
                    <span className="font-medium text-brand-navy dark:text-white">{l.nome}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{l.telefone || l.email || '—'}</td>
                {verValores && (
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {l.valor_estimado ? `R$ ${Number(l.valor_estimado).toLocaleString('pt-BR')}` : '—'}
                  </td>
                )}
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{l.estagio}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =============================================================================
// Aba WhatsApp — placeholder do painel de mensagens (evita link "morto" vindo
// de Leads/Inteligência enquanto a integração oficial não existe).
// =============================================================================
function WhatsappTab() {
  const { tenant } = useAuth();
  const conectado = Boolean(tenant && tenant.whatsapp_conectado);

  return (
    <div className={`${CARD} p-8 text-center`}>
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue">
        <Smartphone size={26} />
      </span>
      <h2 className="mt-4 font-heading text-lg font-semibold text-brand-navy dark:text-white">
        Painel de mensagens
      </h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-gray-500 dark:text-gray-400">
        {conectado
          ? 'WhatsApp conectado. O painel de conversas chega em uma próxima versão — por enquanto, use o botão de WhatsApp em cada lead.'
          : 'Conecte o WhatsApp da corretora em Configurações para começar a enviar mensagens direto do funil.'}
      </p>
      <Link
        to="/configuracoes"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-blue px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-blue/25 transition-all hover:bg-brand-blue-dark"
      >
        Ir para Configurações <ArrowRight size={16} />
      </Link>
    </div>
  );
}
