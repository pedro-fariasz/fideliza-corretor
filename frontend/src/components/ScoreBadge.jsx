// Selo do score de completude. O score vem SEMPRE calculado pela API
// (score_completude) — o frontend só exibe.
export default function ScoreBadge({ score }) {
  const value = typeof score === 'number' ? score : 0;

  let classes = 'bg-red-100 text-red-800';
  let dot = '🔴';
  if (value >= 80) {
    classes = 'bg-green-100 text-green-800';
    dot = '🟢';
  } else if (value >= 60) {
    classes = 'bg-yellow-100 text-yellow-800';
    dot = '🟡';
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium ${classes}`}
      title={`Score de completude: ${value}%`}
    >
      <span aria-hidden="true">{dot}</span>
      {value}%
    </span>
  );
}
