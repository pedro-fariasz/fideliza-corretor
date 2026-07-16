const express = require('express');
const cors = require('cors');

const { authMiddleware } = require('./middlewares/auth');
const clientesRoutes = require('./routes/clientes');

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

  // Todas as rotas de /api são autenticadas.
  app.use('/api', authMiddleware);
  app.use('/api/clientes', clientesRoutes);

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
