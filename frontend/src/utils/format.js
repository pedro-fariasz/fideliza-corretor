// Formatação para conteúdo voltado ao usuário (pt-BR).

export function formatBRL(valor) {
  const n = Number(valor);
  if (Number.isNaN(n)) return 'R$ 0,00';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// 'YYYY-MM-DD' -> 'DD/MM/AAAA' (sem sofrer com fuso: parse manual).
export function formatData(iso) {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  const [a, m, d] = s.split('-');
  if (!a || !m || !d) return iso;
  return `${d}/${m}/${a}`;
}

// ISO com hora -> 'DD/MM HH:mm'
export function formatDataHora(iso) {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  const dia = String(dt.getDate()).padStart(2, '0');
  const mes = String(dt.getMonth() + 1).padStart(2, '0');
  const hora = String(dt.getHours()).padStart(2, '0');
  const min = String(dt.getMinutes()).padStart(2, '0');
  return `${dia}/${mes} ${hora}:${min}`;
}
