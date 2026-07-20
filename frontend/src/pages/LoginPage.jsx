import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Logo from '../components/Logo';
import { homePathFor } from '../utils/homePath';

const inputClasses =
  'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 ' +
  'placeholder:text-gray-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/40';

export default function LoginPage() {
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
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Não foi possível fazer login.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Logo variant="colorida" size={44} />
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center gap-12 px-6 py-10 lg:flex-row lg:gap-20">
        {/* Hero */}
        <section className="max-w-xl flex-1">
          <h1 className="text-4xl font-semibold leading-tight text-brand-navy sm:text-5xl">
            O pós-venda da sua carteira,
            <br />
            <span className="text-brand-blue">no piloto automático</span>
            <span className="text-brand-amber">.</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-gray-600">
            Cadastre o cliente uma vez e o Fideliza cuida do relacionamento sozinho — WhatsApp,
            e-mail e alertas de carência, aniversário e reajuste, tudo em um único lugar.
          </p>

          {/* Cards decorativos */}
          <div className="mt-10 hidden gap-4 lg:flex">
            <div className="w-44 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                Score médio da carteira
              </p>
              <p className="mt-1 font-heading text-2xl font-semibold text-brand-navy">84%</p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200">
                <div className="h-1.5 w-[84%] rounded-full bg-brand-blue" />
              </div>
            </div>
            <div className="flex-1 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-brand-amber" aria-hidden="true" />
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  Alerta enviado · WhatsApp
                </p>
              </div>
              <p className="mt-2 rounded-lg bg-brand-blue px-3 py-2 text-xs text-white">
                Oi, Ana! A carência do seu plano termina esta semana. Posso te explicar o que
                libera agora?
              </p>
            </div>
          </div>
        </section>

        {/* Card de login */}
        <section className="w-full max-w-sm">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-brand-navy">Entrar</h2>
            <p className="mt-1 text-sm text-gray-500">
              Acesse sua carteira de clientes.
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
                  placeholder="voce@email.com"
                  className={inputClasses}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={inputClasses}
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
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Entrando...' : 'Entrar'}
                {!submitting && <span aria-hidden="true">→</span>}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              Ainda não tem conta?{' '}
              <Link
                to="/cadastro"
                className="font-semibold text-brand-blue hover:text-brand-blue-dark"
              >
                Criar conta
              </Link>
            </p>
          </div>

          <p className="mt-4 text-center text-xs text-gray-400">
            É da equipe Fideliza?{' '}
            <Link to="/equipe/login" className="font-medium text-gray-500 underline hover:text-gray-700">
              Acesso da equipe
            </Link>
          </p>
        </section>
      </main>

      <footer className="py-6 text-center text-xs text-gray-400">
        © Fideliza Corretor. Todos os direitos reservados.
      </footer>
    </div>
  );
}
