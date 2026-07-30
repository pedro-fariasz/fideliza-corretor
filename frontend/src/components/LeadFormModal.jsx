import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';
import Modal from './Modal';
import FormField from './FormField';
import { INTERESSES, ORIGENS, ESTAGIOS } from '../utils/crmConstants';

const emailValido = (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const VAZIO = {
  nome: '',
  tipo_pessoa: 'PF',
  empresa: '',
  telefone: '',
  email: '',
  interesse: '',
  origem_especifica: '',
  estagio: 'prospectos',
  valor_estimado: '',
  observacoes: '',
};

// Modal de criação/edição de lead. onSaved recebe o lead salvo.
export default function LeadFormModal({ open, onClose, onSaved, lead = null, estagioInicial }) {
  const { push } = useToast();
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Validação em tempo real (campos mínimos).
  const nomeOk = form.nome.trim().length >= 2;
  const emailOk = emailValido(form.email);
  const podeSalvar = nomeOk && emailOk && !salvando;

  useEffect(() => {
    if (!open) return;
    if (lead) {
      setForm({
        nome: lead.nome || '',
        tipo_pessoa: lead.tipo_pessoa || 'PF',
        empresa: lead.empresa || '',
        telefone: lead.telefone || '',
        email: lead.email || '',
        interesse: lead.interesse || '',
        origem_especifica: lead.origem_especifica || '',
        estagio: lead.estagio || 'prospectos',
        valor_estimado: lead.valor_estimado ?? '',
        observacoes: lead.observacoes || '',
      });
    } else {
      setForm({ ...VAZIO, estagio: estagioInicial || 'prospectos' });
    }
    setErro('');
  }, [open, lead, estagioInicial]);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function salvar() {
    setSalvando(true);
    setErro('');
    try {
      const payload = {
        nome: form.nome,
        tipo_pessoa: form.tipo_pessoa,
        empresa: form.empresa || null,
        telefone: form.telefone || null,
        email: form.email || null,
        interesse: form.interesse || null,
        origem_especifica: form.origem_especifica || null,
        valor_estimado: form.valor_estimado === '' ? null : Number(form.valor_estimado),
        observacoes: form.observacoes || null,
      };
      let salvo;
      if (lead) {
        salvo = await api.atualizarLead(lead.id, payload);
      } else {
        salvo = await api.criarLead({ ...payload, estagio: form.estagio });
      }
      push({ tipo: 'sucesso', texto: lead ? 'Lead atualizado.' : 'Lead cadastrado com sucesso.' });
      onSaved(salvo);
      onClose();
    } catch (err) {
      const msg = err.message || 'Erro ao salvar o lead.';
      setErro(msg);
      push({ tipo: 'erro', texto: msg });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={lead ? 'Editar lead' : 'Novo lead'}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-300"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={!podeSalvar}
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField
          label="Tipo de pessoa"
          name="tipo_pessoa"
          value={form.tipo_pessoa}
          onChange={onChange}
          options={[
            { value: 'PF', label: 'Pessoa Física (CPF)' },
            { value: 'PJ', label: 'Pessoa Jurídica (CNPJ)' },
          ]}
        />
        <FormField label="Nome completo" name="nome" value={form.nome} onChange={onChange} required />
        {form.tipo_pessoa === 'PJ' && (
          <FormField label="Empresa" name="empresa" value={form.empresa} onChange={onChange} />
        )}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Telefone" name="telefone" value={form.telefone} onChange={onChange} placeholder="(11) 99999-9999" />
          <div>
            <FormField label="E-mail" name="email" type="email" value={form.email} onChange={onChange} />
            {!emailOk && <p className="mt-1 text-xs text-red-600">E-mail inválido.</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Interesse" name="interesse" value={form.interesse} onChange={onChange} options={INTERESSES} />
          <FormField label="Valor estimado (R$)" name="valor_estimado" type="number" min={0} step="0.01" value={form.valor_estimado} onChange={onChange} />
        </div>
        <FormField label="Origem específica" name="origem_especifica" value={form.origem_especifica} onChange={onChange} options={ORIGENS} />
        {!lead && (
          <FormField label="Estágio inicial" name="estagio" value={form.estagio} onChange={onChange} options={ESTAGIOS} />
        )}
        <FormField label="Observações" name="observacoes" type="textarea" value={form.observacoes} onChange={onChange} />
        {erro && <p className="text-sm text-red-600">{erro}</p>}
      </div>
    </Modal>
  );
}
