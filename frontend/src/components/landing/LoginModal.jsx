import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { X, ArrowRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Logo from '../Logo';

const inputClasses =
  'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 ' +
  'placeholder:text-gray-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/40';

// Modal de login sobre a landing (mantém o formulário sempre acessível, sem sair
// da página). As telas de auth são SEMPRE claras — aqui não há classe dark:.
export default function LoginModal({ open, onClose }) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

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
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label="Entrar na sua conta"
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm"
      />

      <div className="reveal is-visible relative w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X size={18} />
        </button>

        <Logo variant="colorida" size={38} />
        <h2 className="mt-5 font-heading text-xl font-semibold text-brand-navy">Entrar</h2>
        <p className="mt-1 text-sm text-gray-500">Acesse sua carteira de clientes.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-gray-700">
              E-mail
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="voce@email.com"
              className={inputClasses}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-gray-700">
              Senha
            </label>
            <input
              id="login-password"
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
            className="cta-shine flex w-full items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Entrando...' : 'Entrar'}
            {!submitting && <ArrowRight size={16} aria-hidden="true" />}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="font-semibold text-brand-blue hover:text-brand-blue-dark">
            Criar conta
          </Link>
        </p>

        <p className="mt-3 text-center text-xs text-gray-400">
          É da equipe Fideliza?{' '}
          <Link to="/equipe/login" className="font-medium text-gray-500 underline hover:text-gray-700">
            Acesso da equipe
          </Link>
        </p>
      </div>
    </div>
  );
}
