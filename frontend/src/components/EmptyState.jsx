import { Link } from 'react-router-dom';

// Estado vazio amigável e que incentiva a ação: ícone em círculo, mensagem e um
// CTA opcional. Substitui os "Nenhum X ainda." secos.
export default function EmptyState({ icon: Icon, title, description, cta }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
      {Icon && (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/10 dark:text-gray-300">
          <Icon size={20} aria-hidden="true" />
        </span>
      )}
      <p className="mt-3 text-sm font-medium text-brand-navy dark:text-white">{title}</p>
      {description && (
        <p className="mt-1 max-w-[15rem] text-xs text-gray-500 dark:text-gray-400">{description}</p>
      )}
      {cta && (
        <Link
          to={cta.to}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-blue-dark"
        >
          {cta.label}
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}
