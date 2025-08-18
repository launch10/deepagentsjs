import { Hono } from 'hono';
import { SDKClient } from '../../sdk/index.js';
import type { Env } from '../../types.js';
import type { SiteType } from '../../types.js';

export function siteRoutes() {
  const router = new Hono<{ Bindings: Env }>();
  
  // GET /api/internal/sites
  router.get('/', async (c) => {
    const limit = parseInt(c.req.query('limit') || '100');
    const tenantId = c.req.query('tenantId');
    
    const client = new SDKClient(c);
    
    if (tenantId) {
      const result = await client.site.findByTenant(tenantId);
      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }
      return c.json({ sites: result.data });
    }
    
    const result = await client.site.list(limit);
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json({ sites: result.data });
  });
  
  // GET /api/internal/sites/by-url
  router.get('/by-url', async (c) => {
    const url = c.req.query('url');
    
    if (!url) {
      return c.json({ error: 'URL parameter is required' }, 400);
    }
    
    const client = new SDKClient(c);
    const result = await client.site.findByUrl(url);
    
    if (!result.success) {
      return c.json({ error: result.error }, result.error?.includes('not found') ? 404 : 500);
    }
    
    return c.json(result.data);
  });
  
  // GET /api/internal/sites/:id
  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const client = new SDKClient(c);
    const result = await client.site.get(id);
    
    if (!result.success) {
      return c.json({ error: result.error }, result.error?.includes('not found') ? 404 : 500);
    }
    
    return c.json(result.data);
  });
  
  // POST /api/internal/sites
  router.post('/', async (c) => {
    try {
      const body = await c.req.json<SiteType>();
      
      if (!body.id || !body.url || !body.tenantId) {
        return c.json({ error: 'Missing required fields: id, url, tenantId' }, 400);
      }
      
      // Set defaults
      body.live = body.live || 'INITIAL';
      body.preview = body.preview || 'INITIAL';
      
      const client = new SDKClient(c);
      const result = await client.site.set(body.id, body);
      
      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }
      
      return c.json({ success: true, id: body.id }, 201);
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // PUT /api/internal/sites/:id
  router.put('/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json<Partial<SiteType>>();
      
      const client = new SDKClient(c);
      
      // Get existing site
      const existingResult = await client.site.get(id);
      if (!existingResult.success) {
        return c.json({ error: 'Site not found' }, 404);
      }
      
      // Merge with existing data
      const updatedData: SiteType = {
        ...existingResult.data!,
        ...body,
        id // Ensure ID doesn't change
      };
      
      const result = await client.site.set(id, updatedData);
      
      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }
      
      return c.json({ success: true, id });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // DELETE /api/internal/sites/:id
  router.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const client = new SDKClient(c);
    const result = await client.site.delete(id);
    
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json({ success: true, id });
  });
  
  return router;
}