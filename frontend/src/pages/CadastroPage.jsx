import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AuthShell, { authInputClasses } from '../components/AuthShell';
import { homePathFor } from '../utils/homePath';

export default function CadastroPage() {
  const { session, loading, profile, signUpCorretor } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nome: '', email: '', senha: '', confirmar: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session && profile) {
    return <Navigate to={homePathFor(profile)} replace />;
  }

  function update(campo) {
    return (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!form.nome.trim() || !form.email.trim() || !form.senha) {
      setError('Preencha nome, e-mail e senha.');
      return;
    }
    if (form.senha.length < 8) {
      setError('A senha deve ter ao menos 8 caracteres.');
      return;
    }
    if (form.senha !== form.confirmar) {
      setError('As senhas não conferem.');
      return;
    }

    setSubmitting(true);
    try {
      await signUpCorretor({
        nome: form.nome.trim(),
        email: form.email.trim(),
        senha: form.senha,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Não foi possível criar a conta.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <section className="w-full max-w-sm">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-brand-navy">Criar conta</h2>
          <p className="mt-1 text-sm text-gray-500">
            Comece a organizar o pós-venda da sua carteira. Acesso liberado na hora.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <Field
              id="nome"
              label="Nome"
              value={form.nome}
              onChange={update('nome')}
              placeholder="Seu nome"
              autoComplete="name"
            />
            <Field
              id="email"
              label="E-mail"
              type="email"
              value={form.email}
              onChange={update('email')}
              placeholder="voce@email.com"
              autoComplete="email"
            />
            <Field
              id="senha"
              label="Senha"
              type="password"
              value={form.senha}
              onChange={update('senha')}
              placeholder="Mínimo de 8 caracteres"
              autoComplete="new-password"
            />
            <Field
              id="confirmar"
              label="Confirmar senha"
              type="password"
              value={form.confirmar}
              onChange={update('confirmar')}
              placeholder="Repita a senha"
              autoComplete="new-password"
            />

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
              {submitting ? 'Criando conta...' : 'Criar conta'}
              {!submitting && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Já tem conta?{' '}
            <Link to="/login" className="font-semibold text-brand-blue hover:text-brand-blue-dark">
              Entrar
            </Link>
          </p>
        </div>
      </section>
    </AuthShell>
  );
}

function Field({ id, label, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input id={id} className={authInputClasses} {...props} />
    </div>
  );
}
