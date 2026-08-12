import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { pendenciasPorUrgencia } from '../../utils/clientesMetrics';

// Pendências do corretor: "completar cadastro" (score baixo) e "entrar em
// contato" (contato antigo/ausente), agrupadas por urgência.
export default function PendenciasPage() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await api.listarClientes();
        if (vivo) setClientes(Array.isArray(data) ? data : []);
      } catch (err) {
        if (vivo) setError(err.message || 'Erro ao carregar pendências.');
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  if (loading) {
    return <p className="py-12 text-center text-gray-500 dark:text-gray-400">Carregando...</p>;
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
        {error}
      </div>
    );
  }

  const { urgente, atencao } = pendenciasPorUrgencia(clientes);

  if (urgente.length === 0 && atencao.length === 0) {
    return (
      <div className="animate-rise rounded-2xl border border-gray-100 bg-white p-10 text-center text-gray-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
        Nenhuma pendência. Carteira em dia.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Grupo
        titulo="Urgente"
        cor="text-red-600"
        descricao="Alertas automáticos suspensos até completar o cadastro."
        itens={urgente}
      />
      <Grupo
        titulo="Atenção"
        cor="text-brand-amber"
        descricao="Vale resolver em breve para manter o relacionamento em dia."
        itens={atencao}
      />
    </div>
  );
}

function Grupo({ titulo, cor, descricao, itens }) {
  if (itens.length === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h2 className={`font-heading text-base font-semibold ${cor}`}>{titulo}</h2>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-white/10 dark:text-gray-300">
          {itens.length}
        </span>
      </div>
      <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">{descricao}</p>
      <ul className="space-y-2">
        {itens.map((p, i) => (
          <li
            key={`${p.cliente.id}-${p.tipo}-${i}`}
            style={{ '--rise-delay': `${Math.min(i, 10) * 40}ms` }}
            className="animate-rise flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/5"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-brand-navy dark:text-white">
                {p.cliente.nome}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{p.motivo}</p>
            </div>
            <span className="text-xs uppercase tracking-wide text-gray-400">
              {p.tipo === 'cadastro' ? 'completar cadastro' : 'entrar em contato'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
