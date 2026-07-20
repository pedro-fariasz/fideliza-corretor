import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import FormField from '../components/FormField';
import ScoreBadge from '../components/ScoreBadge';
import Logo from '../components/Logo';

const TIPO_PLANO_OPTIONS = [
  { value: 'PF', label: 'PF (individual/familiar)' },
  { value: 'PME', label: 'PME' },
  { value: 'Adesao', label: 'Adesão' },
  { value: 'PJ', label: 'PJ' },
];

const SINISTRALIDADE_OPTIONS = [
  { value: 'baixo', label: 'Baixo' },
  { value: 'medio', label: 'Médio' },
  { value: 'alto', label: 'Alto' },
];

const INITIAL_FORM = {
  // Obrigatórios
  nome: '',
  telefone_whatsapp: '',
  data_inicio_plano: '',
  operadora: '',
  // Importantes
  data_aniversario: '',
  email: '',
  tipo_plano: '',
  // Complementares
  nivel_sinistralidade: '',
  data_encerramento: '',
  carencia_meses: '',
  qtd_dependentes: '',
  // Outros (não afetam o score)
  cpf: '',
  plano_nome: '',
  valor_mensalidade: '',
  vencimento_boleto: '',
  notas: '',
  // Consentimento LGPD/Meta — mensagem de aniversário é marketing
  aceita_felicitacao_aniversario: false,
};

const REQUIRED_FIELDS = {
  nome: 'Informe o nome do cliente.',
  telefone_whatsapp: 'Informe o telefone/WhatsApp.',
  data_inicio_plano: 'Informe a data de início do plano.',
  operadora: 'Informe a operadora.',
};

function parseIntOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

function parseFloatOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number.parseFloat(value);
  return Number.isNaN(n) ? null : n;
}

function buildPayload(form) {
  // Strings vazias viram null (omitidas do envio); números são convertidos.
  const payload = {
    nome: form.nome.trim(),
    telefone_whatsapp: form.telefone_whatsapp.trim(),
    data_inicio_plano: form.data_inicio_plano || null,
    operadora: form.operadora.trim(),
    data_aniversario: form.data_aniversario || null,
    email: form.email.trim() || null,
    tipo_plano: form.tipo_plano || null,
    nivel_sinistralidade: form.nivel_sinistralidade || null,
    data_encerramento: form.data_encerramento || null,
    carencia_meses: parseIntOrNull(form.carencia_meses),
    qtd_dependentes: parseIntOrNull(form.qtd_dependentes),
    cpf: form.cpf.trim() || null,
    plano_nome: form.plano_nome.trim() || null,
    valor_mensalidade: parseFloatOrNull(form.valor_mensalidade),
    vencimento_boleto: parseIntOrNull(form.vencimento_boleto),
    notas: form.notas.trim() || null,
    // Consentimento explícito (LGPD + regras da Meta para mensagens de marketing).
    // Persistido na coluna criada pela migration 002_consentimento_felicitacao.sql.
    aceita_felicitacao_aniversario: form.aceita_felicitacao_aniversario,
  };

  // Remove nulls para enviar um corpo enxuto (o backend trata ausência como vazio).
  for (const key of Object.keys(payload)) {
    if (payload[key] === null) delete payload[key];
  }
  return payload;
}

const sectionClasses = 'rounded-lg bg-white p-5 shadow-sm';
const sectionTitleClasses =
  'mb-4 border-b border-gray-200 pb-2 text-sm font-bold uppercase tracking-wide';
const gridClasses = 'grid grid-cols-1 gap-4 sm:grid-cols-2';

