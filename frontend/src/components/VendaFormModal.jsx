import { useState, useEffect } from 'react';
import { api } from '../services/api';
import Modal from './Modal';
import FormField from './FormField';
import { FORMAS_PAGAMENTO } from '../utils/crmConstants';

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

// Registra a venda a partir do funil. Ao confirmar, o backend gera as parcelas
// de comissão e move o lead para "Venda Concluída".
export default function VendaFormModal({ open, onClose, onSaved, lead }) {
  const [produtos, setProdutos] = useState([]);
  const [form, setForm] = useState({
    produto_id: '',
    produto_nome: '',
    valor: '',
    forma_pagamento: '',
    data_venda: hoje(),
    observacoes: '',
  });
  const [modoManual, setModoManual] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm({
      produto_id: '',
      produto_nome: '',
      valor: lead && lead.valor_estimado ? String(lead.valor_estimado) : '',
      forma_pagamento: '',
      data_venda: hoje(),
      observacoes: '',
    });
    setModoManual(false);
    setErro('');
    (async () => {
      try {
        const data = await api.listarProdutos({ ativo: true });
        const lista = Array.isArray(data) ? data : [];
        setProdutos(lista);
        setModoManual(lista.length === 0);
      } catch (err) {
        setErro(err.message || 'Erro ao carregar produtos.');
      }
    })();
  }, [open, lead]);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function salvar() {
    setSalvando(true);
    setErro('');
    try {
      const venda = await api.criarVenda({
        lead_id: lead ? lead.id : null,
        produto_id: modoManual ? null : form.produto_id,
        produto_nome: modoManual ? form.produto_nome || null : null,
        valor: form.valor === '' ? null : Number(form.valor),
        forma_pagamento: form.forma_pagamento || null,
        data_venda: form.data_venda,
        observacoes: form.observacoes || null,
      });
      onSaved(venda);
      onClose();
    } catch (err) {
      setErro(err.message || 'Erro ao registrar a venda.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Registrar venda${lead ? ` — ${lead.nome}` : ''}`}
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
            disabled={salvando}
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-dark disabled:opacity-60"
          >
            {salvando ? 'Salvando...' : 'Registrar venda'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {modoManual ? (
          <FormField
            label="Nome do plano / operadora"
            name="produto_nome"
            value={form.produto_nome}
            onChange={onChange}
            placeholder="Ex.: Amil S450 (digite se o PDF não foi lido)"
          />
        ) : (
          <FormField
            label="Produto"
            name="produto_id"
            value={form.produto_id}
            onChange={onChange}
            options={produtos.map((p) => ({ value: p.id, label: p.nome }))}
            required
          />
        )}
        {produtos.length > 0 && (
          <button
            type="button"
            onClick={() => setModoManual((m) => !m)}
            className="text-xs font-semibold text-brand-blue hover:text-brand-blue-dark"
          >
            {modoManual ? 'Selecionar da lista de produtos' : 'Digitar nome manualmente'}
          </button>
        )}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Valor do negócio (R$)" name="valor" type="number" min={0.01} step="0.01" value={form.valor} onChange={onChange} required />
          <FormField label="Data da venda" name="data_venda" type="date" value={form.data_venda} onChange={onChange} required />
        </div>
        <FormField label="Forma de pagamento" name="forma_pagamento" value={form.forma_pagamento} onChange={onChange} options={FORMAS_PAGAMENTO} />
        <FormField label="Observações" name="observacoes" type="textarea" value={form.observacoes} onChange={onChange} />
        {erro && <p className="text-sm text-red-600">{erro}</p>}
      </div>
    </Modal>
  );
}
