import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import CadastroPage from './pages/CadastroPage';
import EquipeLoginPage from './pages/EquipeLoginPage';
import EquipeCadastroPage from './pages/EquipeCadastroPage';
import AguardandoAprovacaoPage from './pages/AguardandoAprovacaoPage';
import PainelInternoPage from './pages/PainelInternoPage';
import ClientesListPage from './pages/ClientesListPage';
import ClienteFormPage from './pages/ClienteFormPage';

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

          {/* Corretor — carteira */}
          <Route
            path="/"
            element={
              <ProtectedRoute roles={['corretor']}>
                <ClientesListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clientes/novo"
            element={
              <ProtectedRoute roles={['corretor']}>
                <ClienteFormPage />
              </ProtectedRoute>
            }
          />

          {/* Equipe interna — painel cross-tenant */}
          <Route
            path="/equipe/painel"
            element={
              <ProtectedRoute roles={['funcionario', 'admin']}>
                <PainelInternoPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
