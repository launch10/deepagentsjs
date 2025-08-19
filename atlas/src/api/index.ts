import { Hono } from 'hono';
import type { Env } from '../types.js';
import { tenantRoutes } from './routes/tenant.js';
import { siteRoutes } from './routes/site.js';
import { planRoutes } from './routes/plan.js';
import { ipAllowlistMiddleware, hmacMiddleware, corsMiddleware } from '~/middleware/auth/admin';

export function createInternalAPI() {
  const api = new Hono<{ Bindings: Env }>();
  
  // api.use('/*', corsMiddleware);  
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
  api.route('/tenants', tenantRoutes());
  api.route('/sites', siteRoutes());
  api.route('/plans', planRoutes());
  
  // Deploy endpoint for complex operations
  api.post('/deploy', async (c) => {
    try {
      const body = await c.req.json();
      const { siteId, files, config } = body;
      
      if (!siteId) {
        return c.json({ error: 'siteId is required' }, 400);
      }
      
      // TODO: Implement actual deploy logic here
      // For now, just update the site config
      const { SDKClient } = await import('../sdk/index.js');
      const client = new SDKClient(c);
      
      const siteResult = await client.site.get(siteId);
      if (!siteResult.success) {
        return c.json({ error: siteResult.error }, 404);
      }
      
      // Update site with new deploy SHA
      const deployId = crypto.randomUUID();
      const updateResult = await client.site.set(siteId, {
        ...siteResult.data!,
        live: deployId,
        preview: config?.preview ? deployId : siteResult.data!.preview
      });
      
      if (!updateResult.success) {
        return c.json({ error: updateResult.error }, 500);
      }
      
      return c.json({
        success: true,
        deployId,
        message: 'Deploy initiated',
        siteId
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
  
  return api;
}