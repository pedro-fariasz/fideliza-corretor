import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AuthShell, { authInputClasses } from '../components/AuthShell';
import { homePathFor } from '../utils/homePath';

export default function EquipeLoginPage() {
  const { session, loading, profile, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session && profile) {
    return <Navigate to={homePathFor(profile)} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Informe e-mail e senha.');
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      // O roteamento por papel/status decide o destino real (painel ou
      // tela de "aguardando aprovação").
      navigate('/equipe/painel', { replace: true });
    } catch (err) {
      setError(err.message || 'Não foi possível fazer login.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell band="equipe">
      <section className="w-full max-w-sm">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-brand-navy">Acesso da equipe</h2>
          <p className="mt-1 text-sm text-gray-500">
            Painel interno da Fideliza. Restrito à equipe autorizada.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="voce@fideliza.com.br"
                className={authInputClasses}
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className={authInputClasses}
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="press flex w-full items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Entrando...' : 'Entrar'}
              {!submitting && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Novo na equipe?{' '}
            <Link
              to="/equipe/cadastro"
              className="press font-semibold text-brand-blue transition-colors hover:text-brand-blue-dark"
            >
              Solicitar acesso
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          É corretor?{' '}
          <Link to="/login" className="press font-medium text-gray-500 underline transition-colors hover:text-gray-700">
            Entrar na sua carteira
          </Link>
        </p>
      </section>
    </AuthShell>
  );
}
