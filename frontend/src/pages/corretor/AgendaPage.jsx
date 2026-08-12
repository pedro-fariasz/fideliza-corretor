import { useEffect, useState } from 'react';
import { CalendarClock, X } from 'lucide-react';
import { api } from '../../services/api';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import EmptyState from '../../components/EmptyState';
import { formatDataHora } from '../../utils/format';

const VAZIO = { titulo: '', data_inicio: '', data_fim: '', descricao: '' };
const CARD = 'rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-white/5';

export default function AgendaPage() {
  const [compromissos, setCompromissos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [formErro, setFormErro] = useState('');

  async function carregar() {
    setLoading(true);
    setError('');
    try {
      const data = await api.listarAgenda();
      setCompromissos(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Erro ao carregar a agenda.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function salvar() {
    setSalvando(true);
    setFormErro('');
    try {
      await api.criarCompromisso({
        titulo: form.titulo,
        data_inicio: form.data_inicio ? new Date(form.data_inicio).toISOString() : null,
        data_fim: form.data_fim ? new Date(form.data_fim).toISOString() : null,
        descricao: form.descricao || null,
      });
      setAberto(false);
      setForm(VAZIO);
      await carregar();
    } catch (err) {
      setFormErro(err.message || 'Erro ao salvar o compromisso.');
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id) {
    try {
      await api.removerCompromisso(id);
      await carregar();
    } catch (err) {
      setError(err.message || 'Erro ao remover.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">Seus compromissos, do mais próximo ao mais distante.</p>
        <button
          type="button"
          onClick={() => {
            setForm(VAZIO);
            setFormErro('');
            setAberto(true);
          }}
          className="press rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-dark"
        >
          + Novo compromisso
        </button>
      </div>

      {loading ? (
        <AgendaSkeleton />
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      ) : compromissos.length === 0 ? (
        <div className={`${CARD} p-8`}>
          <EmptyState
            icon={CalendarClock}
            title="Nenhum compromisso agendado"
            description="Marque seu próximo follow-up ou reunião."
          />
        </div>
      ) : (
        <ul className="space-y-2.5">
          {compromissos.map((c, i) => (
            <li
              key={c.id}
              style={{ '--rise-delay': `${Math.min(i, 10) * 40}ms` }}
              className={`${CARD} animate-rise flex items-center gap-4 p-4 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-md`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue">
                <CalendarClock size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-brand-navy dark:text-white">{c.titulo}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDataHora(c.data_inicio)} → {formatDataHora(c.data_fim)}
                </p>
                {c.descricao && <p className="mt-1 truncate text-sm text-gray-400">{c.descricao}</p>}
              </div>
              <button
                type="button"
                onClick={() => remover(c.id)}
                aria-label={`Remover ${c.titulo}`}
                title="Remover"
                className="press inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={aberto}
        onClose={() => setAberto(false)}
        title="Novo compromisso"
        footer={
          <>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="press rounded-lg px-4 py-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="press rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-dark disabled:opacity-60"
            >
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Título" name="titulo" value={form.titulo} onChange={onChange} required />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Início" name="data_inicio" type="datetime-local" value={form.data_inicio} onChange={onChange} required />
            <FormField label="Fim" name="data_fim" type="datetime-local" value={form.data_fim} onChange={onChange} required />
          </div>
          <FormField label="Descrição" name="descricao" type="textarea" value={form.descricao} onChange={onChange} />
          {formErro && <p className="text-sm text-red-600">{formErro}</p>}
        </div>
      </Modal>
    </div>
  );
}

function AgendaSkeleton() {
  return (
    <ul className="space-y-2.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className={`${CARD} flex items-center gap-4 p-4`}>
          <div className="shimmer h-10 w-10 shrink-0 rounded-xl bg-gray-100 dark:bg-white/10" />
          <div className="flex-1">
            <div className="shimmer h-3.5 w-40 rounded bg-gray-100 dark:bg-white/10" />
            <div className="shimmer mt-2 h-3 w-56 rounded bg-gray-100 dark:bg-white/10" />
          </div>
        </li>
      ))}
    </ul>
  );
}
