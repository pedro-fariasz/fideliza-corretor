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
      .select('id, tenant_id, email, role')
      .eq('id', authUserId)
      .maybeSingle();

    if (profileError) {
      console.error('[auth] erro buscando perfil do usuário', {
        auth_user_id: authUserId,
        error: profileError.message,
      });
      return res.status(500).json({ error: 'Erro ao carregar perfil do usuário.' });
    }

    if (!profile) {
      return res
        .status(403)
        .json({ error: 'Usuário autenticado não possui perfil vinculado a um tenant.' });
    }

    req.tenantId = profile.tenant_id;
    req.user = {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      tenantId: profile.tenant_id,
    };

    return next();
  } catch (err) {
    console.error('[auth] falha inesperada', { error: err.message });
    return res.status(500).json({ error: 'Erro interno de autenticação.' });
  }
}

module.exports = { authMiddleware };
