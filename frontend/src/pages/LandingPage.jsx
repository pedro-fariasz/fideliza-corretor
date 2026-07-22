import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowRight,
  Kanban,
  FileText,
  Percent,
  LineChart,
  CalendarClock,
  Bell,
  Layers,
  History,
  Check,
  UserPlus,
  MoveRight,
  BadgeCheck,
  ShieldCheck,
  Lock,
  Building2,
  Mail,
  MessageCircle,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { homePathFor } from '../utils/homePath';
import { useInView } from '../hooks/useScrollReveal';
import LandingNavbar from '../components/landing/LandingNavbar';
import LoginModal from '../components/landing/LoginModal';
import Reveal from '../components/landing/Reveal';
import Logo from '../components/Logo';
import {
  HeroDashboardMockup,
  LeadTimelineMockup,
  InteractionLogMockup,
} from '../components/landing/Mockups';

const SECTION = 'mx-auto w-full max-w-[1200px] px-6';

export default function LandingPage() {
  const { loading, session, profile } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  // Corretor/equipe já autenticado não vê a landing — vai direto pra sua home.
  if (!loading && session && profile) {
    return <Navigate to={homePathFor(profile)} replace />;
  }

  return (
    <div id="topo" className="min-h-screen bg-white font-sans text-brand-navy">
      <LandingNavbar onEntrar={() => setLoginOpen(true)} />
      <main>
        <Hero onEntrar={() => setLoginOpen(true)} />
        <Features />
        <ContextSection />
        <Steps />
        <TimelineSection />
        <Security />
        <Pricing />
        <FinalCta />
      </main>
      <Footer />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}

/* ── Hero ──────────────────────────────────────────────────────────────────── */
function Hero({ onEntrar }) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const prefersReduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return undefined;
    const onScroll = () => setOffset(Math.min(window.scrollY, 400));
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section className="relative overflow-hidden pt-28 pb-20 sm:pt-36 lg:pb-28">
      {/* fundo decorativo */}
      <div
        className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand-blue/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-40 top-40 h-[420px] w-[420px] rounded-full bg-brand-amber/10 blur-3xl"
        aria-hidden="true"
      />

      <div className={`${SECTION} grid items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]`}>
        <div>
          <Reveal
            as="span"
            className="inline-flex items-center gap-2 rounded-full border border-brand-blue/20 bg-brand-blue/5 px-3.5 py-1.5 text-xs font-semibold text-brand-blue"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-brand-blue" />
            CRM para corretores autônomos
          </Reveal>

          <Reveal
            as="h1"
            delay={80}
            className="mt-5 font-heading text-4xl font-extrabold leading-[1.08] tracking-tight text-brand-navy sm:text-5xl lg:text-6xl"
          >
            Do primeiro lead à{' '}
            <span className="relative whitespace-nowrap text-brand-blue">
              comissão paga
              <span
                className="absolute inset-x-0 -bottom-1 h-2.5 rounded-full bg-brand-blue/15"
                aria-hidden="true"
              />
            </span>
            , sem planilha.
          </Reveal>

          <Reveal as="p" delay={160} className="mt-6 max-w-xl text-lg leading-relaxed text-gray-600">
            O Fideliza organiza seus leads, movimenta o funil, calcula suas comissões parceladas e
            ainda cuida do pós-venda no automático. Tudo em um lugar, feito para o corretor
            brasileiro.
          </Reveal>

          <Reveal delay={240} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/cadastro"
              className="cta-shine inline-flex items-center justify-center gap-2 rounded-xl bg-brand-blue px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-blue/25 transition-all hover:bg-brand-blue-dark hover:shadow-xl hover:shadow-brand-blue/30"
            >
              Começar grátis
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <a
              href="#funcionalidades"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-6 py-3.5 text-sm font-semibold text-brand-navy transition-all hover:border-brand-blue hover:text-brand-blue"
            >
              Conhecer recursos
            </a>
          </Reveal>

          <Reveal delay={320} className="mt-8 flex items-center gap-6 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <Check size={16} className="text-emerald-500" /> 14 dias grátis
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={16} className="text-emerald-500" /> Sem cartão
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={16} className="text-emerald-500" /> Cadastro na hora
            </span>
          </Reveal>
        </div>

        <Reveal delay={200} className="relative flex justify-center lg:justify-end">
          <div style={{ transform: `translateY(-${offset * 0.06}px)` }} className="relative">
            <HeroDashboardMockup />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Funcionalidades ───────────────────────────────────────────────────────── */
const FEATURES = [
  { icon: Kanban, color: 'text-brand-blue bg-brand-blue/10', title: 'Funil Kanban', desc: 'Seis estágios com arrastar e soltar. Veja onde cada negócio está em segundos.' },
  { icon: FileText, color: 'text-emerald-600 bg-emerald-50', title: 'Cadastro por PDF', desc: 'A IA lê a proposta, extrai os dados do cliente e você só confirma. Zero digitação.' },
  { icon: Percent, color: 'text-brand-blue bg-brand-blue/10', title: 'Comissão parcelada', desc: 'Fixa, parcelada ou recorrente, com início de pagamento configurável. Do jeito BR.' },
  { icon: LineChart, color: 'text-brand-amber bg-amber-50', title: 'Dashboard de KPIs', desc: 'Comissão a receber, conversão e volume do funil em um painel só.' },
  { icon: CalendarClock, color: 'text-brand-blue bg-brand-blue/10', title: 'Agenda integrada', desc: 'Compromissos e follow-ups nascem do funil e caem direto na sua agenda.' },
  { icon: Bell, color: 'text-emerald-600 bg-emerald-50', title: 'Pós-venda no automático', desc: 'Alertas de renovação, aniversário e reajuste disparados sem você lembrar.' },
  { icon: Layers, color: 'text-brand-blue bg-brand-blue/10', title: 'Multi-vertical', desc: 'Consórcio, seguro, plano de saúde ou imóveis. Adapta ao seu mercado.' },
  { icon: History, color: 'text-brand-amber bg-amber-50', title: 'Timeline do lead', desc: 'Toda ligação, mensagem e movimento registrado. Nada se perde.' },
];

function Features() {
  return (
    <section id="funcionalidades" className="bg-[#F4F6F8] py-20 lg:py-28">
      <div className={SECTION}>
        <SectionHeading
          eyebrow="Funcionalidades"
          title="Tudo que um corretor precisa"
          subtitle="Da captação do lead ao acompanhamento da comissão, sem trocar de ferramenta."
        />

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <Reveal
                key={feature.title}
                delay={(i % 4) * 90}
                className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-blue/30 hover:shadow-xl hover:shadow-brand-navy/5"
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${feature.color} transition-transform duration-300 group-hover:scale-110`}
                >
                  <Icon size={22} />
                </span>
                <h3 className="mt-5 font-heading text-base font-semibold text-brand-navy">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{feature.desc}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Cada lead com histórico e próximo passo ───────────────────────────────── */
const CONTEXT_POINTS = [
  { title: 'Histórico completo', desc: 'Cada interação com o lead fica registrada em ordem, com data e responsável.' },
  { title: 'Próximo passo claro', desc: 'O sistema mostra o que fazer a seguir para não deixar negócio esfriar.' },
  { title: 'Dono definido', desc: 'Todo lead tem um responsável — nada fica sem acompanhamento.' },
  { title: 'Origem rastreada', desc: 'Saiba de onde veio cada oportunidade e o que converte melhor.' },
];

function ContextSection() {
  return (
    <section className="py-20 lg:py-28">
      <div className={`${SECTION} grid items-center gap-14 lg:grid-cols-2`}>
        <Reveal>
          <SectionHeading
            align="left"
            eyebrow="Contexto"
            title="Cada lead com histórico e próximo passo"
            subtitle="Você abre o lead e entende na hora onde parou — sem depender da memória."
          />
          <ul className="mt-8 space-y-4">
            {CONTEXT_POINTS.map((point, i) => (
              <Reveal as="li" key={point.title} delay={i * 80} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Check size={14} strokeWidth={3} />
                </span>
                <div>
                  <p className="font-semibold text-brand-navy">{point.title}</p>
                  <p className="text-sm text-gray-500">{point.desc}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={120} className="flex justify-center lg:justify-end">
          <LeadTimelineMockup />
        </Reveal>
      </div>
    </section>
  );
}

/* ── Como funciona (3 passos) ──────────────────────────────────────────────── */
const STEPS = [
  { icon: UserPlus, n: '01', title: 'Capture o lead', desc: 'Cadastre manualmente ou jogue o PDF da proposta — a IA preenche os dados por você.' },
  { icon: MoveRight, n: '02', title: 'Avance no funil', desc: 'Arraste o card pelos estágios. Cada movimento vira histórico e dispara o follow-up.' },
  { icon: BadgeCheck, n: '03', title: 'Feche e acompanhe', desc: 'A venda nasce do funil e o Fideliza calcula suas comissões parcela a parcela.' },
];

function Steps() {
  return (
    <section id="como-funciona" className="bg-[#F4F6F8] py-20 lg:py-28">
      <div className={SECTION}>
        <SectionHeading
          eyebrow="Como funciona"
          title="Do primeiro contato à comissão"
          subtitle="Três passos simples que substituem a planilha e o caderno."
        />

        <div className="relative mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <Reveal
                key={step.n}
                delay={i * 120}
                className="relative rounded-2xl border border-gray-100 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-navy/5"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-blue text-white">
                    <Icon size={22} />
                  </span>
                  <span className="font-heading text-4xl font-extrabold text-gray-100">
                    {step.n}
                  </span>
                </div>
                <h3 className="mt-5 font-heading text-lg font-semibold text-brand-navy">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{step.desc}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Rastreabilidade ───────────────────────────────────────────────────────── */
const TRACE_POINTS = [
  'Toda venda, movimento de funil e mensagem fica registrado.',
  'Saiba quem fez o quê e quando — você ou o sistema.',
  'Importações por PDF entram no histórico automaticamente.',
  'Nada de "esqueci de anotar": o registro é feito por você.',
];

function TimelineSection() {
  return (
    <section className="py-20 lg:py-28">
      <div className={`${SECTION} grid items-center gap-14 lg:grid-cols-2`}>
        <Reveal className="order-2 flex justify-center lg:order-1 lg:justify-start">
          <InteractionLogMockup />
        </Reveal>

        <Reveal delay={120} className="order-1 lg:order-2">
          <SectionHeading
            align="left"
            eyebrow="Rastreabilidade"
            title="Cada ação da sua carteira, registrada"
            subtitle="Um histórico confiável do que aconteceu com cada cliente e cada negócio."
          />
          <ul className="mt-8 space-y-3.5">
            {TRACE_POINTS.map((point, i) => (
              <Reveal as="li" key={i} delay={i * 80} className="flex items-start gap-3 text-gray-600">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue" />
                <span className="text-sm leading-relaxed">{point}</span>
              </Reveal>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Segurança ─────────────────────────────────────────────────────────────── */
const SECURITY_POINTS = [
  { icon: Lock, title: 'Isolamento por conta', desc: 'Sua carteira é sua. Cada corretor enxerga apenas os próprios dados.' },
  { icon: ShieldCheck, title: 'Dados em conformidade', desc: 'Tratamento de dados alinhado à LGPD, com acesso controlado.' },
  { icon: History, title: 'Trilha de acesso', desc: 'Cada ação registrada, para você ter rastreabilidade do que aconteceu.' },
];

function Security() {
  return (
    <section className="bg-[#F4F6F8] py-20 lg:py-28">
      <div className={`${SECTION} grid items-center gap-14 lg:grid-cols-2`}>
        <Reveal>
          <SectionHeading
            align="left"
            eyebrow="Segurança"
            title="Seus dados e os dos seus clientes, protegidos"
            subtitle="Corretor lida com informação sensível. Aqui ela fica isolada, controlada e sob a LGPD."
          />
          <div className="mt-8 space-y-5">
            {SECURITY_POINTS.map((point, i) => {
              const Icon = point.icon;
              return (
                <Reveal as="div" key={point.title} delay={i * 80} className="flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue">
                    <Icon size={20} />
                  </span>
                  <div>
                    <p className="font-semibold text-brand-navy">{point.title}</p>
                    <p className="text-sm text-gray-500">{point.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
          <Reveal delay={240} className="mt-8">
            <Link
              to="/cadastro"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-navy/90"
            >
              Conhecer mais
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </Reveal>
        </Reveal>

        <Reveal delay={120} className="flex justify-center lg:justify-end">
          <SecurityMockup />
        </Reveal>
      </div>
    </section>
  );
}

function SecurityMockup() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-xl shadow-brand-navy/5">
      <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <ShieldCheck size={20} />
        </span>
        <div>
          <p className="font-heading text-sm font-semibold text-brand-navy">Conta protegida</p>
          <p className="text-xs text-gray-400">Acesso restrito ao titular</p>
        </div>
        <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-600">
          <Check size={12} strokeWidth={3} /> Ativa
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {[
          { label: 'Isolamento de dados', value: 'Por conta' },
          { label: 'Conformidade', value: 'LGPD' },
          { label: 'Sessão', value: 'Criptografada' },
          { label: 'Trilha de acesso', value: 'Registrada' },
        ].map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-xl bg-[#F4F6F8] px-3.5 py-2.5"
          >
            <span className="flex items-center gap-2 text-sm text-gray-500">
              <Lock size={13} className="text-brand-blue" />
              {row.label}
            </span>
            <span className="text-sm font-semibold text-brand-navy">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Preços ────────────────────────────────────────────────────────────────── */
const PLAN_FEATURES = [
  'Leads e funil Kanban ilimitados',
  'Cadastro por PDF com IA',
  'Cálculo de comissão parcelada',
  'Dashboard e agenda',
  'Pós-venda no automático',
];

function Pricing() {
  return (
    <section id="precos" className="py-20 lg:py-28">
      <div className={SECTION}>
        <SectionHeading
          eyebrow="Preços"
          title="Comece grátis, sem cartão"
          subtitle="Teste tudo por 14 dias. Se fizer sentido, continue por um preço justo para autônomo."
        />

        <Reveal className="mx-auto mt-12 max-w-md">
          <div className="overflow-hidden rounded-3xl border border-brand-blue/20 bg-white shadow-xl shadow-brand-navy/5">
            <div className="bg-brand-blue px-8 py-6 text-white">
              <p className="text-sm font-medium text-white/80">Plano Corretor</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="font-heading text-4xl font-extrabold">14 dias</span>
                <span className="mb-1 text-sm text-white/80">grátis</span>
              </div>
              <p className="mt-1 text-sm text-white/80">Acesso completo, sem compromisso.</p>
            </div>
            <div className="px-8 py-7">
              <ul className="space-y-3">
                {PLAN_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm text-gray-600">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                to="/cadastro"
                className="cta-shine mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-blue px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-blue/25 transition-all hover:bg-brand-blue-dark"
              >
                Criar conta grátis
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── CTA final ─────────────────────────────────────────────────────────────── */
function FinalCta() {
  return (
    <section className="pb-20 lg:pb-28">
      <div className={SECTION}>
        <Reveal className="relative overflow-hidden rounded-3xl bg-brand-navy px-8 py-16 text-center sm:px-16">
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-blue/30 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-brand-blue/20 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl font-heading text-3xl font-extrabold text-white sm:text-4xl">
              Assuma o controle da sua carteira hoje
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/70">
              Junte-se aos corretores que trocaram a planilha pelo Fideliza. Comece em minutos.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/cadastro"
                className="cta-shine inline-flex items-center justify-center gap-2 rounded-xl bg-brand-blue px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-blue/30 transition-all hover:bg-brand-blue-dark"
              >
                Começar grátis
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <a
                href="#funcionalidades"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Rever recursos
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Footer ────────────────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer id="suporte" className="border-t border-gray-100 bg-white">
      <div className={`${SECTION} grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4`}>
        <div className="lg:col-span-1">
          <Logo variant="colorida" size={40} />
          <p className="mt-4 max-w-xs text-sm text-gray-500">
            O CRM do corretor autônomo brasileiro. Leads, funil e comissões em um só lugar.
          </p>
        </div>

        <FooterCol
          title="Produto"
          links={[
            { label: 'Funcionalidades', href: '#funcionalidades' },
            { label: 'Como funciona', href: '#como-funciona' },
            { label: 'Preços', href: '#precos' },
          ]}
        />

        <FooterCol
          title="Conta"
          links={[
            { label: 'Criar conta', to: '/cadastro' },
            { label: 'Entrar', to: '/login' },
            { label: 'Acesso da equipe', to: '/equipe/login' },
          ]}
        />

        <div>
          <p className="font-heading text-sm font-semibold text-brand-navy">Suporte</p>
          <ul className="mt-4 space-y-3 text-sm text-gray-500">
            <li>
              <a
                href="mailto:suporte@fideliza.com.br"
                className="flex items-center gap-2 transition-colors hover:text-brand-blue"
              >
                <Mail size={15} /> suporte@fideliza.com.br
              </a>
            </li>
            <li className="flex items-center gap-2">
              <MessageCircle size={15} /> Atendimento em dias úteis
            </li>
            <li className="flex items-center gap-2">
              <Building2 size={15} /> Fideliza Corretor
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-gray-100">
        <div className={`${SECTION} flex flex-col items-center justify-between gap-2 py-6 text-xs text-gray-400 sm:flex-row`}>
          <p>© {new Date().getFullYear()} Fideliza Corretor. Todos os direitos reservados.</p>
          <p>Feito para o corretor brasileiro.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }) {
  return (
    <div>
      <p className="font-heading text-sm font-semibold text-brand-navy">{title}</p>
      <ul className="mt-4 space-y-3 text-sm text-gray-500">
        {links.map((link) => (
          <li key={link.label}>
            {link.to ? (
              <Link to={link.to} className="transition-colors hover:text-brand-blue">
                {link.label}
              </Link>
            ) : (
              <a href={link.href} className="transition-colors hover:text-brand-blue">
                {link.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Título de seção reutilizável ──────────────────────────────────────────── */
function SectionHeading({ eyebrow, title, subtitle, align = 'center' }) {
  const isCenter = align === 'center';
  // useInView garante o reveal mesmo quando o heading é usado dentro de outro Reveal.
  const [ref, inView] = useInView();
  return (
    <div
      ref={ref}
      className={`reveal ${inView ? 'is-visible' : ''} ${
        isCenter ? 'mx-auto max-w-2xl text-center' : 'max-w-xl text-left'
      }`}
    >
      {eyebrow && (
        <span className="text-xs font-bold uppercase tracking-[0.15em] text-brand-blue">
          {eyebrow}
        </span>
      )}
      <h2 className="mt-3 font-heading text-3xl font-extrabold tracking-tight text-brand-navy sm:text-4xl">
        {title}
      </h2>
      {subtitle && <p className="mt-4 text-lg leading-relaxed text-gray-500">{subtitle}</p>}
    </div>
  );
}
