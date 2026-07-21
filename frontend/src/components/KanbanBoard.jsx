// =============================================================================
// KanbanBoard — quadro kanban de LEITURA (sem drag-and-drop), reutilizável.
// Usado pelo kanban de clientes (por corretor) e pelo kanban de corretores.
//
// Props:
//   columns    -> [{ id, titulo, match(item) }]  (ordem = prioridade de encaixe:
//                 cada item entra na PRIMEIRA coluna cujo match bate; sobra vai
//                 para a última coluna)
//   items      -> array de dados
//   renderCard -> (item) => JSX do card
//   getKey     -> (item) => chave estável
// =============================================================================

// Classe estática por nº de colunas (Tailwind v4 precisa de classe literal).
const LG_COLS = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
};

function distribuir(columns, items) {
  const baldes = Object.fromEntries(columns.map((c) => [c.id, []]));
  for (const item of items) {
    const col = columns.find((c) => c.match(item)) || columns[columns.length - 1];
    if (col) baldes[col.id].push(item);
  }
  return baldes;
}

export default function KanbanBoard({ columns, items, renderCard, getKey }) {
  const baldes = distribuir(columns, items);
  const lg = LG_COLS[columns.length] || 'lg:grid-cols-3';

  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${lg}`}>
      {columns.map((col) => (
        <div key={col.id} className="flex flex-col">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-heading text-sm font-semibold text-brand-navy dark:text-white">
              {col.titulo}
            </h3>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-white/10 dark:text-gray-300">
              {baldes[col.id].length}
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-2 rounded-lg bg-gray-50 p-2 dark:bg-white/[0.03]">
            {baldes[col.id].length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-gray-400">Vazio</p>
            ) : (
              baldes[col.id].map((item) => <div key={getKey(item)}>{renderCard(item)}</div>)
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
