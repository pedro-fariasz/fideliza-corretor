import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import LeadFormModal from '../../components/LeadFormModal';
import VendaFormModal from '../../components/VendaFormModal';
import { ESTAGIOS } from '../../utils/crmConstants';
import { formatBRL } from '../../utils/format';

// Card do lead. Mostra nome, interesse, valor e dias sem contato.
function LeadCard({ lead, onDragStart }) {
  const dias = lead.ultimo_contato_em
    ? Math.floor((Date.now() - new Date(lead.ultimo_contato_em).getTime()) / 86400000)
    : null;
  const cor = dias == null ? '' : dias >= 14 ? 'text-red-600' : dias >= 7 ? 'text-brand-amber' : 'text-gray-400';

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      className="cursor-grab rounded-lg border border-gray-200 bg-white p-3 shadow-sm active:cursor-grabbing dark:border-white/10 dark:bg-white/5"
    >
      <p className="truncate text-sm font-medium text-brand-navy dark:text-white">{lead.nome}</p>
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="capitalize text-gray-400">{lead.interesse || '—'}</span>
        {lead.valor_estimado ? (
          <span className="font-medium text-gray-500 dark:text-gray-400">{formatBRL(lead.valor_estimado)}</span>
        ) : null}
      </div>
      {dias != null && <p className={`mt-1 text-[11px] ${cor}`}>{dias === 0 ? 'contato hoje' : `${dias}d sem contato`}</p>}
    </div>
  );
}

export default function FunilPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [novoAberto, setNovoAberto] = useState(false);
  const [vendaLead, setVendaLead] = useState(null);
  const [dragId, setDragId] = useState(null);

  async function carregar() {
    setLoading(true);
    setError('');
    try {
      const data = await api.listarLeads({ status: 'ativo' });
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Erro ao carregar o funil.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function onDragStart(e, lead) {
    setDragId(lead.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  async function onDrop(estagioDestino) {
    const lead = leads.find((l) => l.id === dragId);
    setDragId(null);
    if (!lead || lead.estagio === estagioDestino) return;

    // Soltar em "Venda Concluída" abre o modal de venda (a venda é que move o lead).
    if (estagioDestino === 'venda_concluida') {
      setVendaLead(lead);
      return;
    }

    // Atualização otimista + rollback em erro.
    const anterior = leads;
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, estagio: estagioDestino } : l)));
    try {
      await api.mudarEstagio(lead.id, estagioDestino);
    } catch (err) {
      setLeads(anterior);
      setError(err.message || 'Não foi possível mover o lead.');
    }
  }

  const porEstagio = (estagio) => leads.filter((l) => l.estagio === estagio);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">Arraste os cards entre as colunas para avançar no funil.</p>
        <button
          type="button"
          onClick={() => setNovoAberto(true)}
          className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-dark"
        >
          + Novo lead
        </button>
      </div>

      {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <p className="py-12 text-center text-gray-500 dark:text-gray-400">Carregando...</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {ESTAGIOS.map((col) => {
            const items = porEstagio(col.value);
            return (
              <div
                key={col.value}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(col.value)}
                className="flex w-64 shrink-0 flex-col rounded-xl bg-gray-50 p-2 dark:bg-white/5"
              >
                <div className="flex items-center justify-between px-2 py-2">
                  <span className="text-sm font-semibold text-brand-navy dark:text-white">{col.label}</span>
                  <span className="rounded-full bg-gray-200 px-2 text-xs text-gray-600 dark:bg-white/10 dark:text-gray-300">
                    {items.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} onDragStart={onDragStart} />
                  ))}
                  {items.length === 0 && (
                    <p className="px-2 py-6 text-center text-xs text-gray-400">Vazio</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <LeadFormModal open={novoAberto} onClose={() => setNovoAberto(false)} onSaved={() => carregar()} />
      <VendaFormModal
        open={!!vendaLead}
        lead={vendaLead}
        onClose={() => setVendaLead(null)}
        onSaved={() => {
          setVendaLead(null);
          carregar();
        }}
      />
    </div>
  );
}
