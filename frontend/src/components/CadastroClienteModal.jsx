import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, FilePlus2, UserPlus, CheckCircle2, X, Loader2, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import Modal from './Modal';

// Ponto de entrada do "+ Novo cliente": DOIS caminhos, não três — cotação e
// proposta são as duas metades do MESMO fluxo (cadastro via PDF, se
// complementam) e sobem juntas num só envio; cadastro manual é o caminho
// separado. Não existe extração automática por IA ainda (sem integração com
// a Claude API no backend) — o upload só guarda os PDFs com segurança, o
// corretor completa os dados manualmente por enquanto. Ver arquivosService.js.
export default function CadastroClienteModal({ open, onClose, onUploaded }) {
  const navigate = useNavigate();
  const [cotacao, setCotacao] = useState(null);
  const [proposta, setProposta] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(null); // { nomes: string[] }
  const inputCotacaoRef = useRef(null);
  const inputPropostaRef = useRef(null);

  function reset() {
    setCotacao(null);
    setProposta(null);
    setErro('');
    setSucesso(null);
    setEnviando(false);
  }

  function fechar() {
    reset();
    onClose();
  }

  function irParaManual() {
    fechar();
    navigate('/clientes/novo');
  }

  function selecionar(setter, e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // permite selecionar o mesmo arquivo de novo depois
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setErro('Só é aceito arquivo PDF.');
      return;
    }
    setErro('');
    setter(file);
  }

  async function enviarPdfs() {
    if (!cotacao && !proposta) {
      setErro('Selecione ao menos um PDF (cotação ou proposta).');
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      const nomes = [];
      // Sequencial de propósito: se um dos dois falhar, o outro já foi salvo
      // (não quer desfazer o que deu certo) e o erro aparece pro que faltou.
      if (cotacao) {
        await api.uploadArquivo('cotacao', cotacao);
        nomes.push(cotacao.name);
      }
      if (proposta) {
        await api.uploadArquivo('proposta', proposta);
        nomes.push(proposta.name);
      }
      setSucesso({ nomes });
      if (onUploaded) onUploaded();
    } catch (err) {
      setErro(err.message || 'Erro ao enviar os PDFs.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal open={open} onClose={fechar} title="Cadastrar cliente">
      {sucesso ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                {sucesso.nomes.length > 1 ? 'PDFs recebidos' : 'PDF recebido'} — {sucesso.nomes.join(', ')}
              </p>
              <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
                Guardamos os arquivos com segurança. A extração automática por IA ainda não está
                disponível nesta versão — complete o cadastro do cliente manualmente por enquanto.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={reset}
              className="press rounded-lg px-4 py-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
            >
              Subir outro PDF
            </button>
            <button
              type="button"
              onClick={irParaManual}
              className="press rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-dark"
            >
              Completar cadastro agora
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Caminho 1: cadastro via PDF — cotação + proposta se complementam,
              sobem juntas num único envio. */}
          <div className="rounded-xl border border-gray-100 p-4 dark:border-white/10">
            <p className="text-sm font-semibold text-brand-navy dark:text-white">Cadastro via PDF</p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Cotação e proposta se complementam no cadastro — suba as duas se tiver, ou só a que tiver em
              mãos.
            </p>

            <div className="mt-3 space-y-2">
              <SeletorPdf
                icon={FileText}
                label="PDF Cotação"
                arquivo={cotacao}
                onEscolher={() => inputCotacaoRef.current?.click()}
                onRemover={() => setCotacao(null)}
              />
              <input
                ref={inputCotacaoRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => selecionar(setCotacao, e)}
              />

              <SeletorPdf
                icon={FilePlus2}
                label="PDF Proposta"
                arquivo={proposta}
                onEscolher={() => inputPropostaRef.current?.click()}
                onRemover={() => setProposta(null)}
              />
              <input
                ref={inputPropostaRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => selecionar(setProposta, e)}
              />
            </div>

            <button
              type="button"
              onClick={enviarPdfs}
              disabled={enviando || (!cotacao && !proposta)}
              className="press mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Enviando...
                </>
              ) : (
                <>Enviar PDF{cotacao && proposta ? 's' : ''}</>
              )}
            </button>

            {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="h-px flex-1 bg-gray-100 dark:bg-white/10" />
            ou
            <span className="h-px flex-1 bg-gray-100 dark:bg-white/10" />
          </div>

          {/* Caminho 2: cadastro manual — separado de verdade. */}
          <button
            type="button"
            onClick={irParaManual}
            className="press flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 text-left transition-colors hover:border-brand-blue/40 hover:bg-brand-blue/5 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue">
              <UserPlus size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-brand-navy dark:text-white">
                Cadastrar Manualmente
              </span>
              <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                Preencher os dados do cliente direto no formulário.
              </span>
            </span>
            <ArrowRight size={16} className="shrink-0 text-gray-300" />
          </button>
        </div>
      )}
    </Modal>
  );
}

function SeletorPdf({ icon: Icon, label, arquivo, onEscolher, onRemover }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 dark:border-white/10">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue">
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="truncate text-sm text-brand-navy dark:text-white">
          {arquivo ? arquivo.name : 'Nenhum arquivo selecionado'}
        </p>
      </div>
      {arquivo ? (
        <button
          type="button"
          onClick={onRemover}
          aria-label={`Remover ${label}`}
          className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10"
        >
          <X size={15} />
        </button>
      ) : (
        <button
          type="button"
          onClick={onEscolher}
          className="shrink-0 whitespace-nowrap text-sm font-semibold text-brand-blue hover:text-brand-blue-dark"
        >
          Escolher
        </button>
      )}
    </div>
  );
}
