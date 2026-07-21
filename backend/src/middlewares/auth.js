const { supabase } = require('../config/supabase');

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticação ausente.' });
    }

    const token = authHeader.slice('Bearer '.length).trim();

    if (!token) {
      return res.status(401).json({ error: 'Token de autenticação vazio.' });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData || !userData.user) {
      console.error('[auth] token rejeitado pelo Supabase', {
        error: userError ? userError.message : 'usuário ausente na resposta',
        status: userError ? userError.status : undefined,
      });
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }

    const authUserId = userData.user.id;

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, tenant_id, email, role, status, nome, papel_conta, cargo, lider_id, ativo')
      .eq('id', authUserId)
      .maybeSingle();

    if (profileError) {
      console.error('[auth] erro buscando perfil do usuário', {
        auth_user_id: authUserId,
        error: profileError.message,
        code: profileError.code,
        details: profileError.details,
        hint: profileError.hint,
      });
      // Expõe a mensagem real do banco para diagnóstico (temporário).
      const partes = [profileError.message, profileError.details, profileError.hint]
        .filter(Boolean)
        .join(' | ');
      return res.status(500).json({
        error: `Erro ao carregar perfil${profileError.code ? ` [${profileError.code}]` : ''}: ${
          partes || 'sem detalhe'
        }`,
      });
    }

    if (!profile) {
      return res
        .status(403)
        .json({ error: 'Usuário autenticado não possui perfil vinculado a um tenant.' });
    }

    // Usuário desativado (Fase 0): acesso bloqueado, sem apagar seus dados.
    if (profile.ativo === false) {
      return res.status(403).json({ error: 'Seu acesso foi desativado. Fale com o administrador da conta.' });
    }

    req.tenantId = profile.tenant_id;
    req.user = {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      status: profile.status,
      nome: profile.nome,
      tenantId: profile.tenant_id,
      papel_conta: profile.papel_conta,
      cargo: profile.cargo,
      lider_id: profile.lider_id,
      ativo: profile.ativo,
    };

    return next();
  } catch (err) {
    console.error('[auth] falha inesperada', { error: err.message });
    return res.status(500).json({ error: 'Erro interno de autenticação.' });
  }
}

module.exports = { authMiddleware };
