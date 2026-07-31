import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import { formatBRL, formatData } from '../../utils/format';
import { FORMAS_PAGAMENTO } from '../../utils/crmConstants';

const COLUNAS = [
  { key: 'vencidas', label: 'Vencidas', cls: 'text-red-600' },
  { key: 'urgentes', label: 'Urgentes (≤15d)', cls: 'text-brand-amber' },
  { key: 'em_atencao', label: 'Em atenção (16-45d)', cls: 'text-yellow-600' },
  { key: 'em_dia', label: 'Em dia', cls: 'text-green-600' },
  { key: 'canceladas', label: 'Canceladas', cls: 'text-gray-400' },
];

const METRICAS = [
  { key: 'trc', label: 'Renovação (TRC)', fmt: (v) => `${v}%`, meta: '≥85%' },
  { key: 'tcc', label: 'Cancelamento (TCC)', fmt: (v) => `${v}%`, meta: '≤10%' },
  { key: 'nps', label: 'NPS', fmt: (v) => `${v}`, meta: '≥50' },
  { key: 'ltv', label: 'LTV médio', fmt: (v) => formatBRL(v), meta: 'por vertical' },
  { key: 'ppc', label: 'Produtos/cliente (PPC)', fmt: (v) => `${v}`, meta: '≥1,8' },
  { key: 'rpc', label: 'Receita/cliente (RPC)', fmt: (v) => formatBRL(v), meta: 'por vertical' },
  { key: 'tmr', label: 'Tempo renov. (TMR)', fmt: (v) => `${v}d`, meta: '≤0d' },
];

const MOTIVOS = [
  { value: 'preco', label: 'Preço' },
  { value: 'concorrencia', label: 'Concorrência' },
  { value: 'sinistro', label: 'Sinistro/Uso' },
  { value: 'mudanca_necessidade', label: 'Mudança de necessidade' },
  { value: 'insatisfacao', label: 'Insatisfação' },
  { value: 'sem_contato', label: 'Sem contato' },
  { value: 'outro', label: 'Outro' },
];

const FAIXA_CLS = { verde: 'text-green-600', amarelo: 'text-brand-amber', vermelho: 'text-red-600', sem_dados: 'text-gray-400' };

function situacao(a) {
  if (a.status === 'cancelada') return { label: 'Cancelada', cls: 'bg-gray-100 text-gray-500' };
  if (a.status === 'renovada') return { label: 'Renovada', cls: 'bg-blue-100 text-blue-700' };
  const dias = Math.round((new Date(a.data_vencimento) - new Date()) / 86400000);
  if (dias < 0) return { label: 'Vencida', cls: 'bg-red-100 text-red-700' };
  if (dias <= 15) return { label: 'Urgente', cls: 'bg-amber-100 text-amber-700' };
  if (dias <= 45) return { label: 'Em atenção', cls: 'bg-yellow-100 text-yellow-700' };
  return { label: 'Em dia', cls: 'bg-green-100 text-green-700' };
}

const AVULSO_VAZIO = {
  nome: '', telefone: '', email: '', empresa: '', data_nascimento: '',
  produto_id: '', produto_nome: '', valor: '', forma_pagamento: '', data_inicio: new Date().toISOString().slice(0, 10),
  prazo: '12', data_vencimento: '', observacoes: '',
};

