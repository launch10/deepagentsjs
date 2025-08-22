import { Hono } from 'hono';
import type { Env } from '../types.js';
import { userRoutes } from './routes/user.js';
import { websiteRoutes } from './routes/website.js';
import { planRoutes } from './routes/plan.js';
import { domainRoutes } from './routes/domain.js';
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
  api.route('/users', userRoutes());
  api.route('/websites', websiteRoutes());
  api.route('/plans', planRoutes());
  api.route('/domains', domainRoutes());
  
  // Deploy endpoint for complex operations
  api.post('/deploy', async (c) => {
    try {
      const body = await c.req.json();
      const { websiteId, files, config } = body;
      
      if (!websiteId) {
        return c.json({ error: 'websiteId is required' }, 400);
      }
      
      // TODO: Implement actual deploy logic here
      // For now, just update the website config
      const { SDKClient } = await import('../sdk/index.js');
      const client = new SDKClient(c);
      
      const websiteResult = await client.website.get(websiteId);
      if (!websiteResult.success) {
        return c.json({ error: websiteResult.error }, 404);
      }
      
      // Update website with new deploy SHA
      const deployId = crypto.randomUUID();
      const updateResult = await client.website.set(websiteId, {
        ...websiteResult.data!,
        live: deployId,
        preview: config?.preview ? deployId : websiteResult.data!.preview
      });
      
      if (!updateResult.success) {
        return c.json({ error: updateResult.error }, 500);
      }
      
      return c.json({
        success: true,
        deployId,
        message: 'Deploy initiated',
        websiteId
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
  
  return api;
}