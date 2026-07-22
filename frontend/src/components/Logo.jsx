// Logos oficiais da marca (originais em assets/logo/, versões web otimizadas em assets/logo/web/).
// Marca vigente (lockup com o ícone novo do app + logotipo "Fideliza Corretor") —
// usada nas telas do produto (sidebar, login, landing). Ver `marca-*.png`.
import marcaHorizontal from '../assets/logo/web/marca-horizontal.png';
import marcaHorizontalNegativa from '../assets/logo/web/marca-horizontal-negativa.png';
import marcaSimbolo from '../assets/logo/web/marca-simbolo.png';
// Artes anteriores (logotipo de duas barras) — mantidas para as variantes restantes.
import horizontalMonoBranco from '../assets/logo/web/horizontal-mono-branco.png';
import horizontalMonoPreto from '../assets/logo/web/horizontal-mono-preto.png';
import horizontalSimplificada from '../assets/logo/web/horizontal-simplificada.png';
import simboloPreto from '../assets/logo/web/simbolo-preto.png';
import simboloBranco from '../assets/logo/web/simbolo-branco.png';
import verticalColorida from '../assets/logo/web/vertical-colorida.png';

const VARIANTS = {
  colorida: marcaHorizontal, // fundo claro — ícone novo + "Fideliza Corretor"
  'mono-branco': horizontalMonoBranco, // fundo escuro, monocromática
  'mono-preto': horizontalMonoPreto, // fundo claro, monocromática
  negativo: marcaHorizontalNegativa, // fundo escuro — ícone novo + texto branco
  simplificada: horizontalSimplificada, // redução 2: símbolo + "Fideliza"
  simbolo: marcaSimbolo, // ícone novo do app (F. no quadrado azul)
  'simbolo-preto': simboloPreto,
  'simbolo-branco': simboloBranco,
  vertical: verticalColorida,
};

export default function Logo({ variant = 'colorida', size = 32, className = '' }) {
  const src = VARIANTS[variant] || VARIANTS.colorida;

  return (
    <img
      src={src}
      alt="Fideliza Corretor"
      style={{ height: `${size}px`, width: 'auto' }}
      className={`shrink-0 ${className}`}
    />
  );
}
