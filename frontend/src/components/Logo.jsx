// Logos oficiais da marca (originais em assets/logo/, versões web otimizadas em assets/logo/web/).
import horizontalColorida from '../assets/logo/web/horizontal-colorida.png';
import horizontalMonoBranco from '../assets/logo/web/horizontal-mono-branco.png';
import horizontalMonoPreto from '../assets/logo/web/horizontal-mono-preto.png';
import horizontalNegativo from '../assets/logo/web/horizontal-negativo.png';
import horizontalSimplificada from '../assets/logo/web/horizontal-simplificada.png';
import simboloColorida from '../assets/logo/web/simbolo-colorida.png';
import simboloPreto from '../assets/logo/web/simbolo-preto.png';
import simboloBranco from '../assets/logo/web/simbolo-branco.png';
import verticalColorida from '../assets/logo/web/vertical-colorida.png';

const VARIANTS = {
  colorida: horizontalColorida, // fundo claro
  'mono-branco': horizontalMonoBranco, // fundo escuro, monocromática
  'mono-preto': horizontalMonoPreto, // fundo claro, monocromática
  negativo: horizontalNegativo, // fundo escuro/colorido (versão oficial da prancha)
  simplificada: horizontalSimplificada, // redução 2: símbolo + "Fideliza"
  simbolo: simboloColorida, // redução 3: símbolo + ponto
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
