import simboloColorida from '../assets/logo/simbolo-colorida.svg';
import simboloMonoBranco from '../assets/logo/simbolo-mono-branco.svg';
import simboloMonoPreto from '../assets/logo/simbolo-mono-preto.svg';

// Wordmark composto em HTML (Poppins) ao lado do símbolo SVG, seguindo a prancha da marca.
const VARIANTS = {
  colorida: {
    symbol: simboloColorida,
    wordmark: 'text-brand-navy',
    tagline: 'text-brand-blue',
  },
  'mono-branco': {
    symbol: simboloMonoBranco,
    wordmark: 'text-white',
    tagline: 'text-white/70',
  },
  'mono-preto': {
    symbol: simboloMonoPreto,
    wordmark: 'text-brand-navy',
    tagline: 'text-brand-navy/70',
  },
  simbolo: {
    symbol: simboloColorida,
  },
};

export default function Logo({ variant = 'colorida', size = 32, className = '' }) {
  const config = VARIANTS[variant] || VARIANTS.colorida;

  const symbol = (
    <img
      src={config.symbol}
      alt="Fideliza Corretor"
      width={size}
      height={size}
      className="shrink-0"
    />
  );

  if (variant === 'simbolo') {
    return <span className={`inline-flex ${className}`}>{symbol}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {symbol}
      <span className="flex flex-col justify-center leading-none">
        <span
          className={`font-heading font-semibold ${config.wordmark}`}
          style={{ fontSize: `${size * 0.58}px` }}
        >
          Fideliza
        </span>
        <span
          className={`font-heading font-medium uppercase tracking-[0.32em] ${config.tagline}`}
          style={{ fontSize: `${size * 0.22}px`, marginTop: `${size * 0.08}px` }}
        >
          Corretor
        </span>
      </span>
    </span>
  );
}
