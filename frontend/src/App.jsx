import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import CorretorLayout from './components/CorretorLayout';
import InternaLayout from './components/InternaLayout';

// Públicas
import LoginPage from './pages/LoginPage';
import CadastroPage from './pages/CadastroPage';
import EquipeLoginPage from './pages/EquipeLoginPage';
import EquipeCadastroPage from './pages/EquipeCadastroPage';
import AguardandoAprovacaoPage from './pages/AguardandoAprovacaoPage';

// Corretor (shell com sidebar) — CRM de vendas
import DashboardPage from './pages/corretor/DashboardPage';
import FunilPage from './pages/corretor/FunilPage';
import LeadsPage from './pages/corretor/LeadsPage';
import ProdutosPage from './pages/corretor/ProdutosPage';
import VendasPage from './pages/corretor/VendasPage';
import AgendaPage from './pages/corretor/AgendaPage';
import CarteiraPage from './pages/corretor/CarteiraPage';
import PosVendasPage from './pages/corretor/PosVendasPage';
import EquipePage from './pages/corretor/EquipePage';
import ConfiguracoesPage from './pages/corretor/ConfiguracoesPage';

// Equipe interna (shell com sidebar)
import CorretoresPage from './pages/interna/CorretoresPage';
import KanbanPage from './pages/interna/KanbanPage';
import AprovacoesPage from './pages/interna/AprovacoesPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Públicas — Fluxo 1 (corretor) */}
          <Route path="/login" element={<LoginPage />} />
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
            <Route path="/funil" element={<FunilPage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/produtos" element={<ProdutosPage />} />
            <Route path="/vendas" element={<VendasPage />} />
            <Route path="/agenda" element={<AgendaPage />} />
            <Route path="/carteira" element={<CarteiraPage />} />
            <Route path="/posvendas" element={<PosVendasPage />} />
            <Route path="/equipe" element={<EquipePage />} />
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />
          </Route>

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
