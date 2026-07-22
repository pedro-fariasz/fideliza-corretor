const express = require('express');
const cors = require('cors');

const { authMiddleware } = require('./middlewares/auth');
const { requireAtivo } = require('./middlewares/roles');
const { requirePermissao } = require('./middlewares/permissoes');
const { requireFeature } = require('./middlewares/feature');
const authRoutes = require('./routes/auth');
const jobsRoutes = require('./routes/jobs');
const clientesRoutes = require('./routes/clientes');
const produtosRoutes = require('./routes/produtos');
const leadsRoutes = require('./routes/leads');
const vendasRoutes = require('./routes/vendas');
const comissoesRoutes = require('./routes/comissoes');
const dashboardRoutes = require('./routes/dashboard');
const agendaRoutes = require('./routes/agenda');
const equipeRoutes = require('./routes/equipe');
const carteiraRoutes = require('./routes/carteira');
const posvendasRoutes = require('./routes/posvendas');
const biCarteiraRoutes = require('./routes/biCarteira');
const desempenhoRoutes = require('./routes/desempenho');
const adminRoutes = require('./routes/admin');
const internoRoutes = require('./routes/interno');

function createApp() {
  const app = express();

  const corsOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: corsOrigins.length > 0 ? corsOrigins : true,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Rotas de autenticação: signup é público; /me aplica auth internamente.
  // Precisa vir ANTES do authMiddleware global de /api.
  app.use('/api/auth', authRoutes);

  // Jobs (cron): sem authMiddleware — protegidos por JOB_SECRET no header.
  app.use('/api/jobs', jobsRoutes);

  // Demais rotas de /api são autenticadas.
  app.use('/api', authMiddleware);
  app.use('/api/clientes', requireAtivo, clientesRoutes);
  // Produtos: GET é aberto a qualquer usuário ativo (o formulário de venda
  // precisa da lista); a ESCRITA é gated por permissão dentro do router.
  app.use('/api/produtos', requireAtivo, produtosRoutes);
  app.use('/api/leads', requireAtivo, requirePermissao('leads', 'ler'), leadsRoutes);
  app.use('/api/vendas', requireAtivo, requirePermissao('vendas', 'ler'), vendasRoutes);
  app.use('/api/comissoes', requireAtivo, requirePermissao('comissoes', 'ler'), comissoesRoutes);
  app.use('/api/dashboard', requireAtivo, requirePermissao('dashboard_financeiro', 'ler'), dashboardRoutes);
  app.use('/api/agenda', requireAtivo, requirePermissao('agenda', 'ler'), agendaRoutes);
  app.use('/api/equipe', requireAtivo, equipeRoutes); // gate por 'usuarios' dentro do router
  // Carteira (Fase 1): gated por feature flag + permissão 'carteira' (leitura).
  app.use(
    '/api/carteira',
    requireAtivo,
    requireFeature('carteira'),
    requirePermissao('carteira', 'ler'),
    carteiraRoutes
  );
  // Pós-Vendas (Fase 2): gated por feature flag + permissão 'posvendas' (leitura).
  app.use(
    '/api/posvendas',
    requireAtivo,
    requireFeature('posvendas'),
    requirePermissao('posvendas', 'ler'),
    posvendasRoutes
  );
  // BI de Carteira (Fase 3): gated por feature flag + permissão 'bi_carteira'.
  app.use(
    '/api/bi-carteira',
    requireAtivo,
    requireFeature('bi_carteira'),
    requirePermissao('bi_carteira', 'ler'),
    biCarteiraRoutes
  );
  // Desempenho de Equipe (Fase 4): gated por feature flag + permissão 'desempenho'.
  app.use(
    '/api/desempenho',
    requireAtivo,
    requireFeature('desempenho'),
    requirePermissao('desempenho', 'ler'),
    desempenhoRoutes
  );
  app.use('/api/admin', adminRoutes);
  // Painel interno cross-tenant (gate por requireInternal dentro das rotas).
  app.use('/api/interno', internoRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: 'Rota não encontrada.' });
  });

  // Handler central de erros.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    const status = err.statusCode || 500;
    const payload = {
      error: err.message || 'Erro interno.',
    };

    // Erros do Supabase / PostgREST costumam trazer code/details.
    if (err.code) payload.code = err.code;

    if (status >= 500) {
      console.error('[error]', {
        tenant_id: req.tenantId,
        path: req.path,
        method: req.method,
        error: err.message,
        code: err.code,
        details: err.details,
      });
    }

    res.status(status).json(payload);
  });

  return app;
}

module.exports = { createApp };
