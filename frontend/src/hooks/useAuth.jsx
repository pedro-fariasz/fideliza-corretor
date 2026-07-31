import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  // Perfil de aplicação (role/status) vindo do backend (/api/auth/me).
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);
  // Dados do tenant do corretor (/api/tenants/me) — usado pelo sidebar para
  // decidir se a aba Leads aparece (whatsapp_conectado) e afins.
  const [tenant, setTenant] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const me = await api.me();
      setProfile(me);
      return me;
    } catch (err) {
      // Sessão sem perfil vinculado, backend fora do ar, etc. As telas tratam.
      // Guardamos a mensagem/status reais para exibir um diagnóstico útil.
      setProfile(null);
      setProfileError({ message: err.message, status: err.status });
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // Sempre que a sessão muda, (re)carrega ou limpa o perfil.
  useEffect(() => {
    if (session) {
      loadProfile();
    } else {
      setProfile(null);
    }
  }, [session, loadProfile]);

  const loadTenant = useCallback(async () => {
    try {
      setTenant(await api.tenantMe());
    } catch {
      setTenant(null);
    }
  }, []);

  // Carrega o tenant só do corretor (o painel interno usa outro shell).
  useEffect(() => {
    if (profile && profile.role === 'corretor') loadTenant();
    else setTenant(null);
  }, [profile, loadTenant]);

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const message =
        error.message === 'Invalid login credentials'
          ? 'E-mail ou senha inválidos.'
          : error.message;
      throw new Error(message);
    }
  }

  // Cadastro de corretor — acesso liberado na hora; já faz login em seguida.
  async function signUpCorretor({ nome, email, senha }) {
    const result = await api.signupCorretor({ nome, email, senha });
    await signIn(email.trim(), senha);
    return result; // { role: 'corretor', status: 'ativo' }
  }

  // Cadastro de equipe — pode voltar 'ativo' (pré-aprovado) ou 'pendente'.
  // A tela decide: se ativo, faz login; se pendente, mostra aviso.
  async function signUpEquipe({ nome, email, senha }) {
    return api.signupEquipe({ nome, email, senha }); // { role, status }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  const value = {
    session,
    loading,
    profile,
    profileLoading,
    profileError,
    role: profile ? profile.role : null,
    status: profile ? profile.status : null,
    tenant,
    refreshTenant: loadTenant,
    refreshProfile: loadProfile,
    signIn,
    signUpCorretor,
    signUpEquipe,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  }
  return context;
}
