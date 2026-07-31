import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, FilePlus2, UserPlus, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import Modal from './Modal';

// Ponto de entrada do "+ Novo cliente": três caminhos — subir PDF de cotação,
// subir PDF de proposta, ou cadastrar na mão. Não existe extração automática
// por IA ainda (sem integração com a Claude API no backend) — o upload só
// guarda o PDF com segurança; o corretor completa os dados manualmente por
// enquanto. Ver arquivosService.js pro porquê.
export default function CadastroClienteModal({ open, onClose, onUploaded }) {
  const navigate = useNavigate();
  const [enviando, setEnviando] = useState(null); // 'cotacao' | 'proposta' | null
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(null); // { tipo, nome }
  const inputCotacaoRef = useRef(null);
  const inputPropostaRef = useRef(null);

  function fechar() {
    setErro('');
    setSucesso(null);
    setEnviando(null);
    onClose();
  }

  function irParaManual() {
    fechar();
    navigate('/clientes/novo');
  }

  async function onArquivoSelecionado(tipo, e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // permite selecionar o mesmo arquivo de novo depois
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setErro('Só é aceito arquivo PDF.');
      return;
    }
    setErro('');
    setEnviando(tipo);
    try {
      await api.uploadArquivo(tipo, file);
      setSucesso({ tipo, nome: file.name });
      if (onUploaded) onUploaded();
    } catch (err) {
      setErro(err.message || 'Erro ao enviar o PDF.');
    } finally {
      setEnviando(null);
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
                PDF recebido — "{sucesso.nome}"
              </p>
              <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
                Guardamos o arquivo com segurança. A extração automática por IA ainda não está disponível
                nesta versão — complete o cadastro do cliente manualmente por enquanto.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setSucesso(null)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-300"
            >
              Subir outro PDF
            </button>
            <button
              type="button"
              onClick={irParaManual}
              className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-dark"
            >
              Completar cadastro agora
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Suba o PDF que você já tem em mãos, ou cadastre o cliente na mão.
          </p>

          <OpcaoCadastro
            icon={FileText}
            titulo="Subir PDF Cotação"
            descricao="Cotação recebida da operadora — guardamos o arquivo no cadastro do cliente."
            carregando={enviando === 'cotacao'}
            onClick={() => inputCotacaoRef.current?.click()}
          />
          <input
            ref={inputCotacaoRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => onArquivoSelecionado('cotacao', e)}
          />

          <OpcaoCadastro
            icon={FilePlus2}
            titulo="Subir PDF Proposta"
            descricao="Proposta já fechada com o cliente."
            carregando={enviando === 'proposta'}
            onClick={() => inputPropostaRef.current?.click()}
          />
          <input
            ref={inputPropostaRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => onArquivoSelecionado('proposta', e)}
          />

          <OpcaoCadastro
            icon={UserPlus}
            titulo="Cadastrar Manualmente"
            descricao="Preencher os dados do cliente direto no formulário."
            onClick={irParaManual}
          />

          {erro && <p className="text-sm text-red-600">{erro}</p>}
        </div>
      )}
    </Modal>
  );
}

function OpcaoCadastro({ icon: Icon, titulo, descricao, onClick, carregando }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={carregando}
      className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 text-left transition-colors hover:border-brand-blue/40 hover:bg-brand-blue/5 disabled:cursor-wait disabled:opacity-70 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue">
        {carregando ? <Loader2 size={18} className="animate-spin" /> : <Icon size={18} />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-brand-navy dark:text-white">{titulo}</span>
        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
          {carregando ? 'Enviando...' : descricao}
        </span>
      </span>
    </button>
  );
}
