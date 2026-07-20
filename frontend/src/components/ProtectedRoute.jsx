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
function dicaPorStatus(status) {
  if (status === 404)
    return 'O servidor respondeu 404 nesta rota — provavelmente o BACKEND ainda está na versão antiga (sem /api/auth/me). Faça o redeploy do backend com a branch nova.';
  if (status === 403)
    return 'O servidor respondeu 403 — você está logado, mas esta conta não tem perfil cadastrado. Saia e crie o acesso pela tela de cadastro (corretor ou equipe).';
  if (status === 401) return 'Sessão expirada. Saia e entre novamente.';
  if (status === 0)
    return 'Não foi possível falar com o backend (fora do ar, VITE_API_URL errada ou CORS bloqueando).';
  return null;
}

export default function ProtectedRoute({ children, roles }) {
  const { session, loading, profile, profileLoading, profileError, refreshProfile, signOut } =
    useAuth();

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
    const status = profileError ? profileError.status : undefined;
    const dica = dicaPorStatus(status);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <p className="max-w-md text-gray-700">Não foi possível carregar seu perfil.</p>
        {profileError && (
          <p className="max-w-md text-sm text-gray-500">
            <span className="font-medium">Detalhe técnico</span>
            {status !== undefined ? ` (HTTP ${status})` : ''}: {profileError.message}
          </p>
        )}
        {dica && <p className="max-w-md text-sm text-brand-navy">{dica}</p>}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={refreshProfile}
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-dark"
          >
            Tentar novamente
          </button>
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Sair
          </button>
        </div>
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
