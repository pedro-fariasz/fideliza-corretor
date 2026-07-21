import { Outlet, useLocation } from 'react-router-dom';
import SidebarShell from './SidebarShell';

// Shell de navegação do CORRETOR (sidebar). Decidido pelo role em App.jsx —
// nunca aparece junto com o menu da equipe interna.
const ITEMS = [
  { to: '/', label: 'Início', icon: '🏠', end: true },
  { to: '/funil', label: 'Funil', icon: '🗂️' },
  { to: '/leads', label: 'Leads', icon: '👥' },
  { to: '/produtos', label: 'Produtos', icon: '📦' },
  { to: '/vendas', label: 'Vendas', icon: '💰' },
  { to: '/agenda', label: 'Agenda', icon: '📅' },
  { to: '/configuracoes', label: 'Configurações', icon: '⚙️' },
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
