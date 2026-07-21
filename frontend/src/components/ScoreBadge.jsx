// Selo do score de completude. O score vem SEMPRE calculado pela API
// (score_completude) — o frontend só exibe. Apenas texto: a porcentagem, com a
// cor aplicada no próprio número (sem bolinha, sem fundo).
export default function ScoreBadge({ score }) {
  const value = typeof score === 'number' ? score : 0;

  let color = 'text-red-600';
  if (value >= 80) color = 'text-green-600';
  else if (value >= 60) color = 'text-yellow-600';

  return (
    <span
      className={`text-sm font-semibold ${color}`}
      title={`Score de completude: ${value}%`}
    >
      {value}%
    </span>
  );
}
