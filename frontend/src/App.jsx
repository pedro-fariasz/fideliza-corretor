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

// Corretor (shell com sidebar)
import InicioPage from './pages/corretor/InicioPage';
import PendenciasPage from './pages/corretor/PendenciasPage';
import ClientesPage from './pages/corretor/ClientesPage';
import CampanhasPage from './pages/corretor/CampanhasPage';
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
            <Route path="/" element={<InicioPage />} />
            <Route path="/pendencias" element={<PendenciasPage />} />
            <Route path="/clientes" element={<ClientesPage />} />
            <Route path="/campanhas" element={<CampanhasPage />} />
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />
          </Route>

          {/* Corretor — formulário de cliente (tela cheia, fora do shell) */}
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
