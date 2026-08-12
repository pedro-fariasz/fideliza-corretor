import { Link } from 'react-router-dom';
import { ArrowRight, Smartphone } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const CARD = 'rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-white/5';

// Aba WhatsApp do hub de Clientes — placeholder do painel de mensagens
// (evita link "morto" vindo de Leads/Inteligência enquanto a integração
// oficial Meta Cloud API não existe — ver CLAUDE.md).
export default function WhatsAppPlaceholderPage() {
  const { tenant } = useAuth();
  const conectado = Boolean(tenant && tenant.whatsapp_conectado);

  return (
    <div className={`${CARD} p-8 text-center`}>
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue">
        <Smartphone size={26} />
      </span>
      <h2 className="mt-4 font-heading text-lg font-semibold text-brand-navy dark:text-white">
        Painel de mensagens
      </h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-gray-500 dark:text-gray-400">
        {conectado
          ? 'WhatsApp conectado. O painel de conversas chega em uma próxima versão — por enquanto, use o botão de WhatsApp em cada lead.'
          : 'Conecte o WhatsApp da corretora em Configurações para começar a enviar mensagens direto do funil.'}
      </p>
      <Link
        to="/configuracoes"
        className="press mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-blue px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-blue/25 transition-all hover:bg-brand-blue-dark"
      >
        Ir para Configurações <ArrowRight size={16} />
      </Link>
    </div>
  );
}
