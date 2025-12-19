import { Hono } from 'hono';
import type { Env, AppVariables } from '../types.js';
import { accountRoutes } from './routes/account.js';
import { websiteRoutes } from './routes/website.js';
import { planRoutes } from './routes/plan.js';
import { domainRoutes } from './routes/domain.js';
import { websiteUrlRoutes } from './routes/website-url.js';
import { ipAllowlistMiddleware, hmacMiddleware } from '~/middleware/auth/admin';
import { environmentMiddleware } from '~/middleware';

export function createInternalAPI() {
  const api = new Hono<{ Bindings: Env; Variables: AppVariables }>();
  
  // api.use('/*', ipAllowlistMiddleware);
  api.use('/*', hmacMiddleware);
  api.use('/*', environmentMiddleware());

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