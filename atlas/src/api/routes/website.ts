import { Hono } from 'hono';
import { SDKClient } from '../../sdk/index.js';
import type { Env } from '../../types.js';
import type { WebsiteType } from '../../types.js';

export function websiteRoutes() {
  const router = new Hono<{ Bindings: Env }>();
  
  // GET /api/internal/websites
  router.get('/', async (c) => {
    const limit = parseInt(c.req.query('limit') || '100');
    const id = c.req.query('id');
    
    const client = new SDKClient(c);
    
    if (id) {
      const result = await client.website.get(id);
      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }
      return c.json({ websites: result.data });
    }
    
    const result = await client.website.list(limit);
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json({ websites: result.data });
  });
  
  // GET /api/internal/websites/by-url
  router.get('/by-url', async (c) => {
    const url = c.req.query('url');
    
    if (!url) {
      return c.json({ error: 'URL parameter is required' }, 400);
    }
    
    const client = new SDKClient(c);
    const result = await client.website.findByUrl(url);
    
    if (!result.success) {
      return c.json({ error: result.error }, result.error?.includes('not found') ? 404 : 500);
    }
    
    return c.json(result.data);
  });
  
  // GET /api/internal/websites/:id
  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const client = new SDKClient(c);
    const result = await client.website.get(id);
    
    if (!result.success) {
      return c.json({ error: result.error }, result.error?.includes('not found') ? 404 : 500);
    }
    
    return c.json(result.data);
  });
  
  // POST /api/internal/websites
  router.post('/', async (c) => {
    try {
      const body = await c.req.json<WebsiteType>();
      
      if (!body.id || !body.url || !body.userId) {
        return c.json({ error: 'Missing required fields: id, url, userId' }, 400);
      }
      
      // Set defaults
      body.live = body.live || 'INITIAL';
      body.preview = body.preview || 'INITIAL';
      
      const client = new SDKClient(c);
      const result = await client.website.set(body.id, body);
      
      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }
      
      return c.json({ success: true, id: body.id }, 201);
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // PUT /api/internal/websites/:id
  router.put('/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json<Partial<WebsiteType>>();
      
      const client = new SDKClient(c);
      
      // Get existing website
      const existingResult = await client.website.get(id);
      if (!existingResult.success) {
        return c.json({ error: 'Website not found' }, 404);
      }
      
      // Merge with existing data
      const updatedData: WebsiteType = {
        ...existingResult.data!,
        ...body,
        id // Ensure ID doesn't change
      };
      
      const result = await client.website.set(id, updatedData);
      
      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }
      
      return c.json({ success: true, id });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // DELETE /api/internal/websites/:id
  router.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const client = new SDKClient(c);
    const result = await client.website.delete(id);
    
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json({ success: true, id });
  });
  
  return router;
}