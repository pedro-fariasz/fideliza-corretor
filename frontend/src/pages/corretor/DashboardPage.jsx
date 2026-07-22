import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  CheckCircle2,
  TrendingUp,
  Wallet,
  ArrowRight,
  ArrowUpRight,
  DollarSign,
  UserPlus,
} from 'lucide-react';
import { api } from '../../services/api';
import { formatBRL, formatData } from '../../utils/format';
import { ESTAGIO_LABEL, FORMAS_PAGAMENTO, INTERESSES } from '../../utils/crmConstants';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';

const FORMA_LABEL = FORMAS_PAGAMENTO.reduce((acc, f) => ((acc[f.value] = f.label), acc), {});
const INTERESSE_LABEL = INTERESSES.reduce((acc, i) => ((acc[i.value] = i.label), acc), {});

// Cartão-base reutilizável (fundo, borda, sombra e dark mode num só lugar).
function Card({ className = '', style, children }) {
  return (
    <section
      style={style}
      className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5 ${className}`}
    >
      {children}
    </section>
  );
}

// Cabeçalho de card com título e link "ver todos".
function CardHead({ title, to, linkLabel }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-semibold text-brand-navy dark:text-white">{title}</h2>
      {to && (
        <Link
          to={to}
          className="group inline-flex items-center gap-1 text-sm font-semibold text-brand-blue transition-colors hover:text-brand-blue-dark"
        >
          {linkLabel}
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

const KPI_TONES = {
  blue: 'bg-brand-blue/10 text-brand-blue',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-50 text-brand-amber dark:bg-amber-500/15 dark:text-amber-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
};

function KpiCard({ icon: Icon, tone = 'blue', label, value, delay = 0, children }) {
  return (
    <Card
      className="animate-rise transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
      style={{ '--rise-delay': `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${KPI_TONES[tone]}`}>
          <Icon size={20} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 font-heading text-[1.7rem] font-bold leading-none tracking-tight text-brand-navy dark:text-white">
        {value}
      </p>
      {children && <div className="mt-3">{children}</div>}
    </Card>
  );
}

// Badge de tendência/conversão (informação derivada real, sem inventar série).
function Pill({ children, tone = 'emerald' }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
    gray: 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const d = await api.dashboard();
        if (vivo) setData(d);
      } catch (err) {
        if (vivo) setError(err.message || 'Erro ao carregar o dashboard.');
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error)
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
        {error}
      </div>
    );

  const k = data.kpis;
  const totalFunil = data.funil.reduce((acc, f) => acc + f.quantidade, 0);
  const maxFunil = data.funil.reduce((m, f) => Math.max(m, f.quantidade), 0);
  const pctRecebida =
    k.comissao_prevista > 0
      ? Math.min(100, Math.round((k.comissao_recebida / k.comissao_prevista) * 100))
      : 0;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Users} tone="blue" label="Leads novos" value={k.leads_novos} delay={0}>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {k.total_leads} ativos no total
          </p>
        </KpiCard>

        <KpiCard
          icon={CheckCircle2}
          tone="emerald"
          label="Vendas concluídas"
          value={k.vendas_concluidas.quantidade}
          delay={60}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {formatBRL(k.vendas_concluidas.valor_total)}
            </span>
            {k.taxa_conversao > 0 && (
              <Pill>
                <ArrowUpRight size={11} /> {k.taxa_conversao}% conversão
              </Pill>
            )}
          </div>
        </KpiCard>

        <KpiCard
          icon={TrendingUp}
          tone="amber"
          label="Comissão prevista"
          value={formatBRL(k.comissao_prevista)}
          delay={120}
        >
          <p className="text-xs text-gray-400 dark:text-gray-500">a receber no período</p>
        </KpiCard>

        <KpiCard
          icon={Wallet}
          tone="violet"
          label="Comissão recebida"
          value={formatBRL(k.comissao_recebida)}
          delay={180}
        >
          <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
            <span>{pctRecebida}% da prevista</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-brand-blue transition-[width] duration-700"
              style={{ width: `${pctRecebida}%` }}
            />
          </div>
        </KpiCard>
      </div>

      {/* Funil + atividade recente */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Funil de vendas — visualização gráfica */}
        <Card
          className="animate-rise lg:col-span-1"
          style={{ '--rise-delay': '220ms' }}
        >
          <CardHead title="Funil de vendas" to="/funil" linkLabel="Abrir funil" />
          {totalFunil === 0 ? (
            <EmptyState
              icon={Users}
              title="Funil vazio"
              description="Cadastre um lead para começar a acompanhar seu funil."
              cta={{ to: '/leads', label: 'Adicionar lead' }}
            />
          ) : (
            <div className="mt-5 space-y-2.5">
              {data.funil.map((f) => {
                const pctTotal = totalFunil ? Math.round((f.quantidade / totalFunil) * 100) : 0;
                const largura = maxFunil ? Math.max(8, Math.round((f.quantidade / maxFunil) * 100)) : 8;
                return (
                  <div key={f.estagio}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-brand-navy dark:text-white">
                        {ESTAGIO_LABEL[f.estagio]}
                      </span>
                      <span className="tabular-nums text-gray-400">
                        {f.quantidade}
                        <span className="ml-1 text-gray-300 dark:text-gray-500">· {pctTotal}%</span>
                      </span>
                    </div>
                    {/* Barra centralizada = silhueta de funil por volume */}
                    <div className="flex justify-center">
                      <div
                        className="h-7 rounded-lg bg-gradient-to-r from-brand-blue to-brand-blue-dark transition-all duration-500"
                        style={{ width: `${largura}%` }}
                        title={`${f.quantidade} lead(s)`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Vendas recentes */}
        <Card className="animate-rise" style={{ '--rise-delay': '280ms' }}>
          <CardHead title="Vendas recentes" to="/vendas" linkLabel="Ver todas" />
          {data.vendas_recentes.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="Nenhuma venda ainda"
              description="Feche um negócio no funil e ele aparece aqui."
              cta={{ to: '/funil', label: 'Ir para o funil' }}
            />
          ) : (
            <ul className="mt-4 divide-y divide-gray-100 dark:divide-white/5">
              {data.vendas_recentes.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                      <DollarSign size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-brand-navy dark:text-white">
                        {formatBRL(v.valor)}
                      </p>
                      <p className="truncate text-xs text-gray-400">
                        {FORMA_LABEL[v.forma_pagamento] || 'Venda'} · {formatData(v.data_venda)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Leads recentes */}
        <Card className="animate-rise" style={{ '--rise-delay': '340ms' }}>
          <CardHead title="Leads recentes" to="/leads" linkLabel="Ver todos" />
          {data.leads_recentes.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title="Nenhum lead ainda"
              description="Comece adicionando seu primeiro lead — manual ou pelo PDF da proposta."
              cta={{ to: '/leads', label: 'Adicionar lead' }}
            />
          ) : (
            <ul className="mt-4 divide-y divide-gray-100 dark:divide-white/5">
              {data.leads_recentes.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar nome={l.nome} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-brand-navy dark:text-white">
                        {l.nome}
                      </p>
                      <p className="truncate text-xs text-gray-400">
                        {INTERESSE_LABEL[l.interesse] || l.origem_especifica || 'Lead'}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-500 dark:bg-white/10 dark:text-gray-300">
                    {ESTAGIO_LABEL[l.estagio] || '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ── Skeleton de carregamento (shimmer) ────────────────────────────────────── */
function SkeletonBlock({ className = '' }) {
  return <div className={`shimmer rounded-md bg-gray-100 dark:bg-white/10 ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <div className="flex items-start justify-between">
              <div className="w-full">
                <SkeletonBlock className="h-3 w-24" />
                <SkeletonBlock className="mt-3 h-7 w-20" />
                <SkeletonBlock className="mt-3 h-3 w-28" />
              </div>
              <SkeletonBlock className="h-10 w-10 rounded-xl" />
            </div>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <SkeletonBlock className="h-4 w-32" />
            <div className="mt-5 space-y-3">
              {[0, 1, 2, 3].map((j) => (
                <SkeletonBlock key={j} className="h-6 w-full" />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
