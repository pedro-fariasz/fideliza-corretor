import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

// Toast leve, sem dependência. Provider no topo da árvore (main.jsx);
// componentes disparam via useToast().push({ tipo, texto }).
const ToastContext = createContext(null);

const ICONS = {
  sucesso: CheckCircle2,
  erro: AlertTriangle,
  info: Info,
};
const TONES = {
  sucesso: 'text-emerald-600 dark:text-emerald-400',
  erro: 'text-red-600 dark:text-red-400',
  info: 'text-brand-blue',
};

let seq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    ({ tipo = 'info', texto, duracao = 4000 }) => {
      const id = ++seq;
      setToasts((t) => [...t, { id, tipo, texto }]);
      if (duracao) setTimeout(() => remove(id), duracao);
      return id;
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={{ push, remove }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => {
          const Icon = ICONS[t.tipo] || Info;
          return (
            <div
              key={t.id}
              role="status"
              className="reveal is-visible pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-lg dark:border-white/10 dark:bg-brand-navy"
            >
              <Icon size={18} className={`mt-0.5 shrink-0 ${TONES[t.tipo] || TONES.info}`} />
              <p className="flex-1 text-sm text-brand-navy dark:text-gray-100">{t.texto}</p>
              <button
                type="button"
                onClick={() => remove(t.id)}
                aria-label="Fechar"
                className="shrink-0 rounded-md p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

// Nunca quebra se usado fora do provider (retorna no-op) — telas de auth etc.
export function useToast() {
  const ctx = useContext(ToastContext);
  return ctx || { push: () => {}, remove: () => {} };
}
