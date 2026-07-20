import Logo from './Logo';

// Layout claro compartilhado pelas telas de login/cadastro.
// REGRA: essas telas são SEMPRE claras (sem dark mode). A área da equipe usa
// `band="equipe"` para exibir uma faixa âmbar de diferenciação — mesmo fundo
// claro, só um selo que deixa claro que é o acesso interno.
export default function AuthShell({ children, band = null }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Logo variant="colorida" size={44} />
      </header>

      {band === 'equipe' && (
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="flex items-center gap-2 rounded-lg border border-brand-amber/40 bg-brand-amber/10 px-4 py-2">
            <span className="h-2 w-2 rounded-full bg-brand-amber" aria-hidden="true" />
            <span className="text-sm font-medium text-brand-navy">
              Área da equipe · acesso interno Fideliza
            </span>
          </div>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-6 py-10">
        {children}
      </main>

      <footer className="py-6 text-center text-xs text-gray-400">
        © Fideliza Corretor. Todos os direitos reservados.
      </footer>
    </div>
  );
}

// Classe de input reutilizada nas telas de auth (fundo claro).
export const authInputClasses =
  'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 ' +
  'placeholder:text-gray-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/40';
