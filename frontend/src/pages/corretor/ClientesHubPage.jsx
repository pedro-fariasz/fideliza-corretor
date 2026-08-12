import { useState } from 'react';
import { NavLink, Outlet, useLocation, useMatch } from 'react-router-dom';
import { Briefcase, Users, Sparkles, MessageCircle, Plus } from 'lucide-react';
import CadastroClienteModal from '../../components/CadastroClienteModal';
import { useTabIndicator } from '../../hooks/useTabIndicator';

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
  const location = useLocation();
  const abaAtiva = ABAS.find((a) => location.pathname.startsWith(`/clientes/${a.to}`))?.to;
  const { containerRef, style: indicatorStyle } = useTabIndicator(abaAtiva);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          ref={containerRef}
          role="tablist"
          aria-label="Seções de clientes"
          className="relative inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-gray-50 p-1 dark:border-white/10 dark:bg-white/5"
        >
          <span
            className="tab-indicator bg-white shadow-sm dark:bg-white/10"
            style={indicatorStyle}
            aria-hidden="true"
          />
          {ABAS.map((a) => {
            const Icon = a.icon;
            return (
              <NavLink
                key={a.to}
                to={a.to}
                role="tab"
                data-tab-key={a.to}
                className={({ isActive }) =>
                  `press relative inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-200 ${
                    isActive
                      ? 'text-brand-blue dark:text-white'
                      : 'text-gray-500 hover:text-brand-navy dark:text-gray-400 dark:hover:text-white'
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
            className="press inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-blue-dark hover:shadow-md"
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
