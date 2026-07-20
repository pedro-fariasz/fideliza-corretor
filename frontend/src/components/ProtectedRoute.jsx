import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { homePathFor } from '../utils/homePath';

// Guarda de rota com controle de papel/status.
// - roles: lista de papéis permitidos (ex.: ['corretor'] ou ['funcionario','admin']).
// Regras:
//   sem sessão            -> /login
//   sessão sem perfil     -> mensagem (backend fora do ar / usuário sem perfil)
//   status != 'ativo'     -> /equipe/pendente
//   papel não permitido   -> manda para a home do próprio papel
export default function ProtectedRoute({ children, roles }) {
  const { session, loading, profile, profileLoading, signOut } = useAuth();

  if (loading || (session && profileLoading && !profile)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-gray-500">
        Carregando...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <p className="max-w-sm text-gray-600">
          Não foi possível carregar seu perfil. Verifique se o servidor está no ar e tente
          novamente.
        </p>
        <button
          type="button"
          onClick={signOut}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Sair
        </button>
      </div>
    );
  }

  if (profile.status !== 'ativo') {
    return <Navigate to="/equipe/pendente" replace />;
  }

  if (roles && !roles.includes(profile.role)) {
    return <Navigate to={homePathFor(profile)} replace />;
  }

  return children;
}
