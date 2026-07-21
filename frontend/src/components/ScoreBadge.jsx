// Selo do score de completude. O score vem SEMPRE calculado pela API
// (score_completude) — o frontend só exibe. Sem emoji: a bolinha de status
// é um elemento CSS colorido (cor herdada da faixa do score).
export default function ScoreBadge({ score }) {
  const value = typeof score === 'number' ? score : 0;

  let classes = 'bg-red-100 text-red-800';
  let dot = 'bg-red-500';
  if (value >= 80) {
    classes = 'bg-green-100 text-green-800';
    dot = 'bg-green-500';
  } else if (value >= 60) {
    classes = 'bg-yellow-100 text-yellow-800';
    dot = 'bg-yellow-500';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium ${classes}`}
      title={`Score de completude: ${value}%`}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
      {value}%
    </span>
  );
}
