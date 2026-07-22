// Avatar com iniciais — determinístico a partir do nome. Sem imagem/upload:
// gera as iniciais e uma cor estável da paleta da marca. Usado no header e nas
// listas de leads. Cores em tons suaves para não competir com o conteúdo.
const PALETTE = [
  'bg-brand-blue/10 text-brand-blue',
  'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  'bg-amber-50 text-brand-amber dark:bg-amber-500/15 dark:text-amber-300',
  'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
];

function iniciais(nome) {
  const partes = String(nome || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function corPara(nome) {
  const s = String(nome || '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

const SIZES = {
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-10 w-10 text-sm',
};

export default function Avatar({ nome, size = 'md', className = '' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-heading font-semibold ${
        SIZES[size] || SIZES.md
      } ${corPara(nome)} ${className}`}
      aria-hidden="true"
      title={nome || undefined}
    >
      {iniciais(nome)}
    </span>
  );
}
