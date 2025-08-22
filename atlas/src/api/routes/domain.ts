import { Hono } from 'hono';
import { SDKClient } from '../../sdk/index.js';
import type { Env } from '../../types.js';
import type { DomainType } from '../../types.js';

export function domainRoutes() {
  const router = new Hono<{ Bindings: Env }>();
  
  // GET /api/internal/domains
  router.get('/', async (c) => {
    const limit = parseInt(c.req.query('limit') || '100');
    const websiteId = c.req.query('websiteId');
    const id = c.req.query('id');
    
    const client = new SDKClient(c);
    
    if (id) {
      const result = await client.domain.get(id);
      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }
      return c.json({ domains: [result.data] });
    }
    
    const result = await client.domain.list(limit, websiteId);
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json({ domains: result.data });
  });
  
  // GET /api/internal/domains/by-url
  router.get('/by-url', async (c) => {
    const url = c.req.query('url');
    
    if (!url) {
      return c.json({ error: 'URL parameter is required' }, 400);
    }
    
    const client = new SDKClient(c);
    const result = await client.domain.findByUrl(url);
    
    if (!result.success) {
      return c.json({ error: result.error }, result.error?.includes('not found') ? 404 : 500);
    }
    
    return c.json(result.data);
  });
  
  // GET /api/internal/domains/:id
  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const client = new SDKClient(c);
    const result = await client.domain.get(id);
    
    if (!result.success) {
      return c.json({ error: result.error }, result.error?.includes('not found') ? 404 : 500);
    }
    
    return c.json(result.data);
  });
  
  // POST /api/internal/domains
  router.post('/', async (c) => {
    try {
      const body = await c.req.json<DomainType>();
      
      // Map Rails camelCase to our format
      const domainData: DomainType = {
        id: body.id || String(body.id),
        domain: body.domain,
        websiteId: (body as any).websiteId || (body as any).website_id || body.websiteId
      };
      
      if (!domainData.domain || !domainData.websiteId) {
        return c.json({ error: 'Missing required fields: domain, websiteId' }, 400);
      }
      
      // Generate ID if not provided
      if (!domainData.id) {
        domainData.id = crypto.randomUUID();
      }
      
      const client = new SDKClient(c);
      const result = await client.domain.set(domainData.id, domainData);
      
      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }
      
      return c.json({ success: true, id: domainData.id }, 201);
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // PUT /api/internal/domains/:id
  router.put('/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json<Partial<DomainType>>();
      
      const client = new SDKClient(c);
      
      // Get existing domain
      const existingResult = await client.domain.get(id);
      if (!existingResult.success) {
        return c.json({ error: 'Domain not found' }, 404);
      }
      
      // Map Rails camelCase to our format and merge with existing data
      const updatedData: DomainType = {
        ...existingResult.data!,
        id, // Ensure ID doesn't change
        domain: body.domain || existingResult.data!.domain,
        websiteId: (body as any).websiteId || (body as any).website_id || body.websiteId || existingResult.data!.websiteId
      };
      
      const result = await client.domain.set(id, updatedData);
      
      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }
      
      return c.json({ success: true, id });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // DELETE /api/internal/domains/:id
  router.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const client = new SDKClient(c);
    const result = await client.domain.delete(id);
    
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json({ success: true, id });
  });
  
  return router;
}