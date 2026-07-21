import { Outlet, useLocation } from 'react-router-dom';
import { Building2, LayoutGrid, CheckCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import SidebarShell from './SidebarShell';

// Shell de navegação da EQUIPE INTERNA (funcionario/admin). Decidido pelo role
// em App.jsx — nunca aparece junto com o menu do corretor.
// "Aprovações" só entra para admin (o fluxo de aprovação já existia; aqui só é
// reexposto no menu). Corretores e Kanban são a leitura cross-tenant.
// Ícones: lucide-react (linear, cor herdada do texto) — nunca emoji.
const BASE_ITEMS = [
  { to: '/equipe/painel', label: 'Corretores', icon: Building2, end: true },
  { to: '/equipe/painel/kanban', label: 'Kanban', icon: LayoutGrid },
];
const ADMIN_ITEM = { to: '/equipe/painel/aprovacoes', label: 'Aprovações', icon: CheckCircle };

export default function InternaLayout() {
  const { profile } = useAuth();
  const { pathname } = useLocation();

  const items = profile?.role === 'admin' ? [...BASE_ITEMS, ADMIN_ITEM] : BASE_ITEMS;
  const ativo = [...items]
    .reverse()
    .find((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)));

  return (
    <SidebarShell items={items} badge="Painel interno" title={ativo ? ativo.label : 'Painel interno'}>
      <Outlet />
    </SidebarShell>
  );
}
