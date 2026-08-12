import { useEffect, useState } from 'react';

const CLOSE_ANIMATION_MS = 180;

// Modal simples e acessível. Fundo claro sempre (regra de identidade);
// no dark mode o painel usa a superfície escura padrão do app.
// Materializa ao abrir (blur + scale) e sai pelo mesmo caminho ao fechar —
// fica montado durante a saída para a animação terminar antes de sumir.
export default function Modal({ open, onClose, title, children, footer }) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const timer = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, CLOSE_ANIMATION_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!mounted) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mounted, onClose]);

  if (!mounted) return null;

  return (
    <div
      className={`modal-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center ${closing ? 'is-closing' : ''}`}
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal-panel w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-brand-navy dark:ring-1 dark:ring-white/10 ${closing ? 'is-closing' : ''}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-brand-navy dark:text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="press rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}
