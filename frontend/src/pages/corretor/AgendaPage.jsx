import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import { formatDataHora } from '../../utils/format';

const VAZIO = { titulo: '', data_inicio: '', data_fim: '', descricao: '' };

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
          className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-dark"
        >
          + Novo compromisso
        </button>
      </div>

      {loading ? (
        <p className="py-12 text-center text-gray-500 dark:text-gray-400">Carregando...</p>
      ) : error ? (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : compromissos.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
          <p className="text-gray-600 dark:text-gray-300">Nenhum compromisso agendado.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {compromissos.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-brand-navy dark:text-white">{c.titulo}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDataHora(c.data_inicio)} → {formatDataHora(c.data_fim)}
                </p>
                {c.descricao && <p className="mt-1 truncate text-sm text-gray-400">{c.descricao}</p>}
              </div>
              <button
                type="button"
                onClick={() => remover(c.id)}
                className="shrink-0 text-sm text-gray-400 hover:text-red-600"
              >
                Remover
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
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-300"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-dark disabled:opacity-60"
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
