import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import linkRoutes from './routes/link.routes.js';
import apiKeyRoutes from './routes/apikey.routes.js';
import healthRoutes from './routes/health.routes.js';
import redirectRoutes from './routes/redirect.routes.js';

export function createApp() {
  const app = express();

  // Global middleware
  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());

  // Trust proxy for correct IP detection behind reverse proxy
  app.set('trust proxy', 1);

  // Health & stats (no prefix)
  app.use(healthRoutes);

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/links', linkRoutes);
  app.use('/api/keys', apiKeyRoutes);

  // Redirect routes (must be last — catches /:shortCode)
  app.use(redirectRoutes);

  // Error handler
  app.use(errorHandler);

  return app;
}
