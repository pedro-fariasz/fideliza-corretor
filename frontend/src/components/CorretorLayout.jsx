import { Outlet, useLocation } from 'react-router-dom';
import { Home, Filter, Users, Package, DollarSign, Calendar, Settings } from 'lucide-react';
import SidebarShell from './SidebarShell';

// Shell de navegação do CORRETOR (sidebar). Decidido pelo role em App.jsx —
// nunca aparece junto com o menu da equipe interna.
// Ícones: lucide-react (linear, cor herdada do texto) — nunca emoji.
const ITEMS = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/funil', label: 'Funil', icon: Filter },
  { to: '/leads', label: 'Leads', icon: Users },
  { to: '/produtos', label: 'Produtos', icon: Package },
  { to: '/vendas', label: 'Vendas', icon: DollarSign },
  { to: '/agenda', label: 'Agenda', icon: Calendar },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

export default function CorretorLayout() {
  const { pathname } = useLocation();
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
