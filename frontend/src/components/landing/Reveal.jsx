import { useInView } from '../../hooks/useScrollReveal';

// Envolve qualquer bloco com o efeito fade-in + slide-up ao entrar na viewport.
// `delay` cria o efeito escalonado (stagger) entre itens de uma mesma seção.
export default function Reveal({
  as: Tag = 'div',
  delay = 0,
  className = '',
  children,
  ...rest
}) {
  const [ref, inView] = useInView();

  return (
    <Tag
      ref={ref}
      className={`reveal ${inView ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
