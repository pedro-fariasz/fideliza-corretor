import { Outlet, useLocation } from 'react-router-dom';
import { Home, Users, Briefcase, Heart, TrendingUp, Calendar, UserCog, Settings } from 'lucide-react';
import SidebarShell from './SidebarShell';
import { useAuth } from '../hooks/useAuth';

// Shell de navegação do CORRETOR (sidebar). Produto saúde-only: a lista de abas
// é FIXA e nesta ordem. `perfis` faz o gate por papel. A aba Leads sempre
// aparece — sem WhatsApp conectado, o corretor ainda vê e trabalha os leads,
// só não consegue disparar mensagem por lá. Ícones: lucide-react — nunca emoji.
const TODOS = ['administrador', 'gerente', 'lider', 'vendedor'];
const TODOS_COM_SECRETARIA = [...TODOS, 'secretaria'];

const TODOS_ITENS = [
  { to: '/', label: 'Início', icon: Home, end: true, perfis: TODOS },
  { to: '/leads', label: 'Leads', icon: Users, perfis: TODOS_COM_SECRETARIA },
  // Hub de clientes (Carteira, Indicação, Leads, WhatsApp) — abas dentro da página.
  { to: '/clientes', label: 'Clientes', icon: Briefcase, perfis: TODOS },
  { to: '/pos-vendas', label: 'Fidelização', icon: Heart, perfis: TODOS },
  { to: '/inteligencia', label: 'Inteligência', icon: TrendingUp, perfis: TODOS },
  { to: '/agenda', label: 'Agenda', icon: Calendar, perfis: TODOS_COM_SECRETARIA },
  { to: '/equipe', label: 'Equipe', icon: UserCog, perfis: ['administrador'] },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, perfis: TODOS_COM_SECRETARIA },
];

export default function CorretorLayout() {
  const { pathname } = useLocation();
  const { profile } = useAuth();

  const perfil = (profile && profile.perfil_efetivo) || 'vendedor';

  const ITEMS = TODOS_ITENS.filter((i) => i.perfis.includes(perfil));

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
