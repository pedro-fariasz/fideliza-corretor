import {
  MessageCircle,
  Phone,
  FileText,
  CheckCircle2,
  Circle,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { useCountUp } from '../../hooks/useScrollReveal';

// Mockups estáticos (HTML/CSS) que simulam telas do produto. Sem dados reais —
// só ilustração da landing.

// Anel de progresso com o score da carteira contando de 0 a 84%.
function ScoreRing() {
  const [ref, value] = useCountUp(84, { duration: 1800 });
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div ref={ref} className="flex items-center gap-3">
      <div className="relative h-[84px] w-[84px]">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 84 84">
          <circle cx="42" cy="42" r={radius} fill="none" stroke="#E5E9F0" strokeWidth="8" />
          <circle
            cx="42"
            cy="42"
            r={radius}
            fill="none"
            stroke="#1e5eff"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-heading text-lg font-bold text-brand-navy">
          {Math.round(value)}%
        </span>
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
          Score da carteira
        </p>
        <p className="text-sm font-semibold text-brand-navy">Relacionamento em dia</p>
      </div>
    </div>
  );
}

// KPI de comissão a receber, com número animado.
function CommissionKpi() {
  const [ref, value] = useCountUp(12480, { duration: 1900 });
  return (
    <div ref={ref} className="rounded-xl border border-gray-100 bg-white p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
        <DollarSign size={13} className="text-brand-blue" />
        Comissão a receber
      </div>
      <p className="mt-1 font-heading text-xl font-bold text-brand-navy">
        R$ {Math.round(value).toLocaleString('pt-BR')}
      </p>
      <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-emerald-600">
        <TrendingUp size={12} /> +18% no mês
      </p>
    </div>
  );
}

const FUNNEL = [
  { label: 'Novos leads', value: 12, w: 'w-full' },
  { label: 'Em contato', value: 8, w: 'w-4/5' },
  { label: 'Proposta', value: 5, w: 'w-3/5' },
  { label: 'Fechados', value: 3, w: 'w-2/5' },
];

// Card principal do hero: dashboard resumido.
export function HeroDashboardMockup() {
  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xl shadow-brand-navy/5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
              Seu painel
            </p>
            <p className="font-heading text-sm font-semibold text-brand-navy">Carteira · Julho</p>
          </div>
          <span className="rounded-full bg-brand-blue/10 px-2.5 py-1 text-[11px] font-semibold text-brand-blue">
            14 dias grátis
          </span>
        </div>

        <ScoreRing />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <CommissionKpi />
          <div className="rounded-xl border border-gray-100 bg-white p-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Funil</p>
            <div className="mt-2 space-y-1.5">
              {FUNNEL.map((stage) => (
                <div key={stage.label}>
                  <div className="flex items-center justify-between text-[10px] text-gray-500">
                    <span>{stage.label}</span>
                    <span className="font-semibold text-brand-navy">{stage.value}</span>
                  </div>
                  <div className="mt-0.5 h-1.5 w-full rounded-full bg-gray-100">
                    <div className={`h-1.5 ${stage.w} rounded-full bg-brand-blue/70`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Balão de mensagem — pós-venda no automático */}
      <div className="animate-float absolute -bottom-6 -left-4 w-60 rounded-2xl border border-gray-100 bg-white p-3.5 shadow-lg sm:-left-8">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white">
            <MessageCircle size={15} />
          </span>
          <p className="text-[11px] font-semibold text-gray-500">Mensagem enviada · WhatsApp</p>
        </div>
        <p className="mt-2 rounded-xl rounded-tl-sm bg-brand-blue px-3 py-2 text-xs leading-snug text-white">
          Oi, Ana! Vi que sua renovação está chegando. Posso te mandar as condições deste ano?
        </p>
      </div>
    </div>
  );
}

// Timeline de um lead (seção "Cada lead com histórico e próximo passo").
export function LeadTimelineMockup() {
  const items = [
    { icon: Phone, color: 'text-brand-blue bg-brand-blue/10', title: 'Ligação de qualificação', time: 'Há 2 dias', done: true },
    { icon: FileText, color: 'text-brand-blue bg-brand-blue/10', title: 'Proposta enviada (PDF)', time: 'Ontem', done: true },
    { icon: MessageCircle, color: 'text-emerald-600 bg-emerald-50', title: 'WhatsApp respondido', time: 'Há 3 h', done: true },
    { icon: Circle, color: 'text-brand-amber bg-amber-50', title: 'Próximo passo: agendar fechamento', time: 'Hoje', done: false },
  ];

  return (
    <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-5 shadow-xl shadow-brand-navy/5">
      <div className="mb-4 flex items-center gap-3 border-b border-gray-100 pb-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-blue font-heading text-sm font-bold text-white">
          AS
        </span>
        <div>
          <p className="font-heading text-sm font-semibold text-brand-navy">Ana Souza</p>
          <p className="text-xs text-gray-400">Seguro auto · Estágio: Proposta</p>
        </div>
        <span className="ml-auto rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-600">
          Quente
        </span>
      </div>

      <div className="space-y-3">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="flex items-start gap-3">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${item.color}`}>
                <Icon size={15} />
              </span>
              <div className="flex-1">
                <p className={`text-sm ${item.done ? 'text-brand-navy' : 'font-semibold text-brand-navy'}`}>
                  {item.title}
                </p>
                <p className="text-[11px] text-gray-400">{item.time}</p>
              </div>
              {item.done && <CheckCircle2 size={16} className="mt-1 text-emerald-500" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Log de interações (seção "Cada interação registrada").
export function InteractionLogMockup() {
  const rows = [
    { time: '14:32', who: 'Você', action: 'moveu Ana Souza para Proposta', tag: 'Funil' },
    { time: '11:05', who: 'Sistema', action: 'registrou proposta importada por PDF', tag: 'IA' },
    { time: '09:47', who: 'Você', action: 'criou o lead João Lima', tag: 'Lead' },
    { time: 'Ontem', who: 'Sistema', action: 'enviou alerta de renovação', tag: 'Pós-venda' },
    { time: 'Ontem', who: 'Você', action: 'registrou venda de R$ 2.400', tag: 'Venda' },
  ];

  return (
    <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-5 shadow-xl shadow-brand-navy/5">
      <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-3">
        <p className="font-heading text-sm font-semibold text-brand-navy">Histórico de atividade</p>
        <span className="text-[11px] text-gray-400">Tudo registrado</span>
      </div>
      <div className="space-y-2.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-3 text-xs">
            <span className="w-12 shrink-0 font-mono text-[11px] text-gray-400">{row.time}</span>
            <p className="flex-1 text-gray-600">
              <span className="font-semibold text-brand-navy">{row.who}</span> {row.action}
            </p>
            <span className="shrink-0 rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
              {row.tag}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
