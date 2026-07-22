import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';
import Logo from '../Logo';

const NAV_LINKS = [
  { label: 'Funcionalidades', href: '#funcionalidades' },
  { label: 'Como Funciona', href: '#como-funciona' },
  { label: 'Preços', href: '#precos' },
  { label: 'Suporte', href: '#suporte' },
];

// Navbar fixa: transparente no topo, ganha fundo branco + sombra ao rolar.
export default function LandingNavbar({ onEntrar }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled || menuOpen
          ? 'border-b border-gray-100 bg-white/90 shadow-sm backdrop-blur'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-6">
        <a href="#topo" className="flex items-center" aria-label="Fideliza Corretor — início">
          <Logo variant="colorida" size={38} />
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-brand-blue"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <button
            type="button"
            onClick={onEntrar}
            className="text-sm font-semibold text-brand-navy transition-colors hover:text-brand-blue"
          >
            Entrar
          </button>
          <Link
            to="/cadastro"
            className="cta-shine inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-blue-dark hover:shadow-md"
          >
            Começar agora
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-brand-navy md:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Menu mobile */}
      {menuOpen && (
        <div className="border-t border-gray-100 bg-white px-6 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-2 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onEntrar();
              }}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-brand-navy hover:bg-gray-50"
            >
              Entrar
            </button>
            <Link
              to="/cadastro"
              onClick={() => setMenuOpen(false)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-dark"
            >
              Começar agora
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
