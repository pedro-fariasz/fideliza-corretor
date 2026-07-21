import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';

// =============================================================================
// SidebarShell — casca de navegação responsiva. Reutilizada pelos DOIS shells
// (corretor e equipe interna); o que muda é só a lista `items` e o `badge`.
//
// Responsividade:
//   - >= md: sidebar fixa lateral, conteúdo ocupa o resto da viewport (fluido).
//   - <  md: sidebar vira drawer sobreposto, aberto por botão hambúrguer no header.
// Largura fluida (sem px fixo nos wrappers): a coluna de conteúdo usa flex-1.
// =============================================================================
export default function SidebarShell({ items, badge = null, title, children }) {
  const { profile, signOut } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const nome = profile ? profile.nome || profile.email : '';

  return (
    <div className="flex min-h-screen w-full bg-gray-100 dark:bg-brand-navy">
      {/* Sidebar fixa (desktop) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-gray-200 bg-white md:flex dark:border-white/10 dark:bg-white/5">
        <SidebarContent items={items} badge={badge} />
      </aside>

      {/* Drawer (mobile/tablet estreito) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 max-w-[80%] flex-col bg-white shadow-xl dark:bg-brand-navy">
            <SidebarContent
              items={items}
              badge={badge}
              onNavigate={() => setDrawerOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Coluna de conteúdo (fluida) */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 md:hidden dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/10"
            >
              <MenuIcon />
            </button>
            <h1 className="truncate font-heading text-lg font-semibold text-brand-navy dark:text-white">
              {title}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden max-w-[10rem] truncate text-sm text-gray-500 sm:inline dark:text-gray-300">
              {nome}
            </span>
            <ThemeToggle />
            <button
              type="button"
              onClick={signOut}
              className="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
            >
              Sair
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

// Conteúdo da sidebar (logo + navegação), compartilhado entre a fixa e o drawer.
function SidebarContent({ items, badge, onNavigate }) {
  const linkBase =
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors';
  const linkActive = 'bg-brand-blue text-white';
  const linkIdle = 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10';

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-4">
        <Logo variant="colorida" size={32} className="dark:hidden" />
        <Logo variant="negativo" size={32} className="hidden dark:block" />
        {badge && (
          <span className="rounded-full bg-brand-amber/15 px-2 py-0.5 text-[11px] font-semibold text-brand-amber">
            {badge}
          </span>
        )}
      </div>

      <nav className="flex flex-col gap-1 px-3 pb-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : linkIdle}`
              }
            >
              {Icon &&
                (typeof Icon === 'string' ? (
                  <span aria-hidden="true">{Icon}</span>
                ) : (
                  <Icon size={18} className="shrink-0" aria-hidden="true" />
                ))}
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}

// Ícone de menu (hambúrguer) inline — sem dependência, cor herdada do texto.
function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
