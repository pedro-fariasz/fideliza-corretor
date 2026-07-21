import { Navigate } from 'react-router-dom';
import { Ban, Hourglass } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import AuthShell from '../components/AuthShell';

// Tela para o funcionário que já logou mas ainda não foi aprovado (ou recusado).
export default function AguardandoAprovacaoPage() {
  const { session, loading, profile, profileLoading, status, refreshProfile, signOut } = useAuth();

  if (loading || (session && profileLoading && !profile)) {
    return <AuthShell><p className="text-gray-500">Carregando...</p></AuthShell>;
  }
  if (!session) return <Navigate to="/equipe/login" replace />;
  // Corretor ou funcionário já ativo não deve ver esta tela.
  if (profile && profile.status === 'ativo') {
    return <Navigate to={profile.role === 'corretor' ? '/' : '/equipe/painel'} replace />;
  }

  const recusado = status === 'recusado';

  return (
    <AuthShell band="equipe">
      <section className="w-full max-w-sm">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-amber/15 text-brand-amber">
            {recusado ? <Ban size={22} aria-hidden="true" /> : <Hourglass size={22} aria-hidden="true" />}
          </div>
          <h2 className="text-xl font-semibold text-brand-navy">
            {recusado ? 'Acesso não liberado' : 'Aguardando aprovação'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {recusado
              ? 'Seu acesso à equipe interna não foi liberado. Fale com um administrador se achar que houve engano.'
              : 'Seu cadastro está pendente de aprovação de um administrador. Assim que for liberado, você já poderá acessar o painel.'}
          </p>

          <div className="mt-6 flex flex-col gap-2">
            {!recusado && (
              <button
                type="button"
                onClick={refreshProfile}
                className="rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-dark"
              >
                Já fui aprovado — verificar
              </button>
            )}
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Sair
            </button>
          </div>
        </div>
      </section>
    </AuthShell>
  );
}
