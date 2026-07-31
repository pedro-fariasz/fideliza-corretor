import { useState } from 'react';
import { NavLink, Outlet, useMatch } from 'react-router-dom';
import { Briefcase, Users, Sparkles, MessageCircle, Plus } from 'lucide-react';
import CadastroClienteModal from '../../components/CadastroClienteModal';

// =============================================================================
// Hub de Clientes — /clientes. Layout com abas de navegação real (sub-rotas,
// não estado interno) para que back/forward do navegador e links diretos
// (ex.: /clientes/leads) funcionem sem cair em "rota não encontrada".
// As abas ficam registradas em App.jsx como rotas filhas com <Outlet />.
// =============================================================================

const ABAS = [
  { to: 'carteira', label: 'Carteira', icon: Briefcase },
  { to: 'indicacao', label: 'Indicação', icon: Sparkles },
  { to: 'leads', label: 'Leads', icon: Users },
  { to: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
];

export default function ClientesHubPage() {
  const naCarteira = useMatch('/clientes/carteira');
  const [modalAberto, setModalAberto] = useState(false);

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
            return (
              <NavLink
                key={a.to}
                to={a.to}
                role="tab"
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-white text-brand-blue shadow-sm dark:bg-white/10 dark:text-white'
                      : 'text-gray-500 hover:bg-white/60 hover:text-brand-navy dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={16} className={isActive ? '' : 'opacity-70'} />
                    {a.label}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        {naCarteira && (
          <button
            type="button"
            onClick={() => setModalAberto(true)}
            aria-label="Novo cliente"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-blue-dark hover:shadow-md"
          >
            <Plus size={16} /> Novo cliente
          </button>
        )}
      </div>

      <div className="animate-rise">
        <Outlet />
      </div>

      <CadastroClienteModal open={modalAberto} onClose={() => setModalAberto(false)} />
    </div>
  );
}
