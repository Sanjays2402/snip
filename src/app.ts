import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimit } from './middleware/rateLimit.js';
import { swaggerSpec } from './config/swagger.js';
import authRoutes from './routes/auth.routes.js';
import linkRoutes from './routes/link.routes.js';
import apiKeyRoutes from './routes/apikey.routes.js';
import healthRoutes from './routes/health.routes.js';
import redirectRoutes from './routes/redirect.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import qrRoutes from './routes/qr.routes.js';
import workspaceRoutes from './routes/workspace.routes.js';

export function createApp() {
  const app = express();

  // Global middleware
  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());

  // Trust proxy for correct IP detection behind reverse proxy
  app.set('trust proxy', 1);

  // Rate limiting (applied globally)
  app.use(rateLimit());

  // Swagger docs
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Snip API Docs',
  }));
  app.get('/docs/json', (_req, res) => {
    res.json(swaggerSpec);
  });

  // Health & stats (no prefix)
  app.use(healthRoutes);

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/links', analyticsRoutes); // analytics under /api/links/:id/analytics
  app.use('/api/links', qrRoutes); // QR under /api/links/:id/qr
  app.use('/api/links', linkRoutes);
  app.use('/api/keys', apiKeyRoutes);
  app.use('/api/webhooks', webhookRoutes);
  app.use('/api/workspaces', workspaceRoutes);

  // Redirect routes (must be last — catches /:shortCode)
  app.use(redirectRoutes);

  // Error handler
  app.use(errorHandler);

  return app;
}