export default function CarteiraPage() {
  const [vista, setVista] = useState('clientes'); // 'clientes' | 'apolices'
  const [dados, setDados] = useState(null);
  const [metr, setMetr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [produtos, setProdutos] = useState([]);

  const [avulsoAberto, setAvulsoAberto] = useState(false);
  const [avulso, setAvulso] = useState(AVULSO_VAZIO);
  const [avulsoManual, setAvulsoManual] = useState(false);
  const [cancelar, setCancelar] = useState(null); // apólice
  const [motivo, setMotivo] = useState('preco');
  const [salvando, setSalvando] = useState(false);
  const [formErro, setFormErro] = useState('');

  async function carregar() {
    setLoading(true);
    setError('');
    try {
      const [pipe, m] = await Promise.all([api.carteiraPipeline(), api.carteiraMetricas()]);
      setDados(pipe);
      setMetr(m);
    } catch (err) {
      setError(err.message || 'Erro ao carregar a carteira.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    api
      .listarProdutos({ ativo: true })
      .then((p) => {
        const lista = Array.isArray(p) ? p : [];
        setProdutos(lista);
        setAvulsoManual(lista.length === 0);
      })
      .catch(() => {});
  }, []);

  function onAvulsoChange(e) {
    const { name, value } = e.target;
    setAvulso((f) => ({ ...f, [name]: value }));
  }

  async function salvarAvulso() {
    setSalvando(true);
    setFormErro('');
    try {
      await api.criarNegocioAvulso({
        nome: avulso.nome,
        telefone: avulso.telefone || null,
        email: avulso.email || null,
        empresa: avulso.empresa || null,
        data_nascimento: avulso.data_nascimento || null,
        produto_id: avulsoManual ? null : avulso.produto_id,
        produto_nome: avulsoManual ? avulso.produto_nome || null : null,
        valor: avulso.valor === '' ? null : Number(avulso.valor),
        forma_pagamento: avulso.forma_pagamento || null,
        data_inicio: avulso.data_inicio,
        data_vencimento: avulso.data_vencimento || null, // vazio => backend calcula pela vigência
        observacoes: avulso.observacoes || null,
      });
      setAvulsoAberto(false);
      setAvulso(AVULSO_VAZIO);
      await carregar();
    } catch (err) {
      setFormErro(err.message || 'Erro ao cadastrar o negócio.');
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarCancelar() {
    setSalvando(true);
    setFormErro('');
    try {
      await api.cancelarApolice(cancelar.id, motivo);
      setCancelar(null);
      await carregar();
    } catch (err) {
      setFormErro(err.message || 'Erro ao cancelar.');
    } finally {
      setSalvando(false);
    }
  }

  async function renovar(a) {
    try {
      await api.renovarApolice(a.id, {});
      await carregar();
    } catch (err) {
      setError(err.message || 'Erro ao renovar.');
    }
  }

  if (loading) return <p className="py-12 text-center text-gray-500 dark:text-gray-400">Carregando...</p>;
  if (error) return <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;

  const c = dados.contadores;
  const apolices = dados.apolices || [];
  const m = metr ? metr.metricas : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Visualização da carteira"
          className="inline-flex gap-1 rounded-xl border border-gray-100 bg-gray-50 p-1 dark:border-white/10 dark:bg-white/5"
        >
          {[
            { key: 'clientes', label: 'Clientes' },
            { key: 'apolices', label: 'Apólices' },
          ].map((v) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={vista === v.key}
              onClick={() => setVista(v.key)}
              className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${
                vista === v.key
                  ? 'bg-white text-brand-blue shadow-sm dark:bg-white/10 dark:text-white'
                  : 'text-gray-500 hover:text-brand-navy dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => { setAvulso(AVULSO_VAZIO); setFormErro(''); setAvulsoAberto(true); }}
          className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-dark"
        >
          + Negócio avulso
        </button>
      </div>

      {vista === 'clientes' && <ListaClientesTab />}

      {vista === 'apolices' && (
        <>
      {/* Score + métricas */}
      {m && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <section className="rounded-xl bg-white p-5 shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
            <p className="text-sm text-gray-500 dark:text-gray-400">Score geral da carteira</p>
            <p className={`mt-1 font-heading text-4xl font-bold ${FAIXA_CLS[metr.faixa]}`}>
              {m.score_geral == null ? '—' : m.score_geral}
            </p>
            <p className="mt-1 text-xs text-gray-400">{metr.base.clientes_ativos} clientes · {metr.base.apolices_ativas} apólices ativas</p>
          </section>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-3 lg:grid-cols-4">
            {METRICAS.map((mt) => (
              <div key={mt.key} className="rounded-xl bg-white p-4 shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
                <p className="text-xs text-gray-500 dark:text-gray-400">{mt.label}</p>
                <p className="mt-1 font-heading text-lg font-bold text-brand-navy dark:text-white">
                  {m[mt.key] == null ? '—' : mt.fmt(m[mt.key])}
                </p>
                <p className="text-[11px] text-gray-400">meta {mt.meta}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline contadores */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {COLUNAS.map((col) => (
          <div key={col.key} className="rounded-xl bg-white p-4 text-center shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
            <p className={`font-heading text-2xl font-bold ${col.cls}`}>{c[col.key]}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{col.label}</p>
          </div>
        ))}
      </div>

      {/* Lista de apólices */}
      {apolices.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
          <p className="text-gray-600 dark:text-gray-300">Nenhuma apólice ainda.</p>
          <p className="mt-1 text-sm text-gray-400">Elas nascem das vendas do funil ou de um negócio avulso.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Saúde</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm dark:divide-white/5">
              {apolices.map((a) => {
                const s = situacao(a);
                return (
                  <tr key={a.id}>
                    <td className="px-4 py-3 font-medium text-brand-navy dark:text-white">{a.cliente ? a.cliente.nome : '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{a.produto ? a.produto.nome : '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatData(a.data_vencimento)}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span></td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatBRL(a.valor)}</td>
                    <td className="px-4 py-3 text-gray-400">{a.health_score == null ? '—' : a.health_score}</td>
                    <td className="px-4 py-3 text-right">
                      {a.status !== 'cancelada' && a.status !== 'renovada' && (
                        <>
                          <button type="button" onClick={() => renovar(a)} className="mr-3 text-sm font-medium text-brand-blue hover:text-brand-blue-dark">Renovar</button>
                          <button type="button" onClick={() => { setCancelar(a); setMotivo('preco'); setFormErro(''); }} className="text-sm font-medium text-gray-400 hover:text-red-600">Cancelar</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}

      {/* Modal negócio avulso */}
      <Modal
        open={avulsoAberto}
        onClose={() => setAvulsoAberto(false)}
        title="Cadastrar negócio avulso"
        footer={
          <>
            <button type="button" onClick={() => setAvulsoAberto(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-300">Cancelar</button>
            <button type="button" onClick={salvarAvulso} disabled={salvando} className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-dark disabled:opacity-60">
              {salvando ? 'Salvando...' : 'Cadastrar'}
            </button>
          </>
        }
      >
          <div className="space-y-4">
            <FormField label="Nome do cliente" name="nome" value={avulso.nome} onChange={onAvulsoChange} required />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Telefone" name="telefone" value={avulso.telefone} onChange={onAvulsoChange} />
              <FormField label="E-mail" name="email" type="email" value={avulso.email} onChange={onAvulsoChange} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Empresa" name="empresa" value={avulso.empresa} onChange={onAvulsoChange} />
              <FormField label="Data de nascimento" name="data_nascimento" type="date" value={avulso.data_nascimento} onChange={onAvulsoChange} />
            </div>
            {avulsoManual ? (
              <FormField
                label="Nome do plano / operadora"
                name="produto_nome"
                value={avulso.produto_nome}
                onChange={onAvulsoChange}
                placeholder="Ex.: Amil S450 (digite se o PDF não foi lido)"
              />
            ) : (
              <FormField label="Produto" name="produto_id" value={avulso.produto_id} onChange={onAvulsoChange} options={produtos.map((p) => ({ value: p.id, label: p.nome }))} required />
            )}
            {produtos.length > 0 && (
              <button
                type="button"
                onClick={() => setAvulsoManual((m) => !m)}
                className="text-xs font-semibold text-brand-blue hover:text-brand-blue-dark"
              >
                {avulsoManual ? 'Selecionar da lista de produtos' : 'Digitar nome manualmente'}
              </button>
            )}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Valor do negócio (R$)" name="valor" type="number" min={0.01} step="0.01" value={avulso.valor} onChange={onAvulsoChange} required />
              <FormField label="Forma de pagamento" name="forma_pagamento" value={avulso.forma_pagamento} onChange={onAvulsoChange} options={FORMAS_PAGAMENTO} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Data de início" name="data_inicio" type="date" value={avulso.data_inicio} onChange={onAvulsoChange} required />
              <FormField label="Vencimento (opcional)" name="data_vencimento" type="date" value={avulso.data_vencimento} onChange={onAvulsoChange} />
            </div>
            <p className="text-xs text-gray-400">Sem vencimento informado, o sistema usa a vigência do produto.</p>
            <FormField label="Observações" name="observacoes" type="textarea" value={avulso.observacoes} onChange={onAvulsoChange} />
            {formErro && <p className="text-sm text-red-600">{formErro}</p>}
          </div>
      </Modal>

      {/* Modal cancelar */}
      <Modal
        open={!!cancelar}
        onClose={() => setCancelar(null)}
        title="Cancelar apólice"
        footer={
          <>
            <button type="button" onClick={() => setCancelar(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-300">Voltar</button>
            <button type="button" onClick={confirmarCancelar} disabled={salvando} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
              {salvando ? 'Cancelando...' : 'Cancelar apólice'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">O motivo alimenta a análise de churn. Escolha um:</p>
          <FormField label="Motivo do cancelamento" name="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} options={MOTIVOS} required />
          {formErro && <p className="text-sm text-red-600">{formErro}</p>}
        </div>
      </Modal>
    </div>
  );
}

// =============================================================================
// Aba Clientes — lista de carteira_clientes (a promoção real de um lead que
// virou venda). É a prova visual de que "venda concluída" apareceu na carteira.
// =============================================================================
function ListaClientesTab() {
  const [clientes, setClientes] = useState(null);
  const [busca, setBusca] = useState('');
  const [error, setError] = useState('');

  async function carregar() {
    setError('');
    try {
      setClientes(await api.carteiraListarClientes());
    } catch (err) {
      setError(err.message || 'Erro ao carregar os clientes.');
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const filtrados = (clientes || []).filter((c) =>
    !busca.trim() || (c.nome || '').toLowerCase().includes(busca.trim().toLowerCase())
  );

  if (error) return <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (clientes === null) return <p className="py-12 text-center text-gray-500 dark:text-gray-400">Carregando...</p>;

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar cliente por nome..."
        aria-label="Buscar cliente"
        className="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/40 dark:border-white/15 dark:bg-white/5 dark:text-white"
      />

      {filtrados.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
          <p className="text-gray-600 dark:text-gray-300">
            {clientes.length === 0 ? 'Nenhum cliente ainda.' : 'Nenhum cliente com esse nome.'}
          </p>
          {clientes.length === 0 && (
            <p className="mt-1 text-sm text-gray-400">
              Assim que uma venda for concluída no funil (ou um negócio avulso for cadastrado), o cliente aparece aqui.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Apólices ativas</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm dark:divide-white/5">
              {filtrados.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-brand-navy dark:text-white">{c.nome}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{c.telefone || c.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{c.produto_principal || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.apolices_ativas}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.apolices_ativas > 0
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {c.apolices_ativas > 0 ? 'Ativo' : 'Sem apólice ativa'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
