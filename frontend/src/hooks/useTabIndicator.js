import { useLayoutEffect, useRef, useState } from 'react';

// Mede a posição da aba ativa (marcada com data-tab-key) dentro do container
// e devolve um estilo pronto para uma "pílula" deslizante atrás dela — em vez
// de cada aba ganhar seu próprio fundo, que troca sem transição de posição.
// Reaplica a medição no resize (tabs quebram linha em telas estreitas).
export function useTabIndicator(activeKey) {
  const containerRef = useRef(null);
  const [style, setStyle] = useState({ opacity: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    function measure() {
      const el = container.querySelector(`[data-tab-key="${CSS.escape(String(activeKey))}"]`);
      if (!el) {
        setStyle((s) => ({ ...s, opacity: 0 }));
        return;
      }
      const parentRect = container.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      setStyle({
        opacity: 1,
        transform: `translateX(${rect.left - parentRect.left}px)`,
        width: rect.width,
        height: rect.height,
      });
    }

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [activeKey]);

  return { containerRef, style };
}