export default function ClienteFormPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [savedScore, setSavedScore] = useState(null);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  function validate() {
    const errors = {};
    for (const [field, message] of Object.entries(REQUIRED_FIELDS)) {
      if (!String(form[field]).trim()) errors[field] = message;
    }
    const vencimento = parseIntOrNull(form.vencimento_boleto);
    if (form.vencimento_boleto !== '' && (vencimento === null || vencimento < 1 || vencimento > 31)) {
      errors.vencimento_boleto = 'Informe um dia entre 1 e 31.';
    }
    return errors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setApiError('');

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setApiError('Preencha os campos obrigatórios destacados antes de salvar.');
      return;
    }

    setSubmitting(true);
    try {
      const cliente = await api.criarCliente(buildPayload(form));
      setSavedScore(cliente?.score_completude ?? 0);
    } catch (err) {
      setApiError(err.message || 'Erro ao salvar o cliente.');
    } finally {
      setSubmitting(false);
    }
  }

  // Depois de salvar: mostra o score retornado pela API e volta pra lista.
  useEffect(() => {
    if (savedScore === null) return undefined;
    const timer = setTimeout(() => navigate('/', { replace: true }), 3000);
    return () => clearTimeout(timer);
  }, [savedScore, navigate]);

  if (savedScore !== null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow">
          <p className="text-lg font-semibold text-brand-navy">Cliente salvo com sucesso!</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="text-sm text-gray-600">Score de completude:</span>
            <ScoreBadge score={savedScore} />
          </div>
          {savedScore < 60 && (
            <p className="mt-3 text-sm text-yellow-700">
              Cadastro incompleto — complete os dados depois para ativar todos os alertas.
            </p>
          )}
          <p className="mt-4 text-sm text-gray-400">Voltando para a lista...</p>
          <Link to="/" className="mt-2 inline-block text-sm font-semibold text-brand-blue underline">
            Ir para a lista agora
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to="/" aria-label="Voltar para a lista">
              <Logo variant="simbolo" size={32} />
            </Link>
            <h1 className="text-xl font-bold text-brand-navy">Novo cliente</h1>
          </div>
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-800">
            ← Voltar para a lista
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <section className={sectionClasses}>
            <h2 className={`${sectionTitleClasses} text-red-700`}>
              Obrigatórios — sem eles não há alertas
            </h2>
            <div className={gridClasses}>
              <FormField
                label="Nome"
                name="nome"
                value={form.nome}
                onChange={handleChange}
                required
                error={fieldErrors.nome}
              />
              <FormField
                label="Telefone / WhatsApp"
                name="telefone_whatsapp"
                value={form.telefone_whatsapp}
                onChange={handleChange}
                type="tel"
                placeholder="(11) 99999-9999"
                required
                error={fieldErrors.telefone_whatsapp}
              />
              <FormField
                label="Data de início do plano"
                name="data_inicio_plano"
                value={form.data_inicio_plano}
                onChange={handleChange}
                type="date"
                required
                error={fieldErrors.data_inicio_plano}
              />
              <FormField
                label="Operadora"
                name="operadora"
                value={form.operadora}
                onChange={handleChange}
                placeholder="Ex.: Amil, Unimed, Bradesco"
                required
                error={fieldErrors.operadora}
              />
            </div>
          </section>

          <section className={sectionClasses}>
            <h2 className={`${sectionTitleClasses} text-brand-blue-dark`}>
              Importantes — melhoram o cadastro
            </h2>
            <div className={gridClasses}>
              <FormField
                label="Data de aniversário do titular"
                name="data_aniversario"
                value={form.data_aniversario}
                onChange={handleChange}
                type="date"
              />
              <FormField
                label="E-mail"
                name="email"
                value={form.email}
                onChange={handleChange}
                type="email"
                placeholder="cliente@email.com"
              />
              <FormField
                label="Tipo de plano"
                name="tipo_plano"
                value={form.tipo_plano}
                onChange={handleChange}
                options={TIPO_PLANO_OPTIONS}
              />
            </div>
          </section>

          <section className={sectionClasses}>
            <h2 className={`${sectionTitleClasses} text-gray-600`}>Complementares</h2>
            <div className={gridClasses}>
              <FormField
                label="Nível de sinistralidade"
                name="nivel_sinistralidade"
                value={form.nivel_sinistralidade}
                onChange={handleChange}
                options={SINISTRALIDADE_OPTIONS}
              />
              <FormField
                label="Data de encerramento"
                name="data_encerramento"
                value={form.data_encerramento}
                onChange={handleChange}
                type="date"
              />
              <FormField
                label="Carência (meses)"
                name="carencia_meses"
                value={form.carencia_meses}
                onChange={handleChange}
                type="number"
                min={0}
              />
              <FormField
                label="Quantidade de dependentes"
                name="qtd_dependentes"
                value={form.qtd_dependentes}
                onChange={handleChange}
                type="number"
                min={0}
              />
            </div>
          </section>

          <section className={sectionClasses}>
            <h2 className={`${sectionTitleClasses} text-gray-500`}>
              Outros — não afetam o score
            </h2>
            <div className={gridClasses}>
              <FormField
                label="CPF (opcional)"
                name="cpf"
                value={form.cpf}
                onChange={handleChange}
                placeholder="000.000.000-00"
              />
              <FormField
                label="Nome do plano"
                name="plano_nome"
                value={form.plano_nome}
                onChange={handleChange}
                placeholder="Ex.: Amil S450"
              />
              <FormField
                label="Valor da mensalidade (R$)"
                name="valor_mensalidade"
                value={form.valor_mensalidade}
                onChange={handleChange}
                type="number"
                min={0}
                step="0.01"
              />
              <FormField
                label="Dia de vencimento do boleto (1–31)"
                name="vencimento_boleto"
                value={form.vencimento_boleto}
                onChange={handleChange}
                type="number"
                min={1}
                max={31}
                error={fieldErrors.vencimento_boleto}
              />
              <div className="sm:col-span-2">
                <FormField
                  label="Notas"
                  name="notas"
                  value={form.notas}
                  onChange={handleChange}
                  type="textarea"
                  placeholder="Observações sobre o cliente"
                />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-brand-blue/25 bg-brand-blue/5 p-5">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="aceita_felicitacao_aniversario"
                checked={form.aceita_felicitacao_aniversario}
                onChange={handleChange}
                className="mt-0.5 h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-800">
                <strong>Cliente aceita receber felicitação de aniversário por WhatsApp</strong>
                <br />
                <span className="text-gray-600">
                  A mensagem de aniversário é classificada como marketing pela Meta e exige
                  consentimento explícito do cliente (LGPD + regras da Meta).
                </span>
              </span>
            </label>
          </section>

          {apiError && (
            <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{apiError}</div>
          )}

          <div className="flex items-center justify-end gap-3 pb-8">
            <Link to="/" className="text-sm text-gray-500 hover:text-gray-800">
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-brand-blue px-6 py-2 text-sm font-semibold text-white hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Salvando...' : 'Salvar cliente'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
