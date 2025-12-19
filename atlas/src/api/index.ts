import { Hono } from 'hono';
import type { Env } from '../types.js';
import { accountRoutes } from './routes/account.js';
import { websiteRoutes } from './routes/website.js';
import { planRoutes } from './routes/plan.js';
import { domainRoutes } from './routes/domain.js';
import { websiteUrlRoutes } from './routes/website-url.js';
import { ipAllowlistMiddleware, hmacMiddleware } from '~/middleware/auth/admin';

export function createInternalAPI() {
  const api = new Hono<{ Bindings: Env }>();
  
  // api.use('/*', ipAllowlistMiddleware);
  api.use('/*', hmacMiddleware);

  // Health check endpoint
  api.get('/health', (c) => {
    return c.json({ 
      status: 'healthy',
      service: 'landing-page-server-internal-api',
      timestamp: new Date().toISOString()
    });
  });
  
  // Mount route groups
  api.route('/accounts', accountRoutes());
  api.route('/websites', websiteRoutes());
  api.route('/plans', planRoutes());
  api.route('/domains', domainRoutes());
  api.route('/website-urls', websiteUrlRoutes());
  
  return api;
}