import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';

// =============================================================================
// SidebarShell — casca de navegação com sidebar. Reutilizada pelos DOIS shells
// (corretor e equipe interna); o que muda é só a lista `items` e o `badge`,
// decididos pelo role de quem monta a tela (ver App.jsx).
//
// Identidade visual: fundo claro sempre; brand-blue no item ativo; brand-amber
// só no badge do painel interno. Sem card-dentro-de-card.
// =============================================================================
export default function SidebarShell({ items, badge = null, title, children }) {
  const { profile, signOut } = useAuth();
  const nome = profile ? profile.nome || profile.email : '';

  const linkBase =
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors';
  const linkActive = 'bg-brand-blue text-white';
  const linkIdle =
    'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10';

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-brand-navy">
      <div className="mx-auto flex max-w-6xl flex-col md:flex-row">
        {/* Sidebar (desktop) / topo (mobile) */}
        <aside className="md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-r md:border-gray-200 md:bg-white md:dark:border-white/10 md:dark:bg-white/5">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <Logo variant="colorida" size={32} className="dark:hidden" />
              <Logo variant="negativo" size={32} className="hidden dark:block" />
              {badge && (
                <span className="rounded-full bg-brand-amber/15 px-2 py-0.5 text-[11px] font-semibold text-brand-amber">
                  {badge}
                </span>
              )}
            </div>
            <div className="md:hidden">
              <ThemeToggle />
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:overflow-visible md:px-3">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? linkActive : linkIdle} whitespace-nowrap`
                }
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Coluna de conteúdo */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
            <h1 className="font-heading text-lg font-semibold text-brand-navy dark:text-white">
              {title}
            </h1>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-gray-500 dark:text-gray-300 sm:inline">
                {nome}
              </span>
              <div className="hidden md:block">
                <ThemeToggle />
              </div>
              <button
                type="button"
                onClick={signOut}
                className="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
              >
                Sair
              </button>
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
