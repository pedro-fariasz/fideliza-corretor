import { Outlet, useLocation } from 'react-router-dom';
import { Home, Filter, Users, Package, DollarSign, Calendar, Briefcase, Heart, TrendingUp, Trophy, UserCog, Settings } from 'lucide-react';
import SidebarShell from './SidebarShell';
import { useAuth } from '../hooks/useAuth';

// Shell de navegação do CORRETOR (sidebar). Decidido pelo role em App.jsx —
// nunca aparece junto com o menu da equipe interna.
// Ícones: lucide-react (linear, cor herdada do texto) — nunca emoji.
//
// A lista é montada DINAMICAMENTE conforme o papel da conta (perfil_efetivo)
// e as feature flags. O servidor continua sendo a fonte da verdade (403);
// aqui é só UX — não mostramos o que o usuário não pode usar.
const TODOS_ITENS = [
  { to: '/', label: 'Início', icon: Home, end: true, perfis: ['administrador', 'gerente', 'lider', 'vendedor'] },
  { to: '/funil', label: 'Funil', icon: Filter, perfis: ['administrador', 'gerente', 'lider', 'vendedor'] },
  { to: '/leads', label: 'Leads', icon: Users, perfis: ['administrador', 'gerente', 'lider', 'vendedor', 'secretaria'] },
  { to: '/produtos', label: 'Produtos', icon: Package, perfis: ['administrador', 'gerente'] },
  { to: '/vendas', label: 'Vendas', icon: DollarSign, perfis: ['administrador', 'gerente', 'lider', 'vendedor'] },
  // Rótulo visível "Clientes" (linguagem da corretora); rota segue /carteira.
  { to: '/carteira', label: 'Clientes', icon: Briefcase, perfis: ['administrador', 'gerente', 'lider', 'vendedor'], flag: 'carteira' },
  { to: '/posvendas', label: 'Pós-Vendas', icon: Heart, perfis: ['administrador', 'gerente', 'lider', 'vendedor'], flag: 'posvendas' },
  { to: '/inteligencia', label: 'Inteligência', icon: TrendingUp, perfis: ['administrador', 'gerente', 'lider', 'vendedor'], flag: 'bi_carteira' },
  { to: '/desempenho', label: 'Desempenho', icon: Trophy, perfis: ['administrador', 'gerente', 'lider', 'vendedor'], flag: 'desempenho' },
  { to: '/agenda', label: 'Agenda', icon: Calendar, perfis: ['administrador', 'gerente', 'lider', 'vendedor', 'secretaria'] },
  { to: '/equipe', label: 'Equipe', icon: UserCog, perfis: ['administrador'], flag: 'equipe' },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, perfis: ['administrador', 'gerente', 'lider', 'vendedor', 'secretaria'] },
];

export default function CorretorLayout() {
  const { pathname } = useLocation();
  const { profile } = useAuth();

  const perfil = (profile && profile.perfil_efetivo) || 'vendedor';
  const flags = (profile && profile.flags) || {};

  const ITEMS = TODOS_ITENS.filter(
    (i) => i.perfis.includes(perfil) && (!i.flag || flags[i.flag])
  );

  // Título = rótulo do item ativo (mais específico primeiro).
  const ativo = [...ITEMS]
    .reverse()
    .find((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)));

  return (
    <SidebarShell items={ITEMS} title={ativo ? ativo.label : 'Fideliza'}>
      <Outlet />
    </SidebarShell>
  );
}
