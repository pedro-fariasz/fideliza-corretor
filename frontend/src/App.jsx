import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import CorretorLayout from './components/CorretorLayout';
import InternaLayout from './components/InternaLayout';

// Públicas
import LandingPage from './pages/LandingPage';
import CadastroPage from './pages/CadastroPage';
import EquipeLoginPage from './pages/EquipeLoginPage';
import EquipeCadastroPage from './pages/EquipeCadastroPage';
import AguardandoAprovacaoPage from './pages/AguardandoAprovacaoPage';

// Corretor (shell com sidebar) — CRM de vendas
import DashboardPage from './pages/corretor/DashboardPage';
import LeadsPage from './pages/corretor/LeadsPage';
import ProdutosPage from './pages/corretor/ProdutosPage';
import VendasPage from './pages/corretor/VendasPage';
import AgendaPage from './pages/corretor/AgendaPage';
import CarteiraPage from './pages/corretor/CarteiraPage';
import ClientesHubPage from './pages/corretor/ClientesHubPage';
import PosVendasPage from './pages/corretor/PosVendasPage';
import InteligenciaPage from './pages/corretor/InteligenciaPage';
import DesempenhoPage from './pages/corretor/DesempenhoPage';
import EquipePage from './pages/corretor/EquipePage';
import ConfiguracoesPage from './pages/corretor/ConfiguracoesPage';
import ClienteFormPage from './pages/ClienteFormPage';

// Equipe interna (shell com sidebar)
import CorretoresPage from './pages/interna/CorretoresPage';
import KanbanPage from './pages/interna/KanbanPage';
import AprovacoesPage from './pages/interna/AprovacoesPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Públicas — Fluxo 1 (corretor) — landing + login em modal */}
          <Route path="/login" element={<LandingPage />} />
          <Route path="/cadastro" element={<CadastroPage />} />

          {/* Públicas — Fluxo 2 (equipe interna) */}
          <Route path="/equipe/login" element={<EquipeLoginPage />} />
          <Route path="/equipe/cadastro" element={<EquipeCadastroPage />} />
          <Route path="/equipe/pendente" element={<AguardandoAprovacaoPage />} />

          {/* Corretor — shell com sidebar */}
          <Route
            element={
              <ProtectedRoute roles={['corretor']}>
                <CorretorLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/produtos" element={<ProdutosPage />} />
            <Route path="/carteira" element={<CarteiraPage />} />
            {/* Hub de clientes — abas Carteira / Indicação / Leads / WhatsApp. */}
            <Route path="/clientes" element={<ClientesHubPage />} />
            <Route path="/pos-vendas" element={<PosVendasPage />} />
            <Route path="/inteligencia" element={<InteligenciaPage />} />
            <Route path="/agenda" element={<AgendaPage />} />
            <Route path="/equipe" element={<EquipePage />} />
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />

            {/* Fora do menu, mas mantidas funcionais (redirect ou acessível por URL). */}
            <Route path="/funil" element={<Navigate to="/leads" replace />} />
            <Route path="/posvendas" element={<Navigate to="/pos-vendas" replace />} />
            <Route path="/plataformas" element={<Navigate to="/carteira" replace />} />
            <Route path="/vendas" element={<VendasPage />} />
            <Route path="/desempenho" element={<DesempenhoPage />} />
          </Route>

          {/* Cadastro de cliente — página cheia própria, fora do shell do CRM. */}
          <Route
            path="/clientes/novo"
            element={
              <ProtectedRoute roles={['corretor']}>
                <ClienteFormPage />
              </ProtectedRoute>
            }
          />

          {/* Equipe interna — shell com sidebar (painel cross-tenant) */}
          <Route
            element={
              <ProtectedRoute roles={['funcionario', 'admin']}>
                <InternaLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/equipe/painel" element={<CorretoresPage />} />
            <Route path="/equipe/painel/kanban" element={<KanbanPage />} />
            <Route path="/equipe/painel/kanban/:tenantId" element={<KanbanPage />} />
            <Route path="/equipe/painel/aprovacoes" element={<AprovacoesPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
