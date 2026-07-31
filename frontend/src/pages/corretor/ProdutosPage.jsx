import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import { TIPOS_PLANO_SAUDE, TIPO_PLANO_SAUDE_LABEL } from '../../utils/crmConstants';

const VAZIO = {
  nome: '',
  tipo_plano_saude: '',
  descricao: '',
  tipo_comissao: 'limitada',
  parcelas_limite: '',
  percentual: '',
  inicio_pagamento: 'mes_seguinte',
  dia_pagamento: '',
  vigencia_meses: 12,
  ativo: true,
};

function labelComissao(p) {
  const base = p.tipo_comissao === 'recorrente' ? 'Recorrente' : `${p.parcelas_limite}x`;
  const unica = p.tipo_comissao === 'limitada' && p.parcelas_limite === 1 ? 'Venda única' : base;
  return `${unica} · ${p.percentual}%`;
}

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(VAZIO);
  const [editId, setEditId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [formErro, setFormErro] = useState('');

  async function carregar() {
    setLoading(true);
    setError('');
    try {
      const data = await api.listarProdutos();
      setProdutos(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Erro ao carregar produtos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function abrirNovo() {
    setForm(VAZIO);
    setEditId(null);
    setFormErro('');
    setAberto(true);
  }

  function abrirEdicao(p) {
    setForm({
      nome: p.nome || '',
      // Saúde-only: mostra só tipo_plano_saude (categoria legada é ignorada).
      tipo_plano_saude: p.tipo_plano_saude || '',
      descricao: p.descricao || '',
      tipo_comissao: p.tipo_comissao || 'limitada',
      parcelas_limite: p.parcelas_limite ?? '',
      percentual: p.percentual ?? '',
      inicio_pagamento: p.inicio_pagamento || 'mes_seguinte',
      dia_pagamento: p.dia_pagamento ?? '',
      vigencia_meses: p.vigencia_meses ?? 12,
      ativo: p.ativo,
    });
    setEditId(p.id);
    setFormErro('');
    setAberto(true);
  }

  function onChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  }

  async function salvar() {
    setSalvando(true);
    setFormErro('');
    try {
      const payload = {
        nome: form.nome,
        tipo_plano_saude: form.tipo_plano_saude || null,
        descricao: form.descricao,
        tipo_comissao: form.tipo_comissao,
        percentual: form.percentual === '' ? null : Number(form.percentual),
        inicio_pagamento: form.inicio_pagamento,
        ativo: form.ativo,
        parcelas_limite:
          form.tipo_comissao === 'limitada' && form.parcelas_limite !== ''
            ? Number(form.parcelas_limite)
            : null,
        dia_pagamento:
          form.inicio_pagamento === 'mesmo_mes' && form.dia_pagamento !== ''
            ? Number(form.dia_pagamento)
            : null,
        vigencia_meses: form.vigencia_meses === '' ? 12 : Number(form.vigencia_meses),
      };
      if (editId) await api.atualizarProduto(editId, payload);
      else await api.criarProduto(payload);
      setAberto(false);
      await carregar();
    } catch (err) {
      setFormErro(err.message || 'Erro ao salvar o produto.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Produtos e suas regras de comissão. Todo produto do funil vem daqui.
        </p>
        <button
          type="button"
          onClick={abrirNovo}
          className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-dark"
        >
          + Novo produto
        </button>
      </div>

      {loading ? (
        <p className="py-12 text-center text-gray-500 dark:text-gray-400">Carregando...</p>
      ) : error ? (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : produtos.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
          <p className="text-gray-600 dark:text-gray-300">Nenhum produto cadastrado.</p>
          <p className="mt-1 text-sm text-gray-400">Cadastre o primeiro para registrar vendas e comissões.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Comissão</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm dark:divide-white/5">
              {produtos.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium text-brand-navy dark:text-white">{p.nome}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {TIPO_PLANO_SAUDE_LABEL[p.tipo_plano_saude] || p.tipo_plano_saude || p.categoria || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{labelComissao(p)}</td>
                  <td className="px-4 py-3">
                    {p.ativo ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Ativo</span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Inativo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => abrirEdicao(p)}
                      className="text-sm font-medium text-brand-blue hover:text-brand-blue-dark"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={aberto}
        onClose={() => setAberto(false)}
        title={editId ? 'Editar produto' : 'Novo produto'}
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
          <FormField label="Nome do produto" name="nome" value={form.nome} onChange={onChange} required />
          <FormField label="Tipo do plano" name="tipo_plano_saude" value={form.tipo_plano_saude} onChange={onChange} options={TIPOS_PLANO_SAUDE} required />
          <FormField label="Descrição" name="descricao" type="textarea" value={form.descricao} onChange={onChange} />

          <FormField
            label="Tipo de comissão"
            name="tipo_comissao"
            value={form.tipo_comissao}
            onChange={onChange}
            options={[
              { value: 'limitada', label: 'Parcelas limitadas' },
              { value: 'recorrente', label: 'Recorrente (mensal)' },
            ]}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            {form.tipo_comissao === 'limitada' && (
              <FormField
                label="Nº de parcelas"
                name="parcelas_limite"
                type="number"
                min={1}
                max={120}
                value={form.parcelas_limite}
                onChange={onChange}
                required
              />
            )}
            <FormField
              label="% de comissão"
              name="percentual"
              type="number"
              min={0.01}
              max={100}
              step="0.01"
              value={form.percentual}
              onChange={onChange}
              required
            />
          </div>

          <FormField
            label="Início do pagamento"
            name="inicio_pagamento"
            value={form.inicio_pagamento}
            onChange={onChange}
            options={[
              { value: 'mes_seguinte', label: 'Mês seguinte à venda' },
              { value: 'mesmo_mes', label: 'Mesmo mês da venda' },
            ]}
            required
          />

          {form.inicio_pagamento === 'mesmo_mes' && (
            <FormField
              label="Dia do pagamento"
              name="dia_pagamento"
              type="number"
              min={1}
              max={28}
              value={form.dia_pagamento}
              onChange={onChange}
              required
            />
          )}

          <FormField
            label="Vigência (meses) — prazo do contrato p/ a apólice"
            name="vigencia_meses"
            type="number"
            min={1}
            max={120}
            value={form.vigencia_meses}
            onChange={onChange}
          />

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" name="ativo" checked={form.ativo} onChange={onChange} className="h-4 w-4" />
            Produto ativo (visível ao registrar vendas)
          </label>

          {formErro && <p className="text-sm text-red-600">{formErro}</p>}
        </div>
      </Modal>
    </div>
  );
}
